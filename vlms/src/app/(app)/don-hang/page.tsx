import type { Metadata } from 'next';
import { AppLink as Link } from '@/components/app-link';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { formatVnd, formatDate } from '@/lib/money';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { StatusBadge } from '@/components/status-badge';

export const metadata: Metadata = { title: 'Đơn hàng' };

export default async function PurchaseOrderListPage() {
  const user = await requirePermission('purchaseOrder', 'view');
  const isSupplier = user.organization.type === 'SUPPLIER';

  const orders = await prisma.purchaseOrder.findMany({
    where: isSupplier
      ? { supplierOrgId: user.organizationId }
      : { buyerOrgId: user.organizationId },
    include: {
      buyerOrg: { select: { name: true } },
      supplierOrg: { select: { name: true } },
      _count: { select: { lines: true, grns: true, invoices: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <>
      <PageHeader
        title="Đơn hàng"
        description={
          isSupplier
            ? 'Đơn hàng bên mua đã phát hành cho tổ chức của bạn.'
            : 'Đơn hàng phát hành từ kết quả lựa chọn nhà cung cấp.'
        }
      />

      <div className="card overflow-hidden">
        {orders.length === 0 ? (
          <EmptyState
            title="Chưa có đơn hàng nào"
            description={
              isSupplier
                ? 'Đơn hàng sẽ xuất hiện sau khi bạn trúng thầu một yêu cầu báo giá.'
                : 'Đơn hàng được phát hành từ kết quả lựa chọn nhà cung cấp của một yêu cầu báo giá.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>{isSupplier ? 'Bên mua' : 'Nhà cung cấp'}</th>
                  <th className="num">Số dòng</th>
                  <th className="num">Tổng tiền</th>
                  <th>Giao trước</th>
                  <th className="num">Phiếu nhận</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((po) => (
                  <tr key={po.id}>
                    <td>
                      <Link href={`/don-hang/${po.id}`} className="font-mono text-navy-700 underline">
                        {po.code}
                      </Link>
                    </td>
                    <td>{isSupplier ? po.buyerOrg.name : po.supplierOrg.name}</td>
                    <td className="num">{po._count.lines}</td>
                    <td className="num font-medium">{formatVnd(po.grandTotal)}</td>
                    <td>{formatDate(po.deliveryDate)}</td>
                    <td className="num">{po._count.grns}</td>
                    <td>
                      <StatusBadge status={po.status} />
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
