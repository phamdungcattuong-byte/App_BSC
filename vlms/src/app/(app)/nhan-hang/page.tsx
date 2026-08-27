import type { Metadata } from 'next';
import { AppLink as Link } from '@/components/app-link';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { formatDateTime, formatQty } from '@/lib/money';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { StatusBadge } from '@/components/status-badge';

export const metadata: Metadata = { title: 'Nhận hàng' };

export default async function GrnListPage() {
  const user = await requirePermission('grn', 'view');
  const isSupplier = user.organization.type === 'SUPPLIER';

  const grns = await prisma.grn.findMany({
    where: isSupplier ? { supplierOrgId: user.organizationId } : { buyerOrgId: user.organizationId },
    include: {
      po: { select: { id: true, code: true } },
      supplierOrg: { select: { name: true } },
      lines: { include: { poLine: { include: { material: true } } } },
    },
    orderBy: { receivedAt: 'desc' },
  });

  return (
    <>
      <PageHeader
        title="Phiếu nhận hàng"
        description="Ghi nhận thực nhận tại công trường, làm căn cứ cho đối chiếu ba chiều."
      />

      {grns.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Chưa có phiếu nhận hàng nào"
            description="Phiếu nhận hàng được tạo từ màn hình chi tiết đơn hàng sau khi nhà cung cấp xác nhận."
            action={
              <Link href="/don-hang" className="btn-ghost">
                Xem đơn hàng
              </Link>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {grns.map((grn) => (
            <div key={grn.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div>
                  <span className="font-mono font-medium text-navy-700">{grn.code}</span>
                  <span className="ml-3 text-sm text-slate-600">
                    Đơn hàng{' '}
                    <Link href={`/don-hang/${grn.po.id}`} className="underline">
                      {grn.po.code}
                    </Link>{' '}
                    · {grn.supplierOrg.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-500">{formatDateTime(grn.receivedAt)}</span>
                  <StatusBadge status={grn.status} />
                </div>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Vật tư</th>
                    <th className="num">Giao</th>
                    <th className="num">Chấp nhận</th>
                    <th className="num">Từ chối</th>
                    <th>Lý do</th>
                  </tr>
                </thead>
                <tbody>
                  {grn.lines.map((l) => (
                    <tr key={l.id}>
                      <td>{l.poLine.material.name}</td>
                      <td className="num">
                        {formatQty(l.deliveredQty)} {l.poLine.material.uom}
                      </td>
                      <td className="num">{formatQty(l.acceptedQty)}</td>
                      <td className="num">{formatQty(l.rejectedQty)}</td>
                      <td>{l.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
