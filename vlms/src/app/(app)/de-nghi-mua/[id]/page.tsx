import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatVnd, formatDate, formatQty, num } from '@/lib/money';
import { resolveApprovalTier } from '@/lib/config/business-params';
import { detectSplitRisk } from '@/features/requisition/service';
import { Flash } from '@/components/flash';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { DecisionPanel, SubmitPanel } from './decision-panel';

export const metadata: Metadata = { title: 'Chi tiết đề nghị mua' };

export default async function RequisitionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tb?: string }>;
}) {
  const user = await requirePermission('requisition', 'view');
  const { id } = await params;
  const { tb } = await searchParams;

  const pr = await prisma.purchaseRequisition.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      project: true,
      lines: { include: { material: true, wbs: true } },
      rfqs: { select: { id: true, code: true, status: true } },
    },
  });

  if (!pr) notFound();

  const total = num(pr.totalValue);
  const tier = resolveApprovalTier(total);
  const splitRisk = await detectSplitRisk(
    pr.organizationId,
    pr.projectId,
    pr.createdById,
    total,
    pr.id,
  );

  const isOwner = pr.createdById === user.id;
  // Panel hiện ra theo vai; nút bên trong mới bật tắt theo trạng thái chứng từ.
  const showSubmitPanel = isOwner && can(user.role, 'requisition', 'submit');
  const canSubmit = showSubmitPanel && pr.status === 'DRAFT';
  const showDecisionPanel = !isOwner && can(user.role, 'requisition', 'approve');
  const canDecide =
    showDecisionPanel && (pr.status === 'SUBMITTED' || pr.status === 'BUDGET_CHECK');
  const canMakeRfq = pr.status === 'APPROVED' && can(user.role, 'rfq', 'create');

  return (
    <>
      <PageHeader
        title={`Đề nghị mua ${pr.code}`}
        description={`${pr.project.code} — ${pr.project.name}`}
        actions={
          canMakeRfq ? (
            <Link href={`/hoi-gia/moi?pr=${pr.id}`} className="btn-accent">
              Tạo yêu cầu báo giá
            </Link>
          ) : null
        }
      />

      <Flash code={tb} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Vật tư</th>
                    <th>Hạng mục WBS</th>
                    <th className="num">Số lượng</th>
                    <th className="num">Đơn giá ước tính</th>
                    <th className="num">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {pr.lines.map((line) => (
                    <tr key={line.id}>
                      <td>
                        <span className="font-medium text-slate-800">{line.material.name}</span>
                        <span className="block font-mono text-xs text-slate-500">
                          {line.material.code}
                        </span>
                      </td>
                      <td>
                        {line.wbs.code} — {line.wbs.name}
                      </td>
                      <td className="num">
                        {formatQty(line.quantity)} {line.material.uom}
                      </td>
                      <td className="num">{formatVnd(line.estPrice)}</td>
                      <td className="num font-medium">
                        {formatVnd(num(line.quantity) * num(line.estPrice))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-right font-medium text-slate-700">
                      Tổng cộng
                    </td>
                    <td className="num px-3 py-2 text-base font-semibold text-navy-800">
                      {formatVnd(total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {pr.rfqs.length > 0 ? (
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-slate-700">Yêu cầu báo giá liên quan</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {pr.rfqs.map((r) => (
                  <li key={r.id}>
                    <Link href={`/hoi-gia/${r.id}`} className="font-mono text-navy-700 underline">
                      {r.code}
                    </Link>{' '}
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Trạng thái</dt>
                <dd>
                  <StatusBadge status={pr.status} />
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Cần hàng trước</dt>
                <dd className="font-medium">{formatDate(pr.neededBy)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Bậc phê duyệt</dt>
                <dd className="font-medium">{tier.label}</dd>
              </div>
              {pr.note ? (
                <div>
                  <dt className="text-slate-500">Ghi chú</dt>
                  <dd className="mt-0.5">{pr.note}</dd>
                </div>
              ) : null}
              {pr.decisionReason ? (
                <div>
                  <dt className="text-slate-500">Lý do quyết định</dt>
                  <dd className="mt-0.5">{pr.decisionReason}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          {splitRisk.flagged ? (
            <div className="card border-amber-300 bg-amber-50 p-4">
              <h2 className="text-sm font-semibold text-amber-900">
                Cảnh báo dấu hiệu tách đề nghị mua
              </h2>
              <p className="mt-1 text-sm text-amber-800">
                Cùng người đề nghị và cùng dự án còn {splitRisk.siblingCount} đề nghị mua khác trong
                24 giờ, tổng cộng {formatVnd(splitRisk.aggregate)}. Người phê duyệt cần xem xét khả
                năng tách nhỏ để né hạn mức.
              </p>
              <p className="mt-2 text-xs text-amber-700">
                Hệ thống chỉ cảnh báo. Quyết định thuộc về người có thẩm quyền.
              </p>
            </div>
          ) : null}

          {showSubmitPanel ? (
            <div className="card p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Thao tác</h2>
              <SubmitPanel prId={pr.id} canSubmit={canSubmit} />
            </div>
          ) : null}

          {showDecisionPanel ? (
            <div className="card p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Quyết định phê duyệt</h2>
              <DecisionPanel prId={pr.id} canDecide={canDecide} />
            </div>
          ) : null}

          {pr.status === 'SUBMITTED' && isOwner ? (
            <p className="text-xs text-slate-500">
              Bạn là người tạo đề nghị mua này nên không thể tự phê duyệt. Quy tắc phân tách nhiệm
              vụ yêu cầu một người khác quyết định.
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
