import { randomUUID } from 'node:crypto';
import { GrnStatus, PoStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { nextDocCode } from '@/lib/doc-code';
import { runIdempotent } from '@/lib/idempotency';
import { conflict, dependency, invalid } from '@/lib/errors';
import { BUSINESS_PARAMS } from '@/lib/config/business-params';
import type { SessionUser } from '@/lib/auth';
import { num } from '@/lib/money';

/**
 * COM-03 — Phát hành đơn hàng từ kết quả lựa chọn nhà cung cấp.
 * Dùng Idempotency-Key để hai lần bấm không tạo hai đơn hàng.
 */
export async function issuePurchaseOrder(
  user: SessionUser,
  awardId: string,
  deliveryDate: Date,
  deliveryAddress: string,
  idempotencyKey: string,
): Promise<{ poId: string; replayed: boolean }> {
  if (!deliveryAddress.trim()) throw invalid('Phải nhập địa điểm giao hàng.');
  const correlationId = randomUUID();

  const { resultId, replayed } = await runIdempotent(
    idempotencyKey,
    'purchase-order:issue',
    async (tx) => {
      const award = await tx.award.findUnique({
        where: { id: awardId },
        include: {
          po: true,
          rfq: {
            include: {
              lines: true,
              pr: { include: { lines: true } },
            },
          },
          quote: { include: { lines: true } },
        },
      });

      if (!award) throw invalid('Không tìm thấy kết quả lựa chọn nhà cung cấp.');
      if (award.rfq.organizationId !== user.organizationId) {
        throw invalid('Kết quả lựa chọn này không thuộc tổ chức của bạn.');
      }
      if (award.po) throw conflict('Kết quả lựa chọn này đã phát hành đơn hàng.');

      // Ghép dòng RFQ với dòng báo giá và dòng đề nghị mua để lấy WBS.
      const wbsByMaterial = new Map(award.rfq.pr.lines.map((l) => [l.materialId, l.wbsId]));

      let subtotal = 0;
      let taxTotal = 0;
      const poLines = award.rfq.lines.map((rfqLine) => {
        const quoteLine = award.quote.lines.find((q) => q.rfqLineId === rfqLine.id);
        if (!quoteLine) {
          throw dependency(`Báo giá thiếu dòng cho vật tư trong yêu cầu báo giá.`);
        }
        const wbsId = wbsByMaterial.get(rfqLine.materialId);
        if (!wbsId) throw dependency('Không xác định được hạng mục WBS cho dòng vật tư.');

        const qty = num(rfqLine.quantity);
        const price = num(quoteLine.unitPrice);
        const taxRate = num(quoteLine.taxRate);
        const lineNet = qty * price;

        subtotal += lineNet;
        taxTotal += lineNet * taxRate;

        return {
          materialId: rfqLine.materialId,
          wbsId,
          quantity: rfqLine.quantity,
          unitPrice: quoteLine.unitPrice,
          taxRate: quoteLine.taxRate,
          lineTotal: new Prisma.Decimal(lineNet),
        };
      });

      const code = await nextDocCode(tx, 'PO', { organizationId: user.organizationId });

      const po = await tx.purchaseOrder.create({
        data: {
          code,
          buyerOrgId: user.organizationId,
          supplierOrgId: award.quote.organizationId,
          awardId,
          status: PoStatus.ISSUED,
          issuedAt: new Date(),
          deliveryDate,
          deliveryAddress,
          subtotal: new Prisma.Decimal(subtotal),
          taxTotal: new Prisma.Decimal(taxTotal),
          grandTotal: new Prisma.Decimal(subtotal + taxTotal),
          lines: { create: poLines },
        },
      });

      await writeAudit(
        {
          organizationId: user.organizationId,
          actorId: user.id,
          actorRole: user.role,
          entityType: 'PurchaseOrder',
          entityId: po.id,
          action: 'ISSUE',
          toState: PoStatus.ISSUED,
          metadata: { code, grandTotal: subtotal + taxTotal, lineCount: poLines.length },
          correlationId,
        },
        tx,
      );

      return po.id;
    },
  );

  return { poId: resultId, replayed };
}

/** COM-03 — Nhà cung cấp xác nhận đơn hàng. */
export async function acknowledgePurchaseOrder(user: SessionUser, poId: string): Promise<void> {
  const correlationId = randomUUID();

  await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: poId, supplierOrgId: user.organizationId },
    });
    if (!po) throw invalid('Không tìm thấy đơn hàng của tổ chức bạn.');
    if (po.status !== PoStatus.ISSUED) {
      throw conflict('Chỉ đơn hàng đã phát hành mới cần xác nhận.');
    }

    await tx.purchaseOrder.update({
      where: { id: poId },
      data: { status: PoStatus.ACKNOWLEDGED, acknowledgedAt: new Date() },
    });

    await writeAudit(
      {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'PurchaseOrder',
        entityId: poId,
        action: 'ACKNOWLEDGE',
        fromState: PoStatus.ISSUED,
        toState: PoStatus.ACKNOWLEDGED,
        correlationId,
      },
      tx,
    );
  });
}

