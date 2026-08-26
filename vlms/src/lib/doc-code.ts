import type { Prisma } from '@prisma/client';

/**
 * Sinh mã chứng từ dạng PREFIX-YYYY-NNNN theo từng tổ chức.
 * Đếm trong cùng transaction để tránh trùng khi có nhiều người thao tác.
 */
export async function nextDocCode(
  tx: Prisma.TransactionClient,
  entity: 'PR' | 'RFQ' | 'BG' | 'PO' | 'PNH' | 'HD',
  scope: { organizationId: string },
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${entity}-${year}-`;

  const counters: Record<typeof entity, () => Promise<number>> = {
    PR: () => tx.purchaseRequisition.count({ where: { organizationId: scope.organizationId } }),
    RFQ: () => tx.rfq.count({ where: { organizationId: scope.organizationId } }),
    BG: () => tx.quote.count({ where: { organizationId: scope.organizationId } }),
    PO: () => tx.purchaseOrder.count({ where: { buyerOrgId: scope.organizationId } }),
    PNH: () => tx.grn.count({ where: { buyerOrgId: scope.organizationId } }),
    HD: () => tx.invoice.count({ where: { supplierOrgId: scope.organizationId } }),
  };

  const count = await counters[entity]();
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}
