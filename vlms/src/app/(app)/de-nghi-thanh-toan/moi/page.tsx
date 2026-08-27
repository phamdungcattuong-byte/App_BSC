import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { formatDate, num } from '@/lib/money';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { PaymentRequestForm } from './request-form';

export const metadata: Metadata = { title: 'Lập đề nghị thanh toán' };

export default async function NewPaymentRequestPage() {
  const user = await requirePermission('paymentRequest', 'create');

  const invoices = await prisma.invoice.findMany({
    where: {
      buyerOrgId: user.organizationId,
      status: 'POSTED',
      // Loại các hóa đơn đã nằm trong đề nghị còn hiệu lực.
      paymentLines: { none: { paymentRequest: { status: { not: 'REJECTED' } } } },
    },
    include: {
      supplierOrg: {
        select: {
          id: true,
          name: true,
          bankAccounts: { where: { status: 'VERIFIED' }, select: { id: true } },
        },
      },
    },
    orderBy: { issueDate: 'asc' },
  });

  return (
    <>
      <PageHeader
        title="Lập đề nghị thanh toán"
        description="Chọn các hóa đơn đã ghi sổ của cùng một nhà cung cấp."
      />

      {invoices.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Không có hóa đơn nào chờ thanh toán"
            description="Hóa đơn phải khớp đối chiếu ba chiều và đã ghi sổ mới xuất hiện ở đây."
          />
        </div>
      ) : (
        <PaymentRequestForm
          invoices={invoices.map((invoice) => ({
            id: invoice.id,
            code: invoice.code,
            supplierId: invoice.supplierOrg.id,
            supplierName: invoice.supplierOrg.name,
            amount: num(invoice.grandTotal),
            issueDate: formatDate(invoice.issueDate),
            hasVerifiedAccount: invoice.supplierOrg.bankAccounts.length > 0,
          }))}
        />
      )}
    </>
  );
}
