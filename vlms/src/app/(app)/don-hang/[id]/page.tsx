import type { Metadata } from 'next';
import { AppLink as Link } from '@/components/app-link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { BUSINESS_PARAMS } from '@/lib/config/business-params';
import { formatVnd, formatDate, formatQty, num } from '@/lib/money';
import { Flash } from '@/components/flash';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { AcknowledgePanel, InvoicePanel, ReceiveGoodsPanel, type LineOption } from './panels';

export const metadata: Metadata = { title: 'Chi tiết đơn hàng' };

export default async function PoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tb?: string }>;
}) {
  const user = await requirePermission('purchaseOrder', 'view');
  const { id } = await params;
  const { tb } = await searchParams;

  const po = await prisma.purchaseOrder.findFirst({
    where: {
      id,
      OR: [{ buyerOrgId: user.organizationId }, { supplierOrgId: user.organizationId }],
    },
    include: {
      buyerOrg: { select: { name: true } },
      supplierOrg: { select: { name: true } },
      lines: { include: { material: true, wbs: true } },
      grns: { orderBy: { receivedAt: 'desc' } },
      invoices: { include: { matchResult: true }, orderBy: { createdAt: 'desc' } },
      award: { include: { rfq: { select: { id: true, code: true } } } },
    },
  });

  if (!po) notFound();

  const isSupplier = po.supplierOrgId === user.organizationId;
  const lineOptions: LineOption[] = po.lines.map((l) => ({
    poLineId: l.id,
    materialName: l.material.name,
    materialCode: l.material.code,
    uom: l.material.uom,
    orderedQty: num(l.quantity),
    receivedQty: num(l.receivedQty),
    invoicedQty: num(l.invoicedQty),
    unitPrice: num(l.unitPrice),
  }));

  const showAckPanel = isSupplier && can(user.role, 'purchaseOrder', 'acknowledge');
  const canAck = showAckPanel && po.status === 'ISSUED';
  const canReceive =
    !isSupplier &&
    ['ACKNOWLEDGED', 'RECEIVING'].includes(po.status) &&
    can(user.role, 'grn', 'create');
  const hasReceipt = po.grns.length > 0;
  const canInvoice = hasReceipt && can(user.role, 'invoice', 'create');

  return (
    <>
      <PageHeader
        title={`Đơn hàng ${po.code}`}
        description={`${po.buyerOrg.name} mua của ${po.supplierOrg.name}`}
        actions={
          po.award && can(user.role, 'rfq', 'view') ? (
            <Link href={`/hoi-gia/${po.award.rfq.id}`} className="btn-ghost">
              Xem yêu cầu báo giá {po.award.rfq.code}
            </Link>
          ) : null
        }
      />

      <Flash code={tb} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge status={po.status} />
        <span className="text-sm text-slate-600">
          Giao trước {formatDate(po.deliveryDate)} tại {po.deliveryAddress}
        </span>
      </div>

      <div className="card mb-4 overflow-hidden">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
          Dòng đơn hàng
        </h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Vật tư</th>
                <th>Hạng mục</th>
                <th className="num">Đặt</th>
                <th className="num">Đã nhận</th>
                <th className="num">Đã xuất hóa đơn</th>
                <th className="num">Đơn giá</th>
                <th className="num">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((l) => (
                <tr key={l.id}>
                  <td>
                    <span className="font-medium text-slate-800">{l.material.name}</span>
                    <span className="block font-mono text-xs text-slate-500">{l.material.code}</span>
                  </td>
                  <td className="text-xs">{l.wbs.code}</td>
                  <td className="num">
                    {formatQty(l.quantity)} {l.material.uom}
                  </td>
                  <td className="num">{formatQty(l.receivedQty)}</td>
                  <td className="num">{formatQty(l.invoicedQty)}</td>
                  <td className="num">{formatVnd(l.unitPrice)}</td>
                  <td className="num font-medium">{formatVnd(l.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} className="px-3 py-2 text-right text-slate-600">
                  Cộng chưa thuế
                </td>
                <td className="num px-3 py-2">{formatVnd(po.subtotal)}</td>
              </tr>
              <tr>
                <td colSpan={6} className="px-3 py-2 text-right text-slate-600">
                  Thuế GTGT
                </td>
                <td className="num px-3 py-2">{formatVnd(po.taxTotal)}</td>
              </tr>
              <tr>
                <td colSpan={6} className="px-3 py-2 text-right font-medium text-slate-700">
                  Tổng thanh toán
                </td>
                <td className="num px-3 py-2 text-base font-semibold text-navy-800">
                  {formatVnd(po.grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {showAckPanel ? (
        <div className="card mb-4 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Xác nhận đơn hàng</h2>
          <AcknowledgePanel poId={po.id} canAck={canAck} />
        </div>
      ) : null}

      {canReceive ? (
        <div className="card mb-4 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Ghi nhận nhận hàng</h2>
          <ReceiveGoodsPanel
            poId={po.id}
            lines={lineOptions}
            toleranceRate={BUSINESS_PARAMS.receiptTolerance.overReceiptRate}
          />
        </div>
      ) : null}

      {po.grns.length > 0 ? (
        <div className="card mb-4 overflow-hidden">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
            Phiếu nhận hàng ({po.grns.length})
          </h2>
          <table className="table">
            <thead>
              <tr>
                <th>Mã phiếu</th>
                <th>Thời điểm nhận</th>
                <th>Biển số xe</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {po.grns.map((g) => (
                <tr key={g.id}>
                  <td className="font-mono text-xs">{g.code}</td>
                  <td>{formatDate(g.receivedAt)}</td>
                  <td>{g.vehicleNo ?? '—'}</td>
                  <td>
                    <StatusBadge status={g.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {canInvoice ? (
        <div className="card mb-4 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Tiếp nhận hóa đơn và đối chiếu ba chiều
          </h2>
          <InvoicePanel poId={po.id} lines={lineOptions} />
        </div>
      ) : !hasReceipt && can(user.role, 'invoice', 'create') ? (
        <p className="text-sm text-slate-500">
          Chưa thể lập hóa đơn vì đơn hàng chưa có phiếu nhận hàng nào. Đây là điều kiện bắt buộc
          của đối chiếu ba chiều.
        </p>
      ) : null}

      {po.invoices.length > 0 ? (
        <div className="card overflow-hidden">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
            Hóa đơn ({po.invoices.length})
          </h2>
          <table className="table">
            <thead>
              <tr>
                <th>Số hóa đơn</th>
                <th>Ngày</th>
                <th className="num">Tổng tiền</th>
                <th>Kết quả đối chiếu</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {po.invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    {can(user.role, 'invoice', 'view') ? (
                      <Link href={`/hoa-don/${inv.id}`} className="font-mono text-navy-700 underline">
                        {inv.code}
                      </Link>
                    ) : (
                      <span className="font-mono text-xs">{inv.code}</span>
                    )}
                  </td>
                  <td>{formatDate(inv.issueDate)}</td>
                  <td className="num font-medium">{formatVnd(inv.grandTotal)}</td>
                  <td>
                    {inv.matchResult ? <StatusBadge status={inv.matchResult.outcome} /> : '—'}
                  </td>
                  <td>
                    <StatusBadge status={inv.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
