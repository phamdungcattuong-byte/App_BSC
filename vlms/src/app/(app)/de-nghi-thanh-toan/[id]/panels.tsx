'use client';

import { useState } from 'react';
import { ActionForm } from '@/components/action-form';
import {
  decidePaymentRequestAction,
  executePaymentAction,
  submitPaymentRequestAction,
} from '../actions';

export function SubmitRequestPanel({
  requestId,
  canSubmit,
  hint,
}: {
  requestId: string;
  canSubmit: boolean;
  hint: string;
}) {
  return (
    <ActionForm action={submitPaymentRequestAction}>
      {(disabled) => (
        <>
          <input type="hidden" name="requestId" value={requestId} />
          <button type="submit" className="btn-primary" disabled={disabled || !canSubmit}>
            Trình duyệt
          </button>
          <p className="mt-2 text-xs text-slate-500">{hint}</p>
        </>
      )}
    </ActionForm>
  );
}

export function DecideRequestPanel({
  requestId,
  canDecide,
  hint,
}: {
  requestId: string;
  canDecide: boolean;
  hint: string;
}) {
  return (
    <ActionForm action={decidePaymentRequestAction} className="space-y-3">
      {(disabled) => (
        <>
          <input type="hidden" name="requestId" value={requestId} />
          <div>
            <label className="label" htmlFor="reason">
              Lý do quyết định
            </label>
            <input
              id="reason"
              name="reason"
              required
              disabled={!canDecide}
              className="input disabled:bg-slate-100"
              placeholder="Hồ sơ đầy đủ, tài khoản nhận đã xác minh"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              name="decision"
              value="APPROVE"
              className="btn-primary"
              disabled={disabled || !canDecide}
            >
              Phê duyệt
            </button>
            <button
              type="submit"
              name="decision"
              value="REJECT"
              className="btn-danger"
              disabled={disabled || !canDecide}
            >
              Từ chối
            </button>
          </div>
          <p className="text-xs text-slate-500">{hint}</p>
        </>
      )}
    </ActionForm>
  );
}

export function ExecutePaymentPanel({
  requestId,
  canExecute,
  hint,
}: {
  requestId: string;
  canExecute: boolean;
  hint: string;
}) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  return (
    <ActionForm action={executePaymentAction} className="space-y-3">
      {(disabled) => (
        <>
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <div>
            <label className="label" htmlFor="bankRef">
              Số tham chiếu giao dịch ngân hàng
            </label>
            <input
              id="bankRef"
              name="bankRef"
              required
              disabled={!canExecute}
              className="input disabled:bg-slate-100"
              placeholder="FT26082600123456"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={disabled || !canExecute}>
            Phát lệnh chi
          </button>
          <p className="text-xs text-slate-500">{hint}</p>
        </>
      )}
    </ActionForm>
  );
}
