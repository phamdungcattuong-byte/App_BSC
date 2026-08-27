import type { Metadata } from 'next';
import { AppLink as Link } from '@/components/app-link';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { can, roleLabel } from '@/lib/rbac';
import { BUSINESS_PARAMS } from '@/lib/config/business-params';
import { formatVnd } from '@/lib/money';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = { title: 'Bảng điều khiển' };

function Stat({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
}) {
  const body = (
    <div className="card h-full p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-navy-800">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block transition-shadow hover:shadow-md">
      {body}
    </Link>
  ) : (
    body
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const orgId = user.organization.id;
  const isSupplier = user.organization.type === 'SUPPLIER';

  const role = user.role;

  const [
    prPending,
    rfqOpen,
    poOpen,
    invoiceException,
    quotesToSubmit,
    poToAck,
    grnCount,
    discrepancyOpen,
  ] = await Promise.all([
      prisma.purchaseRequisition.count({
        where: { organizationId: orgId, status: { in: ['SUBMITTED', 'BUDGET_CHECK'] } },
      }),
      prisma.rfq.count({ where: { organizationId: orgId, status: 'ISSUED' } }),
      prisma.purchaseOrder.count({
        where: isSupplier
          ? { supplierOrgId: orgId, status: { in: ['ISSUED', 'ACKNOWLEDGED', 'RECEIVING'] } }
          : { buyerOrgId: orgId, status: { in: ['ISSUED', 'ACKNOWLEDGED', 'RECEIVING'] } },
      }),
      prisma.invoice.count({
        where: isSupplier
          ? { supplierOrgId: orgId, status: 'EXCEPTION' }
          : { buyerOrgId: orgId, status: 'EXCEPTION' },
      }),
      prisma.rfqInvitation.count({
        where: { organizationId: orgId, rfq: { status: 'ISSUED' } },
      }),
      prisma.purchaseOrder.count({ where: { supplierOrgId: orgId, status: 'ISSUED' } }),
      prisma.grn.count({
        where: isSupplier ? { supplierOrgId: orgId } : { buyerOrgId: orgId },
      }),
      prisma.discrepancy.count({
        where: {
          ...(isSupplier ? { supplierOrgId: orgId } : { buyerOrgId: orgId }),
          status: { not: 'CLOSED' },
        },
      }),
  ]);

  return (
    <>
      <PageHeader
        title={`Xin chào, ${user.fullName}`}
        description={`${roleLabel(role)} · ${user.organization.name}`}
      />

      {/* Chỉ hiện thẻ mà vai trò được phép mở, tránh dẫn người dùng tới trang bị chặn. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isSupplier ? (
          <>
            {can(role, 'quote', 'view') ? (
              <Stat
                label="Lời mời báo giá đang mở"
                value={quotesToSubmit}
                hint="RFQ đang chờ bạn gửi báo giá"
                href="/bao-gia"
              />
            ) : null}
            {can(role, 'purchaseOrder', 'view') ? (
              <>
                <Stat
                  label="Đơn hàng chờ xác nhận"
                  value={poToAck}
                  hint="PO đã phát hành, chờ bạn xác nhận"
                  href="/don-hang"
                />
                <Stat label="Đơn hàng đang thực hiện" value={poOpen} href="/don-hang" />
              </>
            ) : null}
            {can(role, 'invoice', 'view') ? (
              <Stat label="Hóa đơn có sai lệch" value={invoiceException} href="/hoa-don" />
            ) : null}
            {can(role, 'discrepancy', 'view') ? (
              <Stat
                label="Sai lệch chờ xử lý"
                value={discrepancyOpen}
                hint="Hồ sơ sai lệch chưa đóng"
                href="/sai-lech"
              />
            ) : null}
          </>
        ) : (
          <>
            {can(role, 'requisition', 'view') ? (
              <Stat
                label="Đề nghị mua chờ duyệt"
                value={prPending}
                hint="Đang chờ phê duyệt theo hạn mức"
                href="/de-nghi-mua"
              />
            ) : null}
            {can(role, 'rfq', 'view') ? (
              <Stat label="RFQ đang mở" value={rfqOpen} hint="Đang nhận báo giá" href="/hoi-gia" />
            ) : null}
            {can(role, 'purchaseOrder', 'view') ? (
              <Stat label="Đơn hàng đang thực hiện" value={poOpen} href="/don-hang" />
            ) : null}
            {can(role, 'invoice', 'view') ? (
              <Stat
                label="Hóa đơn có sai lệch"
                value={invoiceException}
                hint="Đối chiếu ba chiều chưa đạt"
                href="/hoa-don"
              />
            ) : null}
            {can(role, 'discrepancy', 'view') ? (
              <Stat
                label="Sai lệch chờ xử lý"
                value={discrepancyOpen}
                hint="Hồ sơ sai lệch chưa đóng"
                href="/sai-lech"
              />
            ) : null}
          </>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-slate-800">Luồng nghiệp vụ của sàn</h2>
          <ol className="mt-3 space-y-2 text-sm text-slate-600">
            {[
              ['Đề nghị mua', 'Người đề nghị chọn vật liệu, gắn dự án và WBS, trình duyệt theo hạn mức.'],
              ['Hỏi giá', 'Chuyên viên mua hàng phát hành RFQ tới nhiều nhà cung cấp cùng lúc.'],
              ['So sánh và chọn', 'Chuẩn hóa báo giá về cùng mặt bằng, chọn nhà cung cấp kèm lý do.'],
              ['Đơn hàng', 'Phát hành PO từ kết quả lựa chọn, nhà cung cấp xác nhận.'],
              ['Nhận hàng', 'Ghi nhận thực nhận tại công trường, chặn nhận vượt ngoài dung sai.'],
              ['Đối chiếu ba chiều', 'So khớp đơn hàng, phiếu nhận và hóa đơn trước khi ghi sổ.'],
            ].map(([title, desc], i) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy-700 text-[11px] font-semibold text-white">
                  {i + 1}
                </span>
                <span>
                  <strong className="font-medium text-slate-800">{title}.</strong> {desc}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="card border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900">
            Tham số nghiệp vụ đang chờ phê duyệt
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            Các giá trị dưới đây là <strong>giá trị tạm</strong>, đang chờ Decision Log{' '}
            <code className="rounded bg-white/70 px-1 font-mono text-xs">
              {BUSINESS_PARAMS.pendingDecision}
            </code>{' '}
            do {BUSINESS_PARAMS.decisionOwner} phê duyệt. Hệ thống chạy được nhưng chưa dùng cho
            giao dịch thật.
          </p>
          <dl className="mt-3 space-y-1.5 text-sm text-amber-900">
            <div className="flex justify-between gap-4">
              <dt>Hạn mức duyệt bậc 1</dt>
              <dd className="font-medium tabular-nums">
                đến {formatVnd(BUSINESS_PARAMS.approvalTiers[0].maxValue ?? 0)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Dung sai nhận vượt đơn hàng</dt>
              <dd className="font-medium tabular-nums">
                {(BUSINESS_PARAMS.receiptTolerance.overReceiptRate * 100).toFixed(1)}%
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Dung sai đơn giá khi đối chiếu</dt>
              <dd className="font-medium tabular-nums">
                {(BUSINESS_PARAMS.threeWayMatchTolerance.priceRate * 100).toFixed(1)}%
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-amber-700">
            Sửa tại <code className="font-mono">src/lib/config/business-params.ts</code>, không sửa
            rải rác trong mã nghiệp vụ.
          </p>
        </section>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Đã ghi nhận {grnCount} phiếu nhận hàng trong phạm vi tổ chức của bạn.
      </p>
    </>
  );
}
