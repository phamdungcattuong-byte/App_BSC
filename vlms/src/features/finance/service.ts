import { randomUUID } from 'node:crypto';
import { InvoiceStatus, MatchOutcome, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { nextDocCode } from '@/lib/doc-code';
import { runIdempotent } from '@/lib/idempotency';
import { conflict, invalid } from '@/lib/errors';
import { BUSINESS_PARAMS } from '@/lib/config/business-params';
import type { SessionUser } from '@/lib/auth';
import { num } from '@/lib/money';

export interface InvoiceLineInput {
  poLineId: string;
  quantity: number;
  unitPrice: number;
}

export interface MatchDetailRow {
  material: string;
  invoicedQty: number;
  receivedQty: number;
  orderedQty: number;
  invoicePrice: number;
  poPrice: number;
  issues: string[];
}

/**
 * FIN-01 — Tiếp nhận hóa đơn và đối chiếu ba chiều PO - GRN - Invoice.
 *
 * Kết quả đối chiếu là bản ghi bất biến. Lệch ngoài dung sai thì hóa đơn
 * chuyển sang EXCEPTION và không được ghi sổ cho đến khi xử lý.
 */
export async function receiveInvoiceAndMatch(
  user: SessionUser,
  poId: string,
  invoiceCode: string,
  issueDate: Date,
  lines: InvoiceLineInput[],
  idempotencyKey: string,
): Promise<{ invoiceId: string; outcome: MatchOutcome; replayed: boolean }> {
  if (!invoiceCode.trim()) throw invalid('Phải nhập số hóa đơn.');
  if (lines.length === 0) throw invalid('Hóa đơn phải có ít nhất một dòng.');

  const correlationId = randomUUID();
  let outcome: MatchOutcome = MatchOutcome.MATCHED;

  const { resultId, replayed } = await runIdempotent(
    idempotencyKey,
    'invoice:receive',
    async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id: poId },
        include: { lines: { include: { material: true } }, grns: true },
      });
      if (!po) throw invalid('Không tìm thấy đơn hàng.');

      // Hóa đơn do nhà cung cấp phát hành; kế toán bên mua cũng có thể nhập hộ.
      const isSupplierSide = po.supplierOrgId === user.organizationId;
      const isBuyerSide = po.buyerOrgId === user.organizationId;
      if (!isSupplierSide && !isBuyerSide) {
        throw invalid('Đơn hàng không thuộc tổ chức của bạn.');
      }

      const duplicate = await tx.invoice.findUnique({
        where: {
          supplierOrgId_code: { supplierOrgId: po.supplierOrgId, code: invoiceCode.trim() },
        },
      });
      if (duplicate) {
        throw conflict(`Số hóa đơn ${invoiceCode} đã tồn tại cho nhà cung cấp này.`);
      }

      const { priceRate, quantityRate, absoluteAmount } = BUSINESS_PARAMS.threeWayMatchTolerance;
      const detail: MatchDetailRow[] = [];
      let subtotal = 0;
      let taxTotal = 0;

      const hasAnyGrn = po.grns.length > 0;

      for (const line of lines) {
        const poLine = po.lines.find((l) => l.id === line.poLineId);
        if (!poLine) throw invalid('Dòng hóa đơn không thuộc đơn hàng này.');
        if (line.quantity <= 0 || line.unitPrice < 0) {
          throw invalid('Số lượng và đơn giá trên hóa đơn không hợp lệ.');
        }

        const orderedQty = num(poLine.quantity);
        const receivedQty = num(poLine.receivedQty);
        const poPrice = num(poLine.unitPrice);
        const taxRate = num(poLine.taxRate);
        const issues: string[] = [];

        // So khớp số lượng với số đã thực nhận (GRN).
        if (!hasAnyGrn) {
          issues.push('Chưa có phiếu nhận hàng cho đơn hàng này');
          outcome = MatchOutcome.MISSING_GRN;
        } else if (line.quantity > receivedQty * (1 + quantityRate) + 1e-9) {
          issues.push(
            `Số lượng hóa đơn ${line.quantity} vượt số đã nhận ${receivedQty}`,
          );
          if (outcome === MatchOutcome.MATCHED) outcome = MatchOutcome.QTY_MISMATCH;
        }

        // So khớp số lượng với đơn hàng.
        if (line.quantity > orderedQty * (1 + priceRate) + 1e-9) {
          issues.push(`Số lượng hóa đơn vượt số lượng đặt ${orderedQty}`);
          outcome = MatchOutcome.OVER_PO;
        }

        // So khớp đơn giá với đơn hàng.
        const priceDiff = Math.abs(line.unitPrice - poPrice);
        if (poPrice > 0 && priceDiff / poPrice > priceRate) {
          issues.push(
            `Đơn giá hóa đơn ${line.unitPrice} lệch quá ${(priceRate * 100).toFixed(1)}% so với đơn hàng ${poPrice}`,
          );
          if (outcome === MatchOutcome.MATCHED) outcome = MatchOutcome.PRICE_MISMATCH;
        }

        const net = line.quantity * line.unitPrice;
        subtotal += net;
        taxTotal += net * taxRate;

        detail.push({
          material: poLine.material.name,
          invoicedQty: line.quantity,
          receivedQty,
          orderedQty,
          invoicePrice: line.unitPrice,
          poPrice,
          issues,
        });
      }

      // Sai lệch tổng tiền rất nhỏ vẫn coi là khớp.
      const grandTotal = subtotal + taxTotal;
      if (outcome === MatchOutcome.PRICE_MISMATCH) {
        const poValue = num(po.grandTotal);
        if (Math.abs(grandTotal - poValue) <= absoluteAmount) {
          outcome = MatchOutcome.MATCHED;
          for (const row of detail) row.issues = [];
        }
      }

      const status =
        outcome === MatchOutcome.MATCHED ? InvoiceStatus.MATCHED : InvoiceStatus.EXCEPTION;

      const invoice = await tx.invoice.create({
        data: {
          code: invoiceCode.trim(),
          poId,
          buyerOrgId: po.buyerOrgId,
          supplierOrgId: po.supplierOrgId,
          status,
          issueDate,
          subtotal: new Prisma.Decimal(subtotal),
          taxTotal: new Prisma.Decimal(taxTotal),
          grandTotal: new Prisma.Decimal(grandTotal),
          lines: {
            create: lines.map((l) => {
              const poLine = po.lines.find((x) => x.id === l.poLineId)!;
              return {
                poLineId: l.poLineId,
                quantity: new Prisma.Decimal(l.quantity),
                unitPrice: new Prisma.Decimal(l.unitPrice),
                taxRate: poLine.taxRate,
                lineTotal: new Prisma.Decimal(l.quantity * l.unitPrice),
              };
            }),
          },
          matchResult: {
            create: {
              outcome,
              detail: detail as unknown as Prisma.InputJsonValue,
            },
          },
        },
      });

      for (const l of lines) {
        await tx.poLine.update({
          where: { id: l.poLineId },
          data: { invoicedQty: { increment: new Prisma.Decimal(l.quantity) } },
        });
      }

      await writeAudit(
        {
          organizationId: user.organizationId,
          actorId: user.id,
          actorRole: user.role,
          entityType: 'Invoice',
          entityId: invoice.id,
          action: 'THREE_WAY_MATCH',
          toState: status,
          metadata: {
            invoiceCode: invoice.code,
            poCode: po.code,
            outcome,
            grandTotal,
            pendingDecision: BUSINESS_PARAMS.pendingDecision,
          },
          correlationId,
        },
        tx,
      );

      return invoice.id;
    },
  );

  return { invoiceId: resultId, outcome, replayed };
}

