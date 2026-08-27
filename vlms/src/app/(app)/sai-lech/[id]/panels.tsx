'use client';

import { useState } from 'react';
import type { DiscrepancyResolution, Responsibility } from '@prisma/client';
import { ActionForm } from '@/components/action-form';
import {
  RESOLUTION_EFFECT,
  RESOLUTION_LABEL,
  RESOLUTIONS,
  RESPONSIBILITIES,
  RESPONSIBILITY_LABEL,
} from '@/features/discrepancy/labels';
import { respondToDiscrepancyAction, resolveDiscrepancyAction } from '../actions';

export function RespondPanel({
  discrepancyId,
  canRespond,
  hint,
}: {
  discrepancyId: string;
  canRespond: boolean;
  hint: string;
}) {
  return (
    <ActionForm action={respondToDiscrepancyAction} className="space-y-3">
      {(disabled) => (
        <>
          <input type="hidden" name="discrepancyId" value={discrepancyId} />
          <div>
            <label className="label" htmlFor="note">
              Nội dung phản hồi
            </label>
            <textarea
              id="note"
              name="note"
              rows={3}
              required
              disabled={!canRespond}
              className="input disabled:bg-slate-100"
              placeholder="Đã kiểm tra lô hàng, xác nhận thiếu và sẽ giao bù trong 3 ngày."
            />
          </div>
          <button type="submit" className="btn-primary" disabled={disabled || !canRespond}>
            Gửi phản hồi
          </button>
          <p className="text-xs text-slate-500">{hint}</p>
        </>
      )}
    </ActionForm>
  );
}

export function ResolvePanel({
  discrepancyId,
  canResolve,
  hint,
  suggestedCredit,
}: {
  discrepancyId: string;
  canResolve: boolean;
  hint: string;
  suggestedCredit: number;
}) {
  const [resolution, setResolution] = useState<DiscrepancyResolution>('REPLACE');

  return (
    <ActionForm action={resolveDiscrepancyAction} className="space-y-3">
      {(disabled) => (
        <>
          <input type="hidden" name="discrepancyId" value={discrepancyId} />

          <div>
            <label className="label" htmlFor="resolution">
              Hướng xử lý
            </label>
            <select
              id="resolution"
              name="resolution"
              value={resolution}
              onChange={(e) => setResolution(e.target.value as DiscrepancyResolution)}
              disabled={!canResolve}
              className="input disabled:bg-slate-100"
            >
              {RESOLUTIONS.map((value) => (
                <option key={value} value={value}>
                  {RESOLUTION_LABEL[value]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">{RESOLUTION_EFFECT[resolution]}</p>
          </div>

          <div>
            <label className="label" htmlFor="responsibility">
              Trách nhiệm
            </label>
            <select
              id="responsibility"
              name="responsibility"
              defaultValue={'SUPPLIER' satisfies Responsibility}
              disabled={!canResolve}
              className="input disabled:bg-slate-100"
            >
              {RESPONSIBILITIES.map((value) => (
                <option key={value} value={value}>
                  {RESPONSIBILITY_LABEL[value]}
                </option>
              ))}
            </select>
          </div>

          {resolution === 'CREDIT' ? (
            <div>
              <label className="label" htmlFor="creditAmount">
                Số tiền giảm trừ (VND)
              </label>
              <input
                id="creditAmount"
                name="creditAmount"
                type="number"
                min={1}
                step={1}
                max={Math.round(suggestedCredit)}
                defaultValue={Math.round(suggestedCredit)}
                disabled={!canResolve}
                className="input disabled:bg-slate-100"
              />
              <p className="mt-1 text-xs text-slate-500">
                Trần giảm trừ là {Math.round(suggestedCredit).toLocaleString('vi-VN')} đ, tính theo
                đơn giá đơn hàng đã gồm thuế. Không được vượt trần này.
              </p>
            </div>
          ) : null}

          <div>
            <label className="label" htmlFor="note">
              Căn cứ xử lý
            </label>
            <textarea
              id="note"
              name="note"
              rows={3}
              required
              disabled={!canResolve}
              className="input disabled:bg-slate-100"
              placeholder="Biên bản hiện trường ngày 26/08, hai bên thống nhất giảm trừ phần hàng lỗi."
            />
          </div>

          <button type="submit" className="btn-primary" disabled={disabled || !canResolve}>
            Chốt hướng xử lý
          </button>
          <p className="text-xs text-slate-500">{hint}</p>
        </>
      )}
    </ActionForm>
  );
}
