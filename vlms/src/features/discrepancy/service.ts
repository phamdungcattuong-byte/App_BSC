import { randomUUID } from 'node:crypto';
import {
  DiscrepancyResolution,
  DiscrepancyStatus,
  DiscrepancyType,
  Prisma,
  Responsibility,
} from '@prisma/client';
import { prisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { nextDocCode } from '@/lib/doc-code';
import { conflict, dependency, invalid } from '@/lib/errors';
import type { SessionUser } from '@/lib/auth';
import { num } from '@/lib/money';

/**
 * FUL-03 — Ghi nhận sai lệch khi nhận hàng.
 *
 * Nguyên tắc bất di bất dịch: phiếu nhận hàng gốc không bị sửa. Mọi điều chỉnh
 * số lượng hay công nợ đều đi qua bản ghi sai lệch này và có dấu vết riêng.
 */
export async function createDiscrepancy(
  user: SessionUser,
  input: {
    grnLineId: string;
    type: DiscrepancyType;
    quantity: number;
    description: string;
  },
  tx?: Prisma.TransactionClient,
): Promise<string> {
  if (input.quantity <= 0) throw invalid('Số lượng sai lệch phải lớn hơn 0.');
  if (!input.description.trim()) throw invalid('Vui lòng mô tả sai lệch.');

  const correlationId = randomUUID();

  const run = async (db: Prisma.TransactionClient) => {
    const grnLine = await db.grnLine.findUnique({
      where: { id: input.grnLineId },
      include: { grn: true, poLine: { include: { material: true } } },
    });
    if (!grnLine) throw invalid('Không tìm thấy dòng phiếu nhận hàng.');
    if (grnLine.grn.buyerOrgId !== user.organizationId) {
      throw invalid('Phiếu nhận hàng không thuộc tổ chức của bạn.');
    }

    // Sai lệch không được vượt quá khối lượng thực tế của dòng nhận hàng.
    const ceiling =
      input.type === DiscrepancyType.OVERAGE
        ? num(grnLine.deliveredQty)
        : Math.max(num(grnLine.deliveredQty), num(grnLine.acceptedQty));
    if (input.quantity > ceiling + 1e-9) {
      throw invalid(
        `Số lượng sai lệch ${input.quantity} vượt quá khối lượng của dòng nhận hàng (${ceiling}).`,
      );
    }

    const code = await nextDocCode(db, 'SL', { organizationId: user.organizationId });

    const discrepancy = await db.discrepancy.create({
      data: {
        code,
        grnId: grnLine.grnId,
        grnLineId: grnLine.id,
        buyerOrgId: grnLine.grn.buyerOrgId,
        supplierOrgId: grnLine.grn.supplierOrgId,
        type: input.type,
        quantity: new Prisma.Decimal(input.quantity),
        description: input.description.trim(),
        raisedById: user.id,
      },
    });

    await writeAudit(
      {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'Discrepancy',
        entityId: discrepancy.id,
        action: 'RAISE',
        toState: DiscrepancyStatus.OPEN,
        metadata: {
          code,
          grnCode: grnLine.grn.code,
          material: grnLine.poLine.material.name,
          type: input.type,
          quantity: input.quantity,
        },
        correlationId,
      },
      db,
    );

    return discrepancy.id;
  };

  return tx ? run(tx) : prisma.$transaction(run);
}

/** Nhà cung cấp phản hồi và ghi nhận trách nhiệm sơ bộ. */
export async function respondToDiscrepancy(
  user: SessionUser,
  discrepancyId: string,
  note: string,
): Promise<void> {
  if (!note.trim()) throw invalid('Vui lòng nhập nội dung phản hồi.');
  const correlationId = randomUUID();

  await prisma.$transaction(async (tx) => {
    const discrepancy = await tx.discrepancy.findFirst({
      where: { id: discrepancyId, supplierOrgId: user.organizationId },
    });
    if (!discrepancy) throw invalid('Không tìm thấy sai lệch của tổ chức bạn.');
    if (discrepancy.status !== DiscrepancyStatus.OPEN) {
      throw conflict('Sai lệch này không còn ở trạng thái chờ phản hồi.');
    }

    await tx.discrepancy.update({
      where: { id: discrepancyId },
      data: {
        status: DiscrepancyStatus.INVESTIGATING,
        supplierNote: note.trim(),
        respondedById: user.id,
        respondedAt: new Date(),
      },
    });

    await writeAudit(
      {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'Discrepancy',
        entityId: discrepancyId,
        action: 'RESPOND',
        fromState: DiscrepancyStatus.OPEN,
        toState: DiscrepancyStatus.INVESTIGATING,
        reason: note.trim(),
        correlationId,
      },
      tx,
    );
  });
}

/**
 * FUL-03 — Chốt hướng xử lý sai lệch và áp dụng hệ quả.
 *
 *   REPLACE — nhà cung cấp giao bù, không điều chỉnh sổ sách.
 *   RETURN  — trả lại hàng đã nhận, giảm số đã nhận trên dòng đơn hàng.
 *   CREDIT  — phát hành khoản giảm trừ công nợ.
 *   ACCEPT  — chấp nhận nguyên trạng, đóng hồ sơ.
 *
 * Người ghi nhận sai lệch không được tự chốt hướng xử lý (phân tách nhiệm vụ).
 */
export async function resolveDiscrepancy(
  user: SessionUser,
  discrepancyId: string,
  input: {
    resolution: DiscrepancyResolution;
    responsibility: Responsibility;
    note: string;
    creditAmount?: number;
  },
): Promise<void> {
  if (!input.note.trim()) throw invalid('Vui lòng nhập căn cứ xử lý.');
  const correlationId = randomUUID();

  await prisma.$transaction(async (tx) => {
    const discrepancy = await tx.discrepancy.findFirst({
      where: { id: discrepancyId, buyerOrgId: user.organizationId },
      include: { grnLine: { include: { poLine: true } }, creditNote: true },
    });
    if (!discrepancy) throw invalid('Không tìm thấy sai lệch.');
    if (discrepancy.status === DiscrepancyStatus.CLOSED) {
      throw conflict('Sai lệch này đã được đóng.');
    }
    if (discrepancy.raisedById === user.id) {
      throw invalid('Người ghi nhận sai lệch không được tự chốt hướng xử lý.');
    }

    let creditAmount: Prisma.Decimal | null = null;

    if (input.resolution === DiscrepancyResolution.CREDIT) {
      const unitPrice = num(discrepancy.grnLine.poLine.unitPrice);
      const taxRate = num(discrepancy.grnLine.poLine.taxRate);
      // Mặc định giảm trừ theo đúng đơn giá đơn hàng, đã gồm thuế.
      const suggested = num(discrepancy.quantity) * unitPrice * (1 + taxRate);
      const amount = input.creditAmount ?? suggested;

      if (amount <= 0) throw invalid('Số tiền giảm trừ phải lớn hơn 0.');
      if (amount > suggested + 1e-6) {
        throw dependency(
          `Khoản giảm trừ ${amount} vượt giá trị sai lệch theo đơn hàng (${Math.round(suggested)}).`,
        );
      }
      creditAmount = new Prisma.Decimal(amount);

      const code = await nextDocCode(tx, 'GT', { organizationId: user.organizationId });
      await tx.creditNote.create({
        data: {
          code,
          discrepancyId,
          buyerOrgId: discrepancy.buyerOrgId,
          supplierOrgId: discrepancy.supplierOrgId,
          amount: creditAmount,
          issuedById: user.id,
        },
      });
    }

    if (input.resolution === DiscrepancyResolution.RETURN) {
      const received = num(discrepancy.grnLine.poLine.receivedQty);
      const returning = num(discrepancy.quantity);
      if (returning > received + 1e-9) {
        throw dependency(
          `Không thể trả ${returning} khi dòng đơn hàng mới nhận ${received}.`,
        );
      }
      // Điều chỉnh trên dòng đơn hàng, phiếu nhận hàng gốc giữ nguyên.
      await tx.poLine.update({
        where: { id: discrepancy.grnLine.poLineId },
        data: { receivedQty: { decrement: new Prisma.Decimal(returning) } },
      });
    }

    await tx.discrepancy.update({
      where: { id: discrepancyId },
      data: {
        status: DiscrepancyStatus.CLOSED,
        resolution: input.resolution,
        responsibility: input.responsibility,
        resolutionNote: input.note.trim(),
        creditAmount,
        resolvedById: user.id,
        resolvedAt: new Date(),
      },
    });

    await writeAudit(
      {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'Discrepancy',
        entityId: discrepancyId,
        action: 'RESOLVE',
        fromState: discrepancy.status,
        toState: DiscrepancyStatus.CLOSED,
        reason: input.note.trim(),
        metadata: {
          code: discrepancy.code,
          resolution: input.resolution,
          responsibility: input.responsibility,
          creditAmount: creditAmount ? num(creditAmount) : null,
        },
        correlationId,
      },
      tx,
    );
  });
}

/** Tổng giảm trừ công nợ chưa đối trừ, theo từng nhà cung cấp. */
export async function getCreditBySupplier(
  organizationId: string,
): Promise<Map<string, number>> {
  const notes = await prisma.creditNote.groupBy({
    by: ['supplierOrgId'],
    where: { buyerOrgId: organizationId },
    _sum: { amount: true },
  });
  return new Map(notes.map((n) => [n.supplierOrgId, num(n._sum.amount)]));
}
