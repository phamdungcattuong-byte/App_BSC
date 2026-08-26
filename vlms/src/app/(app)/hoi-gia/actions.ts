'use server';

import { assertPermission, requireUser } from '@/lib/auth';
import { toActionError } from '@/lib/errors';
import { awardRfq, createRfqFromRequisition, submitQuote } from '@/features/sourcing/service';

export interface ActionState {
  error?: string;
  ok?: string;
  /**
   * Địa chỉ cần chuyển tới sau khi thao tác thành công.
   *
   * Không dùng redirect() của Next vì các form ở đây gọi Server Action như một
   * hàm thường; redirect() sẽ ném lỗi mà phía client không xử lý được, khiến nút
   * kẹt ở trạng thái đang gửi. Trả địa chỉ về để client tự điều hướng.
   */
  redirectTo?: string;
}

export async function createRfqAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let rfqId: string;
  try {
    const user = await requireUser();
    await assertPermission(user, 'rfq', 'create');

    const suppliers = formData.getAll('supplierOrgId').map(String).filter(Boolean);
    rfqId = await createRfqFromRequisition(
      user,
      String(formData.get('prId')),
      suppliers,
      new Date(String(formData.get('closingAt'))),
      String(formData.get('terms') ?? '') || undefined,
    );
  } catch (error) {
    return { error: toActionError(error).message };
  }

  return { redirectTo: `/hoi-gia/${rfqId}?tb=da-chon-ncc` };
}

export async function submitQuoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rfqId = String(formData.get('rfqId'));
  try {
    const user = await requireUser();
    await assertPermission(user, 'quote', 'submit');

    const rfqLineIds = formData.getAll('rfqLineId').map(String);
    const prices = formData.getAll('unitPrice').map((v) => Number(v));

    await submitQuote(
      user,
      rfqId,
      rfqLineIds.map((rfqLineId, i) => ({ rfqLineId, unitPrice: prices[i] })),
      new Date(String(formData.get('validUntil'))),
      Number(formData.get('deliveryDays')),
      String(formData.get('paymentTerms') ?? '') || undefined,
    );
  } catch (error) {
    return { error: toActionError(error).message };
  }

  return { redirectTo: `/bao-gia/${rfqId}?tb=da-nop-bao-gia` };
}

export async function awardAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const rfqId = String(formData.get('rfqId'));
  try {
    const user = await requireUser();
    await assertPermission(user, 'award', 'create');
    await awardRfq(user, rfqId, String(formData.get('quoteId')), String(formData.get('reason') ?? ''));
  } catch (error) {
    return { error: toActionError(error).message };
  }

  return { redirectTo: `/hoi-gia/${rfqId}?tb=da-chon-ncc` };
}
