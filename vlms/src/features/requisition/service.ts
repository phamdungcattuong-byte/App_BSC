import { randomUUID } from 'node:crypto';
import { Prisma, PrStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { nextDocCode } from '@/lib/doc-code';
import { conflict, dependency, invalid } from '@/lib/errors';
import { BUSINESS_PARAMS, resolveApprovalTier } from '@/lib/config/business-params';
import type { SessionUser } from '@/lib/auth';
import { num } from '@/lib/money';

export interface DraftLine {
  materialId: string;
  wbsId: string;
  quantity: number;
  estPrice: number;
  note?: string;
}

export interface CreateRequisitionInput {
  projectId: string;
  neededBy: Date;
  note?: string;
  lines: DraftLine[];
}

/** COM-02 — Tạo đề nghị mua ở trạng thái nháp. */
export async function createRequisition(
  user: SessionUser,
  input: CreateRequisitionInput,
): Promise<string> {
  if (input.lines.length === 0) {
    throw invalid('Đề nghị mua phải có ít nhất một dòng vật tư.');
  }
  if (input.lines.some((l) => l.quantity <= 0)) {
    throw invalid('Số lượng của mỗi dòng phải lớn hơn 0.');
  }

  const total = input.lines.reduce((sum, l) => sum + l.quantity * l.estPrice, 0);
  const correlationId = randomUUID();

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: input.projectId, organizationId: user.organizationId },
    });
    if (!project) throw invalid('Dự án không thuộc tổ chức của bạn.');

    const code = await nextDocCode(tx, 'PR', { organizationId: user.organizationId });

    const pr = await tx.purchaseRequisition.create({
      data: {
        code,
        organizationId: user.organizationId,
        projectId: input.projectId,
        createdById: user.id,
        neededBy: input.neededBy,
        note: input.note,
        totalValue: new Prisma.Decimal(total),
        lines: {
          create: input.lines.map((l) => ({
            materialId: l.materialId,
            wbsId: l.wbsId,
            quantity: new Prisma.Decimal(l.quantity),
            estPrice: new Prisma.Decimal(l.estPrice),
            note: l.note,
          })),
        },
      },
    });

    await writeAudit(
      {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'PurchaseRequisition',
        entityId: pr.id,
        action: 'CREATE',
        toState: PrStatus.DRAFT,
        metadata: { code, totalValue: total, lineCount: input.lines.length },
        correlationId,
      },
      tx,
    );

    return pr.id;
  });
}

/**
 * Phát hiện dấu hiệu tách đề nghị mua để né hạn mức phê duyệt.
 * Hệ thống chỉ cảnh báo, quyết định vẫn thuộc về người phê duyệt.
 */
export async function detectSplitRisk(
  organizationId: string,
  projectId: string,
  createdById: string,
  currentValue: number,
  excludePrId?: string,
): Promise<{ flagged: boolean; siblingCount: number; aggregate: number }> {
  const { windowHours, minCount, aggregateThreshold } = BUSINESS_PARAMS.prSplitDetection;
  const since = new Date(Date.now() - windowHours * 3600 * 1000);

  const siblings = await prisma.purchaseRequisition.findMany({
    where: {
      organizationId,
      projectId,
      createdById,
      createdAt: { gte: since },
      status: { not: PrStatus.REJECTED },
      ...(excludePrId ? { id: { not: excludePrId } } : {}),
    },
    select: { totalValue: true },
  });

  const aggregate = siblings.reduce((s, r) => s + num(r.totalValue), currentValue);
  const flagged = siblings.length + 1 >= minCount && aggregate > aggregateThreshold;

  return { flagged, siblingCount: siblings.length, aggregate };
}

