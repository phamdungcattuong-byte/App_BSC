'use client';

import { ActionForm } from '@/components/action-form';
import { declareBankAccountAction, decideBankAccountAction } from '@/app/(app)/de-nghi-thanh-toan/actions';

export function DeclareAccountForm() {
  return (
    <ActionForm action={declareBankAccountAction} className="space-y-4">
      {(disabled) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="bankName">
                Ngân hàng
              </label>
              <input id="bankName" name="bankName" required className="input" placeholder="Vietcombank" />
            </div>
            <div>
              <label className="label" htmlFor="branch">
                Chi nhánh
              </label>
              <input id="branch" name="branch" className="input" placeholder="Chi nhánh Bình Dương" />
            </div>
            <div>
              <label className="label" htmlFor="accountNumber">
                Số tài khoản
              </label>
              <input
                id="accountNumber"
                name="accountNumber"
                required
                inputMode="numeric"
                className="input"
                placeholder="0071000123456"
              />
            </div>
            <div>
              <label className="label" htmlFor="accountHolder">
                Chủ tài khoản
              </label>
              <input
                id="accountHolder"
                name="accountHolder"
                required
                className="input"
                placeholder="CONG TY TNHH THEP XAY DUNG DONG A"
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={disabled}>
            Khai tài khoản
          </button>
          <p className="text-xs text-slate-500">
            Tài khoản mới luôn ở trạng thái chờ xác minh. Khai tài khoản mới sẽ vô hiệu tài khoản
            đang dùng, và bên mua phải xác minh lại trước khi chi tiền.
          </p>
        </>
      )}
    </ActionForm>
  );
}

export function VerifyAccountPanel({ accountId }: { accountId: string }) {
  return (
    <ActionForm action={decideBankAccountAction} className="space-y-3">
      {(disabled) => (
        <>
          <input type="hidden" name="accountId" value={accountId} />
          <div>
            <label className="label" htmlFor={`reason-${accountId}`}>
              Căn cứ xác minh
            </label>
            <input
              id={`reason-${accountId}`}
              name="reason"
              className="input"
              placeholder="Đối chiếu với hợp đồng và xác nhận qua điện thoại người đại diện"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" name="decision" value="VERIFY" className="btn-primary" disabled={disabled}>
              Xác minh
            </button>
            <button type="submit" name="decision" value="REJECT" className="btn-danger" disabled={disabled}>
              Từ chối
            </button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
