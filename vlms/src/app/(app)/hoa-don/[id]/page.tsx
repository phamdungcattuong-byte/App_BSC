import type { Metadata } from 'next';
import { AppLink as Link } from '@/components/app-link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatVnd, formatDate, formatQty, num } from '@/lib/money';
import { isMatchDetail, type MatchDetailRow } from '@/features/finance/service';
import { Flash } from '@/components/flash';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { PostInvoicePanel } from './post-panel';

export const metadata: Metadata = { title: 'Chi tiết hóa đơn' };

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tb?: string }>;
}) {
  const user = await requirePermission('invoice', 'view');
  const { id } = await params;
  const { tb } = await searchParams;

  const invoice = await prisma.invoice.findFirst({
    where: {
      id,
      OR: [{ buyerOrgId: user.organizationId }, { supplierOrgId: user.organizationId }],
    },
    include: {
      po: { select: { id: true, code: true, grandTotal: true } },
      supplierOrg: { select: { name: true } },
      lines: true,
      matchResult: true,
    },
  });

  if (!invoice) notFound();

  const detail: MatchDetailRow[] =
    invoice.matchResult && isMatchDetail(invoice.matchResult.detail)
      ? invoice.matchResult.detail
      : [];

  const showPostPanel =
    invoice.buyerOrgId === user.organizationId && can(user.role, 'invoice', 'submit');
  const canPost = showPostPanel && invoice.status === 'MATCHED';
  const postReason =
    invoice.status === 'POSTED'
      ? 'Hóa đơn đã được ghi sổ.'
      : invoice.status === 'EXCEPTION'
        ? 'Đối chiếu ba chiều chưa đạt nên hóa đơn bị chặn ghi sổ. Xử lý sai lệch với nhà cung cấp trước.'
        : 'Đối chiếu ba chiều đã khớp, hóa đơn sẵn sàng ghi sổ.';

  return (
    <>
      <PageHeader
        title={`Hóa đơn ${invoice.code}`}
        description={`${invoice.supplierOrg.name} · Đơn hàng ${invoice.po.code} · Phát hành ${formatDate(invoice.issueDate)}`}
        actions={
          <Link href={`/don-hang/${invoice.po.id}`} className="btn-ghost">
            Xem đơn hàng
          </Link>
        }
      />

      <Flash code={tb} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge status={invoice.status} />
        {invoice.matchResult ? <StatusBadge status={invoice.matchResult.outcome} /> : null}
        <span className="text-sm text-slate-600">
          Tổng hóa đơn {formatVnd(invoice.grandTotal)} · Tổng đơn hàng{' '}
          {formatVnd(invoice.po.grandTotal)}
        </span>
      </div>

      <div className="card mb-4 overflow-hidden">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
          Kết quả đối chiếu ba chiều
        </h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Vật tư</th>
                <th className="num">Đặt</th>
                <th className="num">Đã nhận</th>
                <th className="num">Hóa đơn</th>
                <th className="num">Giá đơn hàng</th>
                <th className="num">Giá hóa đơn</th>
                <th>Sai lệch</th>
              </tr>
            </thead>
            <tbody>
              {detail.map((row, i) => (
                <tr key={i} className={row.issues.length > 0 ? 'bg-red-50' : undefined}>
                  <td className="font-medium text-slate-800">{row.material}</td>
                  <td className="num">{row.orderedQty.toLocaleString('vi-VN')}</td>
                  <td className="num">{row.receivedQty.toLocaleString('vi-VN')}</td>
                  <td className="num">{row.invoicedQty.toLocaleString('vi-VN')}</td>
                  <td className="num">{formatVnd(row.poPrice)}</td>
                  <td className="num">{formatVnd(row.invoicePrice)}</td>
                  <td>
                    {row.issues.length === 0 ? (
                      <span className="text-emerald-700">Khớp</span>
                    ) : (
                      <ul className="list-inside list-disc text-red-700">
                        {row.issues.map((issue, j) => (
                          <li key={j}>{issue}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mb-4 overflow-hidden">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
          Chi tiết hóa đơn
        </h2>
        <table className="table">
          <thead>
            <tr>
              <th className="num">Số lượng</th>
              <th className="num">Đơn giá</th>
              <th className="num">Thuế suất</th>
              <th className="num">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l) => (
              <tr key={l.id}>
                <td className="num">{formatQty(l.quantity)}</td>
                <td className="num">{formatVnd(l.unitPrice)}</td>
                <td className="num">thuế {(num(l.taxRate) * 100).toFixed(0)}%</td>
                <td className="num font-medium">{formatVnd(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="px-3 py-2 text-right text-slate-600">
                Cộng chưa thuế
              </td>
              <td className="num px-3 py-2">{formatVnd(invoice.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="px-3 py-2 text-right text-slate-600">
                Thuế GTGT
              </td>
              <td className="num px-3 py-2">{formatVnd(invoice.taxTotal)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="px-3 py-2 text-right font-medium text-slate-700">
                Tổng thanh toán
              </td>
              <td className="num px-3 py-2 text-base font-semibold text-navy-800">
                {formatVnd(invoice.grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {showPostPanel ? (
        <div className="card p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Ghi sổ</h2>
          <PostInvoicePanel invoiceId={invoice.id} canPost={canPost} reason={postReason} />
        </div>
      ) : invoice.status === 'EXCEPTION' ? (
        <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Hóa đơn có sai lệch nên bị chặn ghi sổ. Cần xử lý sai lệch với nhà cung cấp trước, ví dụ
          điều chỉnh hóa đơn hoặc bổ sung phiếu nhận hàng.
        </div>
      ) : null}
    </>
  );
}