/** COM-02 — Trình duyệt: kiểm ngân sách WBS rồi chuyển sang chờ phê duyệt. */
export async function submitRequisition(user: SessionUser, prId: string): Promise<void> {
  const correlationId = randomUUID();

  await prisma.$transaction(async (tx) => {
    const pr = await tx.purchaseRequisition.findFirst({
      where: { id: prId, organizationId: user.organizationId },
      include: { lines: { include: { wbs: true } } },
    });
    if (!pr) throw invalid('Không tìm thấy đề nghị mua.');
    if (pr.status !== PrStatus.DRAFT) {
      throw conflict('Chỉ đề nghị mua ở trạng thái nháp mới trình duyệt được.');
    }
    if (pr.createdById !== user.id) {
      throw invalid('Chỉ người tạo mới được trình duyệt đề nghị mua này.');
    }

    // Kiểm ngân sách còn lại của từng hạng mục WBS trước khi cho trình duyệt.
    const perWbs = new Map<string, { name: string; need: number; available: number }>();
    for (const line of pr.lines) {
      const need = num(line.quantity) * num(line.estPrice);
      const current = perWbs.get(line.wbsId);
      if (current) {
        current.need += need;
      } else {
        perWbs.set(line.wbsId, {
          name: line.wbs.name,
          need,
          available: num(line.wbs.budget) - num(line.wbs.committed),
        });
      }
    }

    const overrun = [...perWbs.values()].filter((w) => w.need > w.available);
    if (overrun.length > 0) {
      throw dependency(
        `Vượt ngân sách còn lại của hạng mục: ${overrun.map((w) => w.name).join(', ')}.`,
      );
    }

    await tx.purchaseRequisition.update({
      where: { id: prId },
      data: { status: PrStatus.SUBMITTED, submittedAt: new Date() },
    });

    await writeAudit(
      {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'PurchaseRequisition',
        entityId: prId,
        action: 'SUBMIT',
        fromState: PrStatus.DRAFT,
        toState: PrStatus.SUBMITTED,
        correlationId,
      },
      tx,
    );
  });
}

/** COM-02 — Phê duyệt hoặc từ chối, có kiểm tra phân tách nhiệm vụ (SoD). */
export async function decideRequisition(
  user: SessionUser,
  prId: string,
  decision: 'APPROVE' | 'REJECT',
  reason: string,
): Promise<void> {
  if (!reason.trim()) throw invalid('Vui lòng nhập lý do cho quyết định.');
  const correlationId = randomUUID();

  await prisma.$transaction(async (tx) => {
    const pr = await tx.purchaseRequisition.findFirst({
      where: { id: prId, organizationId: user.organizationId },
      include: { lines: true },
    });
    if (!pr) throw invalid('Không tìm thấy đề nghị mua.');
    if (pr.status !== PrStatus.SUBMITTED && pr.status !== PrStatus.BUDGET_CHECK) {
      throw conflict('Đề nghị mua này không ở trạng thái chờ phê duyệt.');
    }
    // Phân tách nhiệm vụ: người tạo không tự phê duyệt chứng từ của mình.
    if (pr.createdById === user.id) {
      throw invalid('Người tạo đề nghị mua không được tự phê duyệt (phân tách nhiệm vụ).');
    }

    const approved = decision === 'APPROVE';

    await tx.purchaseRequisition.update({
      where: { id: prId },
      data: {
        status: approved ? PrStatus.APPROVED : PrStatus.REJECTED,
        decidedAt: new Date(),
        decidedById: user.id,
        decisionReason: reason,
      },
    });

    // Ghi nhận cam kết ngân sách khi được duyệt.
    if (approved) {
      for (const line of pr.lines) {
        await tx.wbs.update({
          where: { id: line.wbsId },
          data: {
            committed: { increment: new Prisma.Decimal(num(line.quantity) * num(line.estPrice)) },
          },
        });
      }
    }

    await writeAudit(
      {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'PurchaseRequisition',
        entityId: prId,
        action: decision,
        fromState: pr.status,
        toState: approved ? PrStatus.APPROVED : PrStatus.REJECTED,
        reason,
        metadata: {
          tier: resolveApprovalTier(num(pr.totalValue)).label,
          pendingDecision: BUSINESS_PARAMS.pendingDecision,
        },
        correlationId,
      },
      tx,
    );
  });
}
