import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { formatDateTime } from '@/lib/money';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { StatusBadge } from '@/components/status-badge';

export const metadata: Metadata = { title: 'Báo giá của tôi' };

export default async function QuoteInboxPage() {
  const user = await requirePermission('quote', 'view');

  const invitations = await prisma.rfqInvitation.findMany({
    where: { organizationId: user.organizationId },
    include: {
      rfq: {
        include: {
          organization: { select: { name: true } },
          _count: { select: { lines: true } },
          quotes: { where: { organizationId: user.organizationId }, select: { id: true, status: true } },
        },
      },
    },
    orderBy: { invitedAt: 'desc' },
  });

  return (
    <>
      <PageHeader
        title="Lời mời báo giá"
        description="Yêu cầu báo giá mà bên mua đã gửi tới tổ chức của bạn."
      />

      <div className="card overflow-hidden">
        {invitations.length === 0 ? (
          <EmptyState
            title="Chưa có lời mời báo giá nào"
            description="Khi bên mua phát hành yêu cầu báo giá cho vật tư bạn đang niêm yết, lời mời sẽ hiện ở đây."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã RFQ</th>
                  <th>Bên mời</th>
                  <th className="num">Số dòng</th>
                  <th>Hạn nhận báo giá</th>
                  <th>Trạng thái RFQ</th>
                  <th>Báo giá của bạn</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => {
                  const myQuote = inv.rfq.quotes[0];
                  const expired = inv.rfq.closingAt.getTime() < Date.now();
                  return (
                    <tr key={inv.id}>
                      <td>
                        <Link
                          href={`/bao-gia/${inv.rfq.id}`}
                          className="font-mono text-navy-700 underline"
                        >
                          {inv.rfq.code}
                        </Link>
                      </td>
                      <td>{inv.rfq.organization.name}</td>
                      <td className="num">{inv.rfq._count.lines}</td>
                      <td className={expired ? 'text-red-600' : undefined}>
                        {formatDateTime(inv.rfq.closingAt)}
                      </td>
                      <td>
                        <StatusBadge status={inv.rfq.status} />
                      </td>
                      <td>
                        {myQuote ? (
                          <StatusBadge status={myQuote.status} />
                        ) : (
                          <span className="text-sm text-slate-500">Chưa nộp</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
