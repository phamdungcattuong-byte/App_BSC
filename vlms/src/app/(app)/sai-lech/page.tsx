import type { Metadata } from 'next';
import { AppLink as Link } from '@/components/app-link';
import { DiscrepancyStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatDate, formatQty, formatVnd } from '@/lib/money';
import { DISCREPANCY_TYPE_LABEL, RESOLUTION_LABEL } from '@/features/discrepancy/labels';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { StatusBadge } from '@/components/status-badge';

export const metadata: Metadata = { title: 'Sai lệch nhận hàng' };

export default async function DiscrepancyListPage() {
  const user = await requirePermission('discrepancy', 'view');
  const isSupplier = user.organization.type === 'SUPPLIER';

  const discrepancies = await prisma.discrepancy.findMany({
    where: isSupplier
      ? { supplierOrgId: user.organizationId }
      : { buyerOrgId: user.organizationId },
    include: {
      grn: { select: { code: true } },
      supplierOrg: { select: { name: true } },
      grnLine: { include: { poLine: { include: { material: true } } } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });

  const open = discrepancies.filter((d) => d.status !== DiscrepancyStatus.CLOSED).length;

  return (
    <>
      <PageHeader
        title="Sai lệch nhận hàng"
        description="Mọi chênh lệch giữa hàng giao và hàng nhận được ghi thành hồ sơ riêng. Phiếu nhận hàng gốc không bị sửa."
        actions={
          can(user.role, 'discrepancy', 'create') ? (
            <Link href="/sai-lech/moi" className="btn-primary">
              Ghi nhận sai lệch
            </Link>
          ) : null
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Đang mở
          </p>
          <p
            className={`mt-2 text-2xl font-semibold tabular-nums ${
              open > 0 ? 'text-amber-700' : 'text-navy-800'
            }`}
          >
            {open}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Đã đóng</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-navy-800">
            {discrepancies.length - open}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Tổng giảm trừ đã phát hành
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-navy-800">
            {formatVnd(discrepancies.reduce((sum, d) => sum + Number(d.creditAmount ?? 0), 0))}
          </p>
        </div>
      </div>

      <div className="card overflow-hidden">
        {discrepancies.length === 0 ? (
          <EmptyState
            title="Chưa có sai lệch nào"
            description="Hồ sơ sai lệch được lập tự động khi phiếu nhận hàng có phần bị từ chối, hoặc lập tay từ nút Ghi nhận sai lệch."
            action={
              <Link
                href={can(user.role, 'discrepancy', 'create') ? '/sai-lech/moi' : '/nhan-hang'}
                className="btn-ghost"
              >
                {can(user.role, 'discrepancy', 'create')
                  ? 'Ghi nhận sai lệch'
                  : 'Xem phiếu nhận hàng'}
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Phiếu nhận hàng</th>
                  <th>Vật tư</th>
                  <th>Loại sai lệch</th>
                  <th className="num">Số lượng</th>
                  {!isSupplier ? <th>Nhà cung cấp</th> : null}
                  <th>Ngày ghi nhận</th>
                  <th>Hướng xử lý</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {discrepancies.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/sai-lech/${d.id}`} className="font-mono text-navy-700 underline">
                        {d.code}
                      </Link>
                    </td>
                    <td className="font-mono text-xs">{d.grn.code}</td>
                    <td>{d.grnLine.poLine.material.name}</td>
                    <td>{DISCREPANCY_TYPE_LABEL[d.type]}</td>
                    <td className="num">
                      {formatQty(d.quantity)} {d.grnLine.poLine.material.uom}
                    </td>
                    {!isSupplier ? <td>{d.supplierOrg.name}</td> : null}
                    <td>{formatDate(d.createdAt)}</td>
                    <td>{d.resolution ? RESOLUTION_LABEL[d.resolution] : '—'}</td>
                    <td>
                      <StatusBadge status={d.status} />
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
