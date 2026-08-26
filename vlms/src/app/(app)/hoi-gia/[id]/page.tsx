import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatVnd, formatDateTime, formatQty, num } from '@/lib/money';
import { Flash } from '@/components/flash';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { AwardPanel } from './award-panel';

export const metadata: Metadata = { title: 'Chi tiết yêu cầu báo giá' };

export default async function RfqDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tb?: string }>;
}) {
  const user = await requirePermission('rfq', 'view');
  const { id } = await params;
  const { tb } = await searchParams;

  const rfq = await prisma.rfq.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      pr: { select: { id: true, code: true } },
      lines: { include: { material: true } },
      invitations: { include: { organization: { select: { name: true } } } },
      quotes: {
        where: { status: { in: ['SUBMITTED', 'WON', 'LOST'] } },
        include: { organization: { select: { name: true } }, lines: true },
        orderBy: { totalValue: 'asc' },
      },
      award: { include: { quote: { include: { organization: true } }, po: true } },
    },
  });

  if (!rfq) notFound();

  // Tổng giá trị đã gồm thuế của từng báo giá, để so sánh trên cùng mặt bằng.
  const quoteTotals = rfq.quotes.map((q) => {
    const total = q.lines.reduce((sum, ql) => {
      const rfqLine = rfq.lines.find((l) => l.id === ql.rfqLineId);
      const qty = rfqLine ? num(rfqLine.quantity) : 0;
      return sum + qty * num(ql.unitPrice) * (1 + num(ql.taxRate));
    }, 0);
    return { quoteId: q.id, total };
  });
  const cheapest = quoteTotals.length
    ? quoteTotals.reduce((a, b) => (b.total < a.total ? b : a))
    : null;

  const canAward =
    rfq.status === 'ISSUED' && rfq.quotes.length > 0 && can(user.role, 'award', 'create');

  return (
    <>
      <PageHeader
        title={`Yêu cầu báo giá ${rfq.code}`}
        description={`Từ đề nghị mua ${rfq.pr.code} · Hạn nhận báo giá ${formatDateTime(rfq.closingAt)}`}
        actions={
          rfq.award && !rfq.award.po && can(user.role, 'purchaseOrder', 'create') ? (
            <Link href={`/don-hang/moi?award=${rfq.award.id}`} className="btn-accent">
              Phát hành đơn hàng
            </Link>
          ) : rfq.award?.po ? (
            <Link href={`/don-hang/${rfq.award.po.id}`} className="btn-ghost">
              Xem đơn hàng
            </Link>
          ) : null
        }
      />

      <Flash code={tb} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge status={rfq.status} />
        <span className="text-sm text-slate-600">
          Mời {rfq.invitations.length} nhà cung cấp · Nhận {rfq.quotes.length} báo giá
        </span>
      </div>

      {rfq.award ? (
        <div className="card mb-4 border-emerald-200 bg-emerald-50 p-4">
          <h2 className="text-sm font-semibold text-emerald-900">Kết quả lựa chọn</h2>
          <p className="mt-1 text-sm text-emerald-800">
            Trúng thầu: <strong>{rfq.award.quote.organization.name}</strong>
          </p>
          <p className="mt-1 text-sm text-emerald-800">Lý do: {rfq.award.reason}</p>
        </div>
      ) : null}

      <div className="card mb-4 overflow-hidden">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
          So sánh báo giá
        </h2>
        {rfq.quotes.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            Chưa có nhà cung cấp nào nộp báo giá.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="min-w-[200px]">Vật tư</th>
                  <th className="num">Số lượng</th>
                  {rfq.quotes.map((q) => (
                    <th key={q.id} className="num min-w-[150px]">
                      {q.organization.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rfq.lines.map((line) => {
                  const prices = rfq.quotes.map((q) => {
                    const ql = q.lines.find((x) => x.rfqLineId === line.id);
                    return ql ? num(ql.unitPrice) : null;
                  });
                  const valid = prices.filter((p): p is number => p !== null);
                  const min = valid.length ? Math.min(...valid) : null;

                  return (
                    <tr key={line.id}>
                      <td>
                        <span className="font-medium text-slate-800">{line.material.name}</span>
                        <span className="block font-mono text-xs text-slate-500">
                          {line.material.code}
                        </span>
                      </td>
                      <td className="num">
                        {formatQty(line.quantity)} {line.uom}
                      </td>
                      {prices.map((p, i) => (
                        <td
                          key={rfq.quotes[i].id}
                          className={`num ${p !== null && p === min ? 'font-semibold text-emerald-700' : ''}`}
                        >
                          {p === null ? '—' : formatVnd(p)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} className="px-3 py-2 text-right font-medium text-slate-700">
                    Tổng đã gồm thuế
                  </td>
                  {rfq.quotes.map((q) => {
                    const t = quoteTotals.find((x) => x.quoteId === q.id)?.total ?? 0;
                    const best = cheapest?.quoteId === q.id;
                    return (
                      <td
                        key={q.id}
                        className={`num px-3 py-2 font-semibold ${best ? 'text-emerald-700' : 'text-navy-800'}`}
                      >
                        {formatVnd(t)}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td colSpan={2} className="px-3 py-2 text-right text-sm text-slate-600">
                    Thời gian giao
                  </td>
                  {rfq.quotes.map((q) => (
                    <td key={q.id} className="num px-3 py-2 text-sm text-slate-600">
                      {q.deliveryDays} ngày
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {canAward ? (
        <div className="card p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Chọn nhà cung cấp</h2>
          <AwardPanel
            rfqId={rfq.id}
            options={rfq.quotes.map((q) => ({
              quoteId: q.id,
              supplierName: q.organization.name,
              total: quoteTotals.find((x) => x.quoteId === q.id)?.total ?? 0,
              isCheapest: cheapest?.quoteId === q.id,
            }))}
          />
        </div>
      ) : null}
    </>
  );
}
