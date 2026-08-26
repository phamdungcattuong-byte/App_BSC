import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { formatVnd, formatDate } from '@/lib/money';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { StatusBadge } from '@/components/status-badge';

export const metadata: Metadata = { title: 'Hóa đơn' };

export default async function InvoiceListPage() {
  const user = await requirePermission('invoice', 'view');
  const isSupplier = user.organization.type === 'SUPPLIER';

  const invoices = await prisma.invoice.findMany({
    where: isSupplier
      ? { supplierOrgId: user.organizationId }
      : { buyerOrgId: user.organizationId },
    include: {
      po: { select: { id: true, code: true } },
      supplierOrg: { select: { name: true } },
      matchResult: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const exceptions = invoices.filter((i) => i.status === 'EXCEPTION').length;

  return (
    <>
      <PageHeader
        title="Hóa đơn"
        description="Hóa đơn chỉ được ghi sổ khi đối chiếu ba chiều đơn hàng, phiếu nhận và hóa đơn đã khớp."
      />

      {exceptions > 0 ? (
        <div className="card mb-4 border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">
            Có <strong>{exceptions}</strong> hóa đơn đang sai lệch đối chiếu ba chiều và bị chặn ghi
            sổ.
          </p>
        </div>
      ) : null}

      <div className="card overflow-hidden">
        {invoices.length === 0 ? (
          <EmptyState
            title="Chưa có hóa đơn nào"
            description="Hóa đơn được tiếp nhận từ màn hình chi tiết đơn hàng, sau khi đã có phiếu nhận hàng."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Số hóa đơn</th>
                  <th>Đơn hàng</th>
                  <th>Nhà cung cấp</th>
                  <th>Ngày</th>
                  <th className="num">Tổng tiền</th>
                  <th>Đối chiếu</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <Link href={`/hoa-don/${inv.id}`} className="font-mono text-navy-700 underline">
                        {inv.code}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/don-hang/${inv.po.id}`} className="font-mono text-xs underline">
                        {inv.po.code}
                      </Link>
                    </td>
                    <td>{inv.supplierOrg.name}</td>
                    <td>{formatDate(inv.issueDate)}</td>
                    <td className="num font-medium">{formatVnd(inv.grandTotal)}</td>
                    <td>{inv.matchResult ? <StatusBadge status={inv.matchResult.outcome} /> : '—'}</td>
                    <td>
                      <StatusBadge status={inv.status} />
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
