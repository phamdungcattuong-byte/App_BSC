'use client';

import { ActionForm } from '@/components/action-form';
import { awardAction } from '../actions';

export interface AwardOption {
  quoteId: string;
  supplierName: string;
  total: number;
  isCheapest: boolean;
}

export function AwardPanel({ rfqId, options }: { rfqId: string; options: AwardOption[] }) {
  return (
    <ActionForm action={awardAction} className="space-y-3">
      {(disabled) => (
        <>
          <input type="hidden" name="rfqId" value={rfqId} />

          <div>
            <span className="label">Nhà cung cấp được chọn</span>
            <div className="space-y-2">
              {options.map((o, i) => (
                <label
                  key={o.quoteId}
                  className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <input
                    type="radio"
                    name="quoteId"
                    value={o.quoteId}
                    defaultChecked={i === 0}
                    required
                    className="h-4 w-4"
                  />
                  <span className="flex-1 font-medium text-slate-800">{o.supplierName}</span>
                  <span className="tabular-nums text-slate-600">
                    {o.total.toLocaleString('vi-VN')} ₫
                  </span>
                  {o.isCheapest ? (
                    <span className="badge bg-emerald-50 text-emerald-700">Giá thấp nhất</span>
                  ) : null}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="reason">
              Lý do lựa chọn
            </label>
            <input
              id="reason"
              name="reason"
              required
              className="input"
              placeholder="Ví dụ: giá thấp nhất, đủ chứng chỉ CO/CQ, giao trong 5 ngày"
            />
            <p className="mt-1 text-xs text-slate-500">
              Lý do là bắt buộc và được lưu vĩnh viễn trong nhật ký kiểm toán. Chọn nhà cung cấp
              không phải giá thấp nhất vẫn được, miễn nêu rõ căn cứ.
            </p>
          </div>

          <button type="submit" className="btn-primary" disabled={disabled}>
            {disabled ? 'Đang ghi nhận...' : 'Chọn nhà cung cấp'}
          </button>
        </>
      )}
    </ActionForm>
  );
}
