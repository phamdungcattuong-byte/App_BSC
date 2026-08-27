import type { Metadata } from 'next';
import { AppLink as Link } from '@/components/app-link';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatVnd, formatDate } from '@/lib/money';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { StatusBadge } from '@/components/status-badge';

export const metadata: Metadata = { title: 'Đề nghị thanh toán' };

export default async function PaymentRequestListPage() {
  const user = await requirePermission('paymentRequest', 'view');
  const isSupplier = user.organization.type === 'SUPPLIER';

  const requests = await prisma.paymentRequest.findMany({
    where: isSupplier
      ? { supplierOrgId: user.organizationId }
      : { buyerOrgId: user.organizationId },
    include: {
      supplierOrg: { select: { name: true } },
      bankAccount: { select: { accountNumber: true, bankName: true } },
      _count: { select: { lines: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <>
      <PageHeader
        title="Đề nghị thanh toán"
        description="Chỉ hóa đơn đã ghi sổ mới được đưa vào đề nghị, và chỉ chi vào tài khoản đã xác minh."
        actions={
          can(user.role, 'paymentRequest', 'create') ? (
            <Link href="/de-nghi-thanh-toan/moi" className="btn-primary">
              Lập đề nghị thanh toán
            </Link>
          ) : null
        }
      />

      <div className="card overflow-hidden">
        {requests.length === 0 ? (
          <EmptyState
            title="Chưa có đề nghị thanh toán nào"
            description="Đề nghị thanh toán được lập từ các hóa đơn đã khớp đối chiếu ba chiều và đã ghi sổ."
            action={
              <Link href="/hoa-don" className="btn-ghost">
                Xem hóa đơn
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Nhà cung cấp</th>
                  <th className="num">Số hóa đơn</th>
                  <th className="num">Số tiền</th>
                  <th>Tài khoản nhận</th>
                  <th>Hạn thanh toán</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <Link
                        href={`/de-nghi-thanh-toan/${request.id}`}
                        className="font-mono text-navy-700 underline"
                      >
                        {request.code}
                      </Link>
                    </td>
                    <td>{request.supplierOrg.name}</td>
                    <td className="num">{request._count.lines}</td>
                    <td className="num font-medium">{formatVnd(request.totalAmount)}</td>
                    <td className="font-mono text-xs">
                      {request.bankAccount.bankName} ····{request.bankAccount.accountNumber.slice(-4)}
                    </td>
                    <td>{formatDate(request.dueDate)}</td>
                    <td>
                      <StatusBadge status={request.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