export interface GrnLineInput {
  poLineId: string;
  deliveredQty: number;
  acceptedQty: number;
  reason?: string;
}

/**
 * FUL-02 — Ghi nhận nhận hàng tại công trường.
 *
 * Quy tắc chặn cứng (BR-GEN-04): không cho nhận vượt số lượng còn lại của
 * đơn hàng ngoài dung sai đã cấu hình. Người dùng không ghi đè được.
 */
export async function receiveGoods(
  user: SessionUser,
  poId: string,
  lines: GrnLineInput[],
  vehicleNo: string | undefined,
  note: string | undefined,
  idempotencyKey: string,
): Promise<{ grnId: string; replayed: boolean }> {
  if (lines.length === 0) throw invalid('Phiếu nhận hàng phải có ít nhất một dòng.');
  const correlationId = randomUUID();

  const { resultId, replayed } = await runIdempotent(idempotencyKey, 'grn:create', async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: poId, buyerOrgId: user.organizationId },
      include: { lines: { include: { material: true } } },
    });
    if (!po) throw invalid('Không tìm thấy đơn hàng.');
    if (![PoStatus.ACKNOWLEDGED, PoStatus.RECEIVING].includes(po.status as never)) {
      throw conflict('Chỉ nhận hàng cho đơn đã được nhà cung cấp xác nhận.');
    }

    const tolerance = BUSINESS_PARAMS.receiptTolerance.overReceiptRate;
    const violations: string[] = [];

    for (const input of lines) {
      const poLine = po.lines.find((l) => l.id === input.poLineId);
      if (!poLine) throw invalid('Dòng nhận hàng không thuộc đơn hàng này.');
      if (input.deliveredQty < 0 || input.acceptedQty < 0) {
        throw invalid('Số lượng không được âm.');
      }
      if (input.acceptedQty > input.deliveredQty) {
        throw invalid('Số lượng chấp nhận không được lớn hơn số lượng giao.');
      }

      const ordered = num(poLine.quantity);
      const alreadyReceived = num(poLine.receivedQty);
      const maxAllowed = ordered * (1 + tolerance) - alreadyReceived;

      if (input.acceptedQty > maxAllowed + 1e-9) {
        violations.push(
          `${poLine.material.name}: chấp nhận ${input.acceptedQty} ${poLine.material.uom} ` +
            `vượt mức còn nhận được ${maxAllowed.toFixed(3)} ${poLine.material.uom} ` +
            `(đặt ${ordered}, đã nhận ${alreadyReceived}, dung sai ${(tolerance * 100).toFixed(1)}%)`,
        );
      }
    }

    if (violations.length > 0) {
      throw dependency(`Chặn nhận vượt đơn hàng ngoài dung sai. ${violations.join('; ')}`);
    }

    const code = await nextDocCode(tx, 'PNH', { organizationId: user.organizationId });

    // Cập nhật lũy kế đã nhận trên từng dòng đơn hàng.
    for (const input of lines) {
      await tx.poLine.update({
        where: { id: input.poLineId },
        data: { receivedQty: { increment: new Prisma.Decimal(input.acceptedQty) } },
      });
    }

    const refreshed = await tx.poLine.findMany({ where: { poId } });
    const under = BUSINESS_PARAMS.receiptTolerance.underReceiptRate;
    const allComplete = refreshed.every(
      (l) => num(l.receivedQty) >= num(l.quantity) * (1 - under),
    );
    const anyRejected = lines.some((l) => l.deliveredQty - l.acceptedQty > 1e-9);

    const status = anyRejected
      ? GrnStatus.PARTIAL
      : allComplete
        ? GrnStatus.ACCEPTED
        : GrnStatus.PARTIAL;

    const grn = await tx.grn.create({
      data: {
        code,
        poId,
        buyerOrgId: po.buyerOrgId,
        supplierOrgId: po.supplierOrgId,
        status,
        receivedById: user.id,
        vehicleNo,
        note,
        lines: {
          create: lines.map((l) => ({
            poLineId: l.poLineId,
            deliveredQty: new Prisma.Decimal(l.deliveredQty),
            acceptedQty: new Prisma.Decimal(l.acceptedQty),
            rejectedQty: new Prisma.Decimal(l.deliveredQty - l.acceptedQty),
            reason: l.reason,
          })),
        },
      },
    });

    await tx.purchaseOrder.update({
      where: { id: poId },
      data: { status: allComplete ? PoStatus.RECEIVING : PoStatus.RECEIVING },
    });

    await writeAudit(
      {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'Grn',
        entityId: grn.id,
        action: 'RECEIVE',
        toState: status,
        metadata: { code, poCode: po.code, lineCount: lines.length },
        correlationId,
      },
      tx,
    );

    return grn.id;
  });

  return { grnId: resultId, replayed };
}
