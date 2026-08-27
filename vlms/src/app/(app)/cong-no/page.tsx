import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth';
import { getSupplierDebt } from '@/features/payment/service';
import { BUSINESS_PARAMS } from '@/lib/config/business-params';
import { formatVnd } from '@/lib/money';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';

export const metadata: Metadata = { title: 'Công nợ phải trả' };

export default async function DebtPage() {
  const user = await requirePermission('debt', 'view');
  const { rows, bucketLabels } = await getSupplierDebt(user.organizationId);

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
  const grandOverdue = rows.reduce((sum, r) => sum + r.overdue, 0);
  const grandApplied = rows.reduce((sum, r) => sum + r.applied, 0);
  const grandUnapplied = rows.reduce((sum, r) => sum + r.unapplied, 0);
  const grandNet = rows.reduce((sum, r) => sum + r.net, 0);

  return (
    <>
      <PageHeader
        title="Công nợ phải trả"
        description={`Hóa đơn đã ghi sổ nhưng chưa chi tiền, phân theo tuổi nợ tính từ ngày phát hành, đã trừ các phiếu giảm trừ từ hồ sơ sai lệch. Hạn thanh toán mặc định ${BUSINESS_PARAMS.paymentTermDays} ngày.`}
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Tổng phải trả
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-navy-800">
            {formatVnd(grandTotal)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Quá hạn</p>
          <p
            className={`mt-2 text-2xl font-semibold tabular-nums ${
              grandOverdue > 0 ? 'text-red-700' : 'text-navy-800'
            }`}
          >
            {formatVnd(grandOverdue)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Giảm trừ từ sai lệch
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-teal-700">
            {formatVnd(grandApplied)}
          </p>
          {grandUnapplied > 0 ? (
            <p className="mt-1 text-xs text-slate-500">
              Còn {formatVnd(grandUnapplied)} chưa có công nợ để đối trừ
            </p>
          ) : null}
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Thực phải trả
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-navy-800">
            {formatVnd(grandNet)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{rows.length} nhà cung cấp</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            title="Không còn công nợ phải trả"
            description="Mọi hóa đơn đã ghi sổ đều đã được thanh toán."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nhà cung cấp</th>
                  <th className="num">Số hóa đơn</th>
                  {bucketLabels.map((label) => (
                    <th key={label} className="num">
                      {label}
                    </th>
                  ))}
                  <th className="num">Quá hạn</th>
                  <th className="num">Tổng</th>
                  <th className="num">Giảm trừ</th>
                  <th className="num">Thực phải trả</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.supplierId}>
                    <td className="font-medium text-slate-800">{row.supplierName}</td>
                    <td className="num">{row.invoiceCount}</td>
                    {row.buckets.map((amount, i) => (
                      <td key={i} className="num">
                        {amount > 0 ? formatVnd(amount) : '—'}
                      </td>
                    ))}
                    <td className={`num ${row.overdue > 0 ? 'font-medium text-red-700' : ''}`}>
                      {row.overdue > 0 ? formatVnd(row.overdue) : '—'}
                    </td>
                    <td className="num">{formatVnd(row.total)}</td>
                    <td className={`num ${row.applied > 0 ? 'text-teal-700' : ''}`}>
                      {row.applied > 0 ? `- ${formatVnd(row.applied)}` : '—'}
                      {row.unapplied > 0 ? (
                        <span className="block text-xs font-normal text-slate-500">
                          chưa đối trừ {formatVnd(row.unapplied)}
                        </span>
                      ) : null}
                    </td>
                    <td className="num font-semibold text-navy-800">{formatVnd(row.net)}</td>
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
