'use client';

import { useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { submitQuoteAction } from '@/app/(app)/hoi-gia/actions';

export interface QuoteLineOption {
  rfqLineId: string;
  materialName: string;
  materialCode: string;
  quantity: number;
  uom: string;
  listPrice: number | null;
}

export interface SubmittedQuote {
  code: string;
  totalValue: number;
  prices: Record<string, number>;
}

export function QuoteForm({
  rfqId,
  lines,
  canQuote,
  submitted,
  closedReason,
}: {
  rfqId: string;
  lines: QuoteLineOption[];
  canQuote: boolean;
  submitted: SubmittedQuote | null;
  closedReason: string;
}) {
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(lines.map((l) => [l.rfqLineId, String(l.listPrice ?? '')])),
  );

  // Sau khi nộp, cùng một component đổi sang bản tóm tắt chỉ đọc. Giữ nguyên vị
  // trí trong cây render để transition của Server Action kết thúc trọn vẹn.
  const readOnly = !canQuote;
  const effectivePrice = (id: string) =>
    submitted ? (submitted.prices[id] ?? 0) : Number(prices[id]) || 0;

  const total = lines.reduce((sum, l) => sum + l.quantity * effectivePrice(l.rfqLineId), 0);

  const defaultValid = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  return (
    <ActionForm action={submitQuoteAction} className="space-y-4">
      {(disabled) => (
        <>
          <input type="hidden" name="rfqId" value={rfqId} />

          <div className="card overflow-hidden">
            <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
              {submitted ? `Báo giá đã nộp (${submitted.code})` : 'Đơn giá chào'}
            </h2>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Vật tư</th>
                    <th className="num">Số lượng</th>
                    <th className="min-w-[160px]">Đơn giá chưa thuế</th>
                    <th className="num">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.rfqLineId}>
                      <td>
                        <span className="font-medium text-slate-800">{l.materialName}</span>
                        <span className="block font-mono text-xs text-slate-500">
                          {l.materialCode}
                        </span>
                      </td>
                      <td className="num">
                        {l.quantity.toLocaleString('vi-VN')} {l.uom}
                      </td>
                      <td>
                        <input type="hidden" name="rfqLineId" value={l.rfqLineId} />
                        <input
                          name="unitPrice"
                          type="number"
                          step="1"
                          min="1"
                          required
                          readOnly={readOnly}
                          value={
                            submitted
                              ? String(submitted.prices[l.rfqLineId] ?? '')
                              : (prices[l.rfqLineId] ?? '')
                          }
                          onChange={(e) =>
                            setPrices((p) => ({ ...p, [l.rfqLineId]: e.target.value }))
                          }
                          className={`input ${readOnly ? 'bg-slate-100' : ''}`}
                          aria-label={`Đơn giá cho ${l.materialName}`}
                        />
                        {l.listPrice !== null ? (
                          <span className="mt-1 block text-xs text-slate-500">
                            Giá niêm yết của bạn: {l.listPrice.toLocaleString('vi-VN')} ₫
                          </span>
                        ) : (
                          <span className="mt-1 block text-xs text-amber-600">
                            Bạn chưa niêm yết vật tư này
                          </span>
                        )}
                      </td>
                      <td className="num tabular-nums">
                        {(l.quantity * effectivePrice(l.rfqLineId)).toLocaleString('vi-VN')} ₫
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-right font-medium text-slate-700">
                      {submitted ? 'Tổng đã nộp (chưa thuế)' : 'Tổng chưa thuế'}
                    </td>
                    <td className="num px-3 py-2 text-base font-semibold text-navy-800">
                      {total.toLocaleString('vi-VN')} ₫
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className={`card grid gap-4 p-4 sm:grid-cols-3 ${readOnly ? 'hidden' : ''}`}>
            <div>
              <label className="label" htmlFor="validUntil">
                Báo giá có hiệu lực đến
              </label>
              <input
                id="validUntil"
                name="validUntil"
                type="date"
                required
                defaultValue={defaultValid}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="deliveryDays">
                Số ngày giao hàng
              </label>
              <input
                id="deliveryDays"
                name="deliveryDays"
                type="number"
                min="1"
                required
                defaultValue={7}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="paymentTerms">
                Điều kiện thanh toán
              </label>
              <input
                id="paymentTerms"
                name="paymentTerms"
                className="input"
                placeholder="Thanh toán 30 ngày sau giao hàng"
              />
            </div>
          </div>

          <div>
            <button type="submit" className="btn-primary" disabled={disabled || readOnly}>
              Nộp báo giá
            </button>
            <p className="mt-2 text-xs text-slate-500">
              {readOnly
                ? closedReason
                : 'Báo giá đã nộp sẽ được khóa và không sửa được, đúng nguyên tắc bảo mật hồ sơ dự thầu.'}
            </p>
          </div>
        </>
      )}
    </ActionForm>
  );
}
