import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatVnd, formatDate } from '@/lib/money';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { StatusBadge } from '@/components/status-badge';

export const metadata: Metadata = { title: 'Đề nghị mua' };

export default async function RequisitionListPage() {
  const user = await requirePermission('requisition', 'view');

  const items = await prisma.purchaseRequisition.findMany({
    where: { organizationId: user.organizationId },
    include: { project: true, _count: { select: { lines: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <>
      <PageHeader
        title="Đề nghị mua"
        description="Yêu cầu mua vật tư gắn dự án và hạng mục WBS, trình duyệt theo hạn mức."
        actions={
          can(user.role, 'requisition', 'create') ? (
            <Link href="/de-nghi-mua/moi" className="btn-primary">
              Tạo đề nghị mua
            </Link>
          ) : null
        }
      />

      <div className="card overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            title="Chưa có đề nghị mua nào"
            description="Bắt đầu bằng cách chọn vật liệu trong danh mục rồi tạo đề nghị mua."
            action={
              can(user.role, 'requisition', 'create') ? (
                <Link href="/vat-lieu" className="btn-ghost">
                  Xem danh mục vật liệu
                </Link>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Dự án</th>
                  <th className="num">Số dòng</th>
                  <th className="num">Giá trị ước tính</th>
                  <th>Cần hàng trước</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {items.map((pr) => (
                  <tr key={pr.id}>
                    <td>
                      <Link href={`/de-nghi-mua/${pr.id}`} className="font-mono text-navy-700 underline">
                        {pr.code}
                      </Link>
                    </td>
                    <td>{pr.project.name}</td>
                    <td className="num">{pr._count.lines}</td>
                    <td className="num font-medium">{formatVnd(pr.totalValue)}</td>
                    <td>{formatDate(pr.neededBy)}</td>
                    <td>
                      <StatusBadge status={pr.status} />
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
