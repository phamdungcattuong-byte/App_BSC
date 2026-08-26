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

  return (
    <>
      <PageHeader
        title="Công nợ phải trả"
        description={`Hóa đơn đã ghi sổ nhưng chưa chi tiền, phân theo tuổi nợ tính từ ngày phát hành. Hạn thanh toán mặc định ${BUSINESS_PARAMS.paymentTermDays} ngày.`}
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
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
            Số nhà cung cấp
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-navy-800">{rows.length}</p>
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
                    <td className="num font-semibold text-navy-800">{formatVnd(row.total)}</td>
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
