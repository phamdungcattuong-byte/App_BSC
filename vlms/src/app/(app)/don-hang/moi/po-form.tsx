'use client';

import { useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { issuePoAction } from '../actions';

export function PoForm({
  awardId,
  supplierName,
  rfqCode,
  total,
  suggestedAddress,
}: {
  awardId: string;
  supplierName: string;
  rfqCode: string;
  total: number;
  suggestedAddress: string;
}) {
  // Sinh một lần khi mount; bấm gửi nhiều lần vẫn dùng chung khóa nên không tạo trùng đơn.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const defaultDelivery = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

  return (
    <ActionForm action={issuePoAction} className="space-y-4">
      {(disabled) => (
        <>
          <input type="hidden" name="awardId" value={awardId} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

          <div className="card p-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-slate-500">Từ yêu cầu báo giá</dt>
                <dd className="font-mono font-medium text-navy-700">{rfqCode}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Nhà cung cấp</dt>
                <dd className="font-medium text-slate-800">{supplierName}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Giá trị đơn hàng</dt>
                <dd className="font-semibold tabular-nums text-navy-800">
                  {total.toLocaleString('vi-VN')} ₫
                </dd>
              </div>
            </dl>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="deliveryDate">
                  Ngày giao hàng
                </label>
                <input
                  id="deliveryDate"
                  name="deliveryDate"
                  type="date"
                  required
                  defaultValue={defaultDelivery}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="deliveryAddress">
                  Địa điểm giao hàng
                </label>
                <input
                  id="deliveryAddress"
                  name="deliveryAddress"
                  required
                  defaultValue={suggestedAddress}
                  className="input"
                />
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={disabled}>
            {disabled ? 'Đang phát hành...' : 'Phát hành đơn hàng'}
          </button>
        </>
      )}
    </ActionForm>
  );
}