/** FIN-01 — Ghi sổ hóa đơn. Chỉ cho phép khi đối chiếu ba chiều đã khớp. */
export async function postInvoice(user: SessionUser, invoiceId: string): Promise<void> {
  const correlationId = randomUUID();

  await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, buyerOrgId: user.organizationId },
      include: { matchResult: true },
    });
    if (!invoice) throw invalid('Không tìm thấy hóa đơn.');
    if (invoice.status === InvoiceStatus.POSTED) {
      throw conflict('Hóa đơn đã được ghi sổ.');
    }
    // BR-GEN-04: không đưa vào thanh toán khi đối chiếu ba chiều chưa đạt.
    if (invoice.status !== InvoiceStatus.MATCHED) {
      throw conflict(
        'Hóa đơn chưa khớp đối chiếu ba chiều nên không được ghi sổ. Hãy xử lý sai lệch trước.',
      );
    }

    await tx.invoice.update({ where: { id: invoiceId }, data: { status: InvoiceStatus.POSTED } });

    await writeAudit(
      {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'Invoice',
        entityId: invoiceId,
        action: 'POST',
        fromState: InvoiceStatus.MATCHED,
        toState: InvoiceStatus.POSTED,
        correlationId,
      },
      tx,
    );
  });
}

export function isMatchDetail(value: unknown): value is MatchDetailRow[] {
  return Array.isArray(value);
}
