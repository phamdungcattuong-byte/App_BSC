'use client';

import { ActionForm } from '@/components/action-form';
import { postInvoiceAction } from '@/app/(app)/don-hang/actions';

export function PostInvoicePanel({
  invoiceId,
  canPost,
  reason,
}: {
  invoiceId: string;
  canPost: boolean;
  reason: string;
}) {
  return (
    <ActionForm action={postInvoiceAction}>
      {(disabled) => (
        <>
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <button type="submit" className="btn-primary" disabled={disabled || !canPost}>
            Ghi sổ hóa đơn
          </button>
          <p className="mt-2 text-xs text-slate-500">{reason}</p>
        </>
      )}
    </ActionForm>
  );
}
