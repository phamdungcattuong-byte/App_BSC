import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { resolveApprovalTier } from '@/lib/config/business-params';
import { formatVnd, formatDate, formatDateTime, num } from '@/lib/money';
import { Flash } from '@/components/flash';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { DecideRequestPanel, ExecutePaymentPanel, SubmitRequestPanel } from './panels';

export const metadata: Metadata = { title: 'Chi tiết đề nghị thanh toán' };

export default async function PaymentRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tb?: string }>;
}) {
  const user = await requirePermission('paymentRequest', 'view');
  const { id } = await params;
  const { tb } = await searchParams;

  const request = await prisma.paymentRequest.findFirst({
    where: {
      id,
      OR: [{ buyerOrgId: user.organizationId }, { supplierOrgId: user.organizationId }],
    },
    include: {
      supplierOrg: { select: { name: true } },
      bankAccount: true,
      payment: true,
      lines: { include: { invoice: { include: { po: { select: { id: true, code: true } } } } } },
    },
  });

  if (!request) notFound();

  const isBuyerSide = request.buyerOrgId === user.organizationId;
  const tier = resolveApprovalTier(num(request.totalAmount));

  const verifierIsSelf = request.bankAccount.verifiedById === user.id;
  const creatorIsSelf = request.createdById === user.id;

  const showSubmit = isBuyerSide && creatorIsSelf && can(user.role, 'paymentRequest', 'submit');
  const canSubmit = showSubmit && request.status === 'DRAFT';

  const showDecide = isBuyerSide && can(user.role, 'paymentRequest', 'approve');
  const canDecide = showDecide && request.status === 'SUBMITTED' && !creatorIsSelf && !verifierIsSelf;

  const showExecute = isBuyerSide && can(user.role, 'payment', 'execute');
  const canExecute = showExecute && request.status === 'APPROVED' && !creatorIsSelf;

  const decideHint = !showDecide
    ? ''
    : request.status !== 'SUBMITTED'
      ? 'Đề nghị này không ở trạng thái chờ phê duyệt.'
      : creatorIsSelf
        ? 'Bạn là người lập đề nghị nên không thể tự phê duyệt.'
        : verifierIsSelf
          ? 'Bạn đã xác minh tài khoản nhận tiền của đề nghị này nên không được phê duyệt lệnh chi vào chính tài khoản đó.'
          : `Bậc phê duyệt áp dụng: ${tier.label}.`;

  const executeHint = !showExecute
    ? ''
    : request.status === 'PAID'
      ? 'Đề nghị đã được chi.'
      : request.status !== 'APPROVED'
        ? 'Chỉ chi tiền cho đề nghị đã được phê duyệt.'
        : creatorIsSelf
          ? 'Người lập đề nghị không được đồng thời thực hiện lệnh chi.'
          : 'Lệnh chi dùng khóa chống trùng, bấm hai lần cũng chỉ chi một lần.';

  return (
    <>
      <PageHeader
        title={`Đề nghị thanh toán ${request.code}`}
        description={`${request.supplierOrg.name} · Hạn thanh toán ${formatDate(request.dueDate)}`}
      />

      <Flash code={tb} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge status={request.status} />
        <span className="text-sm text-slate-600">
          Tổng {formatVnd(request.totalAmount)} · {request.lines.length} hóa đơn · Bậc {tier.label}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card overflow-hidden">
            <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
              Hóa đơn trong đề nghị
            </h2>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Số hóa đơn</th>
                    <th>Đơn hàng</th>
                    <th>Ngày phát hành</th>
                    <th className="num">Số tiền</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {request.lines.map((line) => (
                    <tr key={line.id}>
                      <td>
                        <Link href={`/hoa-don/${line.invoiceId}`} className="font-mono text-xs underline">
                          {line.invoice.code}
                        </Link>
                      </td>
                      <td className="font-mono text-xs">{line.invoice.po.code}</td>
                      <td>{formatDate(line.invoice.issueDate)}</td>
                      <td className="num font-medium">{formatVnd(line.amount)}</td>
                      <td>
                        <StatusBadge status={line.invoice.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-right font-medium text-slate-700">
                      Tổng cộng
                    </td>
                    <td className="num px-3 py-2 text-base font-semibold text-navy-800">
                      {formatVnd(request.totalAmount)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {request.payment ? (
            <div className="card border-emerald-200 bg-emerald-50 p-4">
              <h2 className="text-sm font-semibold text-emerald-900">Lệnh chi đã thực hiện</h2>
              <dl className="mt-2 space-y-1 text-sm text-emerald-800">
                <div>
                  <dt className="inline">Mã lệnh chi: </dt>
                  <dd className="inline font-mono">{request.payment.code}</dd>
                </div>
                <div>
                  <dt className="inline">Tham chiếu ngân hàng: </dt>
                  <dd className="inline font-mono">{request.payment.bankRef}</dd>
                </div>
                <div>
                  <dt className="inline">Thời điểm: </dt>
                  <dd className="inline">{formatDateTime(request.payment.executedAt)}</dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Tài khoản nhận tiền</h2>
            <p className="text-sm text-slate-700">{request.bankAccount.bankName}</p>
            <p className="font-mono text-sm text-navy-700">{request.bankAccount.accountNumber}</p>
            <p className="text-sm text-slate-600">{request.bankAccount.accountHolder}</p>
            <div className="mt-2">
              <StatusBadge status={request.bankAccount.status} />
            </div>
          </div>

          {request.decisionReason ? (
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-slate-700">Lý do quyết định</h2>
              <p className="mt-1 text-sm text-slate-600">{request.decisionReason}</p>
            </div>
          ) : null}

          {showSubmit ? (
            <div className="card p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Thao tác</h2>
              <SubmitRequestPanel
                requestId={request.id}
                canSubmit={canSubmit}
                hint={
                  canSubmit
                    ? 'Hệ thống kiểm lại hiệu lực tài khoản nhận tiền trước khi cho trình duyệt.'
                    : 'Đề nghị đã được trình, không cần thao tác thêm.'
                }
              />
            </div>
          ) : null}

          {showDecide ? (
            <div className="card p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Quyết định phê duyệt</h2>
              <DecideRequestPanel requestId={request.id} canDecide={canDecide} hint={decideHint} />
            </div>
          ) : null}

          {showExecute ? (
            <div className="card p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Thực hiện lệnh chi</h2>
              <ExecutePaymentPanel
                requestId={request.id}
                canExecute={canExecute}
                hint={executeHint}
              />
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
