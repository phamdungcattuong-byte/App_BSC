import { randomUUID } from 'node:crypto';
import { Prisma, PrStatus, QuoteStatus, RfqStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { nextDocCode } from '@/lib/doc-code';
import { conflict, invalid } from '@/lib/errors';
import { BUSINESS_PARAMS } from '@/lib/config/business-params';
import type { SessionUser } from '@/lib/auth';
import { num } from '@/lib/money';

/** SRC-02 — Tạo RFQ từ đề nghị mua đã duyệt và mời nhà cung cấp. */
export async function createRfqFromRequisition(
  user: SessionUser,
  prId: string,
  supplierOrgIds: string[],
  closingAt: Date,
  terms?: string,
): Promise<string> {
  if (supplierOrgIds.length === 0) {
    throw invalid('Phải mời ít nhất một nhà cung cấp.');
  }
  if (closingAt.getTime() <= Date.now()) {
    throw invalid('Hạn nhận báo giá phải nằm trong tương lai.');
  }

  const correlationId = randomUUID();

  return prisma.$transaction(async (tx) => {
    const pr = await tx.purchaseRequisition.findFirst({
      where: { id: prId, organizationId: user.organizationId },
      include: { lines: { include: { material: true } } },
    });
    if (!pr) throw invalid('Không tìm thấy đề nghị mua.');
    if (pr.status !== PrStatus.APPROVED) {
      throw conflict('Chỉ đề nghị mua đã được phê duyệt mới chuyển thành RFQ được.');
    }

    const suppliers = await tx.organization.findMany({
      where: { id: { in: supplierOrgIds }, type: 'SUPPLIER', status: 'VERIFIED' },
      select: { id: true },
    });
    if (suppliers.length !== supplierOrgIds.length) {
      throw invalid('Có nhà cung cấp chưa được xác minh hoặc không tồn tại.');
    }

    const code = await nextDocCode(tx, 'RFQ', { organizationId: user.organizationId });

    const rfq = await tx.rfq.create({
      data: {
        code,
        organizationId: user.organizationId,
        prId,
        closingAt,
        terms,
        status: RfqStatus.ISSUED,
        issuedAt: new Date(),
        lines: {
          create: pr.lines.map((l) => ({
            materialId: l.materialId,
            quantity: l.quantity,
            uom: l.material.uom,
          })),
        },
        invitations: {
          create: supplierOrgIds.map((id) => ({ organizationId: id })),
        },
      },
    });

    await tx.purchaseRequisition.update({
      where: { id: prId },
      data: { status: PrStatus.CONVERTED },
    });

    await writeAudit(
      {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'Rfq',
        entityId: rfq.id,
        action: 'ISSUE',
        toState: RfqStatus.ISSUED,
        metadata: { code, prCode: pr.code, invitedSuppliers: supplierOrgIds.length },
        correlationId,
      },
      tx,
    );

    return rfq.id;
  });
}

export interface QuoteLineInput {
  rfqLineId: string;
  unitPrice: number;
  taxRate?: number;
  note?: string;
}

/** SRC-03 — Nhà cung cấp nộp báo giá. Đã nộp thì không sửa được nữa. */
export async function submitQuote(
  user: SessionUser,
  rfqId: string,
  lines: QuoteLineInput[],
  validUntil: Date,
  deliveryDays: number,
  paymentTerms?: string,
): Promise<string> {
  const correlationId = randomUUID();

  return prisma.$transaction(async (tx) => {
    const rfq = await tx.rfq.findUnique({
      where: { id: rfqId },
      include: { lines: true, invitations: true },
    });
    if (!rfq) throw invalid('Không tìm thấy yêu cầu báo giá.');

    const invited = rfq.invitations.some((i) => i.organizationId === user.organizationId);
    if (!invited) throw invalid('Tổ chức của bạn không được mời báo giá cho RFQ này.');

    if (rfq.status !== RfqStatus.ISSUED) {
      throw conflict('Yêu cầu báo giá đã đóng hoặc đã chọn nhà cung cấp.');
    }
    if (rfq.closingAt.getTime() < Date.now()) {
      throw conflict('Đã quá hạn nhận báo giá.');
    }

    const existing = await tx.quote.findUnique({
      where: { rfqId_organizationId: { rfqId, organizationId: user.organizationId } },
    });
    if (existing && existing.status !== QuoteStatus.DRAFT) {
      throw conflict('Báo giá đã nộp không được sửa. Hãy liên hệ bên mời thầu nếu cần làm rõ.');
    }

    const rfqLineIds = new Set(rfq.lines.map((l) => l.id));
    if (lines.length !== rfq.lines.length || lines.some((l) => !rfqLineIds.has(l.rfqLineId))) {
      throw invalid('Báo giá phải điền đủ và đúng các dòng của yêu cầu báo giá.');
    }
    if (lines.some((l) => l.unitPrice <= 0)) {
      throw invalid('Đơn giá phải lớn hơn 0.');
    }

    const qtyByLine = new Map(rfq.lines.map((l) => [l.id, num(l.quantity)]));
    const total = lines.reduce((sum, l) => {
      const qty = qtyByLine.get(l.rfqLineId) ?? 0;
      const tax = l.taxRate ?? BUSINESS_PARAMS.defaultTaxRate;
      return sum + qty * l.unitPrice * (1 + tax);
    }, 0);

    const code = await nextDocCode(tx, 'BG', { organizationId: user.organizationId });

    const quote = await tx.quote.create({
      data: {
        code,
        rfqId,
        organizationId: user.organizationId,
        status: QuoteStatus.SUBMITTED,
        validUntil,
        deliveryDays,
        paymentTerms,
        totalValue: new Prisma.Decimal(total),
        submittedAt: new Date(),
        lines: {
          create: lines.map((l) => {
            const rfqLine = rfq.lines.find((x) => x.id === l.rfqLineId)!;
            return {
              rfqLineId: l.rfqLineId,
              materialId: rfqLine.materialId,
              unitPrice: new Prisma.Decimal(l.unitPrice),
              taxRate: new Prisma.Decimal(l.taxRate ?? BUSINESS_PARAMS.defaultTaxRate),
              note: l.note,
            };
          }),
        },
      },
    });

    await writeAudit(
      {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'Quote',
        entityId: quote.id,
        action: 'SUBMIT',
        toState: QuoteStatus.SUBMITTED,
        metadata: { code, rfqCode: rfq.code, totalValue: total },
        correlationId,
      },
      tx,
    );

    return quote.id;
  });
}

/** SRC-05 — Chọn nhà cung cấp trúng thầu. Bắt buộc có lý do để kiểm toán. */
export async function awardRfq(
  user: SessionUser,
  rfqId: string,
  quoteId: string,
  reason: string,
): Promise<string> {
  if (!reason.trim()) throw invalid('Phải nhập lý do lựa chọn nhà cung cấp.');
  const correlationId = randomUUID();

  return prisma.$transaction(async (tx) => {
    const rfq = await tx.rfq.findFirst({
      where: { id: rfqId, organizationId: user.organizationId },
      include: { quotes: true },
    });
    if (!rfq) throw invalid('Không tìm thấy yêu cầu báo giá.');
    if (rfq.status === RfqStatus.AWARDED) {
      throw conflict('Yêu cầu báo giá này đã chọn nhà cung cấp.');
    }

    const winner = rfq.quotes.find((q) => q.id === quoteId);
    if (!winner) throw invalid('Báo giá được chọn không thuộc yêu cầu báo giá này.');
    if (winner.status !== QuoteStatus.SUBMITTED) {
      throw conflict('Chỉ chọn được báo giá đã nộp hợp lệ.');
    }

    const award = await tx.award.create({
      data: { rfqId, quoteId, awardedById: user.id, reason },
    });

    await tx.quote.update({ where: { id: quoteId }, data: { status: QuoteStatus.WON } });
    await tx.quote.updateMany({
      where: { rfqId, id: { not: quoteId } },
      data: { status: QuoteStatus.LOST },
    });
    await tx.rfq.update({ where: { id: rfqId }, data: { status: RfqStatus.AWARDED } });

    await writeAudit(
      {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'Award',
        entityId: award.id,
        action: 'AWARD',
        toState: RfqStatus.AWARDED,
        reason,
        metadata: {
          rfqCode: rfq.code,
          winningQuote: winner.code,
          competingQuotes: rfq.quotes.length,
        },
        correlationId,
      },
      tx,
    );

    return award.id;
  });
}
