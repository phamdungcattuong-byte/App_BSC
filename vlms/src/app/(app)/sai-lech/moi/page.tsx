import type { Metadata } from 'next';
import { AppLink as Link } from '@/components/app-link';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { formatDate, formatQty, num } from '@/lib/money';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { DiscrepancyForm } from './discrepancy-form';

export const metadata: Metadata = { title: 'Ghi nhận sai lệch' };

export default async function NewDiscrepancyPage() {
  const user = await requirePermission('discrepancy', 'create');

  const lines = await prisma.grnLine.findMany({
    where: { grn: { buyerOrgId: user.organizationId } },
    include: {
      grn: { select: { code: true, receivedAt: true, supplierOrg: { select: { name: true } } } },
      poLine: { include: { material: true } },
    },
    orderBy: { grn: { receivedAt: 'desc' } },
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="Ghi nhận sai lệch nhận hàng"
        description="Chọn dòng nhận hàng có vấn đề. Phiếu nhận hàng gốc giữ nguyên, sai lệch được lập thành hồ sơ riêng."
      />

      {lines.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Chưa có dòng nhận hàng nào"
            description="Phiếu nhận hàng được lập từ màn hình chi tiết đơn hàng."
            action={
              <Link href="/don-hang" className="btn-ghost">
                Xem đơn hàng
              </Link>
            }
          />
        </div>
      ) : (
        <DiscrepancyForm
          lines={lines.map((line) => ({
            id: line.id,
            label: `${line.grn.code} — ${line.poLine.material.name} (${line.grn.supplierOrg.name}, ${formatDate(
              line.grn.receivedAt,
            )})`,
            uom: line.poLine.material.uom,
            deliveredQty: num(line.deliveredQty),
            acceptedQty: num(line.acceptedQty),
            summary: `Giao ${formatQty(line.deliveredQty)} ${line.poLine.material.uom}, chấp nhận ${formatQty(
              line.acceptedQty,
            )}, từ chối ${formatQty(line.rejectedQty)}`,
          }))}
        />
      )}
    </>
  );
}
