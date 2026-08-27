'use client';

import { ActionForm } from '@/components/action-form';
import { createRfqAction } from '../actions';

export interface SupplierOption {
  id: string;
  name: string;
  matchedItems: number;
}

export function RfqForm({
  prId,
  prCode,
  suppliers,
}: {
  prId: string;
  prCode: string;
  suppliers: SupplierOption[];
}) {
  const defaultClosing = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 16);

  return (
    <ActionForm action={createRfqAction} className="space-y-4">
      {(disabled) => (
        <>
          <input type="hidden" name="prId" value={prId} />

          <div className="card p-4">
            <p className="text-sm text-slate-600">
              Tạo yêu cầu báo giá từ đề nghị mua{' '}
              <span className="font-mono font-medium text-navy-700">{prCode}</span>. Toàn bộ dòng
              vật tư của đề nghị sẽ được đưa vào yêu cầu.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="closingAt">
                  Hạn nhận báo giá
                </label>
                <input
                  id="closingAt"
                  name="closingAt"
                  type="datetime-local"
                  required
                  defaultValue={defaultClosing}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="terms">
                  Điều kiện thương mại
                </label>
                <input
                  id="terms"
                  name="terms"
                  className="input"
                  placeholder="Giao tại công trường, thanh toán 30 ngày"
                />
              </div>
            </div>
          </div>

          <fieldset className="card p-4">
            <legend className="px-1 text-sm font-semibold text-slate-700">
              Chọn nhà cung cấp để mời
            </legend>
            <p className="mb-3 text-xs text-slate-500">
              Số vật tư khớp cho biết nhà cung cấp đang niêm yết bao nhiêu dòng trong yêu cầu này.
            </p>
            <div className="space-y-2">
              {suppliers.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    name="supplierOrgId"
                    value={s.id}
                    defaultChecked={s.matchedItems > 0}
                    className="h-4 w-4"
                  />
                  <span className="flex-1 font-medium text-slate-800">{s.name}</span>
                  <span className="text-xs text-slate-500">
                    khớp {s.matchedItems} dòng vật tư
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <button type="submit" className="btn-primary" disabled={disabled}>
            {disabled ? 'Đang phát hành...' : 'Phát hành yêu cầu báo giá'}
          </button>
        </>
      )}
    </ActionForm>
  );
}
