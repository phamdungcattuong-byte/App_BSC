import type { Metadata } from 'next';
import { AppLink as Link } from '@/components/app-link';
import { notFound } from 'next/navigation';
import { DiscrepancyStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatDateTime, formatQty, formatVnd, num } from '@/lib/money';
import {
  DISCREPANCY_TYPE_LABEL,
  RESOLUTION_LABEL,
  RESPONSIBILITY_LABEL,
} from '@/features/discrepancy/labels';
import { Flash } from '@/components/flash';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { RespondPanel, ResolvePanel } from './panels';

export const metadata: Metadata = { title: 'Chi tiết sai lệch' };

export default async function DiscrepancyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tb?: string }>;
}) {
  const user = await requirePermission('discrepancy', 'view');
  const { id } = await params;
  const { tb } = await searchParams;

  const discrepancy = await prisma.discrepancy.findFirst({
    where: {
      id,
      OR: [{ buyerOrgId: user.organizationId }, { supplierOrgId: user.organizationId }],
    },
    include: {
      grn: { select: { id: true, code: true, receivedAt: true, po: { select: { id: true, code: true } } } },
      grnLine: { include: { poLine: { include: { material: true } } } },
      supplierOrg: { select: { name: true } },
      creditNote: true,
    },
  });

  if (!discrepancy) notFound();

  const [raisedBy, respondedBy, resolvedBy] = await Promise.all([
    prisma.user.findUnique({
      where: { id: discrepancy.raisedById },
      select: { fullName: true },
    }),
    discrepancy.respondedById
      ? prisma.user.findUnique({
          where: { id: discrepancy.respondedById },
          select: { fullName: true },
        })
      : null,
    discrepancy.resolvedById
      ? prisma.user.findUnique({
          where: { id: discrepancy.resolvedById },
          select: { fullName: true },
        })
      : null,
  ]);

  const isBuyerSide = discrepancy.buyerOrgId === user.organizationId;
  const raiserIsSelf = discrepancy.raisedById === user.id;
  const closed = discrepancy.status === DiscrepancyStatus.CLOSED;
  const material = discrepancy.grnLine.poLine.material;

  // Trần giảm trừ: đúng đơn giá đơn hàng, đã gồm thuế. Dịch vụ chặn lại nếu vượt.
  const suggestedCredit =
    num(discrepancy.quantity) *
    num(discrepancy.grnLine.poLine.unitPrice) *
    (1 + num(discrepancy.grnLine.poLine.taxRate));

  const showRespond = !isBuyerSide && can(user.role, 'discrepancy', 'respond');
  const canRespond = showRespond && discrepancy.status === DiscrepancyStatus.OPEN;

  const showResolve = isBuyerSide && can(user.role, 'discrepancy', 'resolve');
  const canResolve = showResolve && !closed && !raiserIsSelf;

  const respondHint = !showRespond
    ? ''
    : discrepancy.status === DiscrepancyStatus.OPEN
      ? 'Phản hồi được ghi vào hồ sơ và chuyển sai lệch sang trạng thái đang làm rõ.'
      : 'Sai lệch này không còn ở trạng thái chờ phản hồi.';

  const resolveHint = !showResolve
    ? ''
    : closed
      ? 'Sai lệch đã được đóng, hồ sơ không sửa được nữa.'
      : raiserIsSelf
        ? 'Bạn là người ghi nhận sai lệch nên không được tự chốt hướng xử lý.'
        : 'Hướng xử lý được chốt một lần và kéo theo điều chỉnh sổ sách tương ứng.';

  return (
    <>
      <PageHeader
        title={`Sai lệch ${discrepancy.code}`}
        description={`${material.name} · Phiếu nhận hàng ${discrepancy.grn.code} · ${discrepancy.supplierOrg.name}`}
      />

      <Flash code={tb} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge status={discrepancy.status} />
        <span className="text-sm text-slate-600">
          {DISCREPANCY_TYPE_LABEL[discrepancy.type]} · {formatQty(discrepancy.quantity)}{' '}
          {material.uom}
          {discrepancy.resolution
            ? ` · Hướng xử lý: ${RESOLUTION_LABEL[discrepancy.resolution]}`
            : ''}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card overflow-hidden">
            <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
              Dòng nhận hàng liên quan
            </h2>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Vật tư</th>
                    <th className="num">Đặt</th>
                    <th className="num">Giao</th>
                    <th className="num">Chấp nhận</th>
                    <th className="num">Từ chối</th>
                    <th className="num">Đơn giá</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <span className="font-mono text-xs text-slate-500">{material.code}</span>{' '}
                      {material.name}
                    </td>
                    <td className="num">{formatQty(discrepancy.grnLine.poLine.quantity)}</td>
                    <td className="num">{formatQty(discrepancy.grnLine.deliveredQty)}</td>
                    <td className="num">{formatQty(discrepancy.grnLine.acceptedQty)}</td>
                    <td className="num">{formatQty(discrepancy.grnLine.rejectedQty)}</td>
                    <td className="num">{formatVnd(discrepancy.grnLine.poLine.unitPrice)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
              Đơn hàng{' '}
              <Link href={`/don-hang/${discrepancy.grn.po.id}`} className="font-mono underline">
                {discrepancy.grn.po.code}
              </Link>{' '}
              · Nhận hàng lúc {formatDateTime(discrepancy.grn.receivedAt)} ·{' '}
              <Link href="/nhan-hang" className="underline">
                Xem phiếu nhận hàng
              </Link>
            </div>
          </div>

          <div className="card p-4">
            <h2 className="text-sm font-semibold text-slate-700">Diễn biến hồ sơ</h2>
            <ol className="mt-3 space-y-3 text-sm">
              <li>
                <p className="font-medium text-slate-800">
                  Ghi nhận sai lệch · {raisedBy?.fullName ?? '—'}
                </p>
                <p className="text-slate-600">{discrepancy.description}</p>
                <p className="text-xs text-slate-500">{formatDateTime(discrepancy.createdAt)}</p>
              </li>
              {discrepancy.respondedAt ? (
                <li>
                  <p className="font-medium text-slate-800">
                    Nhà cung cấp phản hồi · {respondedBy?.fullName ?? '—'}
                  </p>
                  <p className="text-slate-600">{discrepancy.supplierNote}</p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(discrepancy.respondedAt)}
                  </p>
                </li>
              ) : null}
              {discrepancy.resolvedAt ? (
                <li>
                  <p className="font-medium text-slate-800">
                    Chốt hướng xử lý · {resolvedBy?.fullName ?? '—'}
                  </p>
                  <p className="text-slate-600">{discrepancy.resolutionNote}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(discrepancy.resolvedAt)}</p>
                </li>
              ) : null}
            </ol>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Kết luận</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Trách nhiệm</dt>
                <dd className="text-slate-800">
                  {RESPONSIBILITY_LABEL[discrepancy.responsibility]}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Hướng xử lý</dt>
                <dd className="text-slate-800">
                  {discrepancy.resolution ? RESOLUTION_LABEL[discrepancy.resolution] : 'Chưa chốt'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Giảm trừ công nợ</dt>
                <dd className="text-slate-800">
                  {discrepancy.creditAmount ? formatVnd(discrepancy.creditAmount) : '—'}
                </dd>
              </div>
            </dl>
          </div>

          {discrepancy.creditNote ? (
            <div className="card border-emerald-200 bg-emerald-50 p-4">
              <h2 className="text-sm font-semibold text-emerald-900">Phiếu giảm trừ đã phát hành</h2>
              <p className="mt-1 font-mono text-sm text-emerald-800">
                {discrepancy.creditNote.code}
              </p>
              <p className="text-sm text-emerald-800">
                {formatVnd(discrepancy.creditNote.amount)} ·{' '}
                {formatDateTime(discrepancy.creditNote.createdAt)}
              </p>
              <p className="mt-2 text-xs text-emerald-700">
                Khoản này đã được trừ vào công nợ phải trả nhà cung cấp.
              </p>
            </div>
          ) : null}

          {showRespond ? (
            <div className="card p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Phản hồi của nhà cung cấp</h2>
              <RespondPanel
                discrepancyId={discrepancy.id}
                canRespond={canRespond}
                hint={respondHint}
              />
            </div>
          ) : null}

          {showResolve ? (
            <div className="card p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Chốt hướng xử lý</h2>
              <ResolvePanel
                discrepancyId={discrepancy.id}
                canResolve={canResolve}
                hint={resolveHint}
                suggestedCredit={suggestedCredit}
              />
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
