import type { Metadata } from 'next';
import { AppLink as Link } from '@/components/app-link';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { formatDateTime } from '@/lib/money';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { StatusBadge } from '@/components/status-badge';

export const metadata: Metadata = { title: 'Hỏi giá' };

export default async function RfqListPage() {
  const user = await requirePermission('rfq', 'view');

  const items = await prisma.rfq.findMany({
    where: { organizationId: user.organizationId },
    include: {
      pr: { select: { code: true } },
      _count: { select: { invitations: true, quotes: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <>
      <PageHeader
        title="Yêu cầu báo giá"
        description="Phát hành yêu cầu tới nhiều nhà cung cấp cùng lúc và so sánh trên cùng mặt bằng."
      />

      <div className="card overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            title="Chưa có yêu cầu báo giá nào"
            description="Yêu cầu báo giá được tạo từ một đề nghị mua đã được phê duyệt."
            action={
              <Link href="/de-nghi-mua" className="btn-ghost">
                Xem đề nghị mua
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã RFQ</th>
                  <th>Từ đề nghị mua</th>
                  <th className="num">NCC được mời</th>
                  <th className="num">Báo giá nhận được</th>
                  <th>Hạn nhận báo giá</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {items.map((rfq) => (
                  <tr key={rfq.id}>
                    <td>
                      <Link href={`/hoi-gia/${rfq.id}`} className="font-mono text-navy-700 underline">
                        {rfq.code}
                      </Link>
                    </td>
                    <td className="font-mono text-xs">{rfq.pr.code}</td>
                    <td className="num">{rfq._count.invitations}</td>
                    <td className="num">{rfq._count.quotes}</td>
                    <td>{formatDateTime(rfq.closingAt)}</td>
                    <td>
                      <StatusBadge status={rfq.status} />
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
