'use client';

import { ActionForm } from '@/components/action-form';
import { decideRequisitionAction, submitRequisitionAction } from '../actions';

/**
 * Các panel dưới đây luôn được render cho đúng vai, chỉ khóa nút khi thao tác
 * không còn khả dụng.
 *
 * Lý do: nếu panel bị gỡ khỏi cây render bởi chính kết quả action của nó,
 * transition của Server Action không kết thúc và nút kẹt ở trạng thái đang gửi.
 * Giữ panel lại còn giúp người dùng thấy vì sao thao tác không dùng được.
 */

export function SubmitPanel({ prId, canSubmit }: { prId: string; canSubmit: boolean }) {
  return (
    <ActionForm action={submitRequisitionAction}>
      {(disabled) => (
        <>
          <input type="hidden" name="prId" value={prId} />
          <button type="submit" className="btn-primary" disabled={disabled || !canSubmit}>
            Trình duyệt
          </button>
          <p className="mt-2 text-xs text-slate-500">
            {canSubmit
              ? 'Hệ thống kiểm ngân sách còn lại của từng hạng mục WBS trước khi cho trình duyệt.'
              : 'Đề nghị mua đã được trình, không cần thao tác thêm.'}
          </p>
        </>
      )}
    </ActionForm>
  );
}

export function DecisionPanel({ prId, canDecide }: { prId: string; canDecide: boolean }) {
  return (
    <ActionForm action={decideRequisitionAction} className="space-y-3">
      {(disabled) => (
        <>
          <input type="hidden" name="prId" value={prId} />
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
              placeholder="Ví dụ: đúng nhu cầu thi công tuần 12, giá trong ngân sách"
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
          {!canDecide ? (
            <p className="text-xs text-slate-500">
              Đề nghị mua này đã có quyết định, không thể phê duyệt lại.
            </p>
          ) : null}
        </>
      )}
    </ActionForm>
  );
}
