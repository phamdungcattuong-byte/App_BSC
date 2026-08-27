'use server';

import { randomUUID } from 'node:crypto';
import { assertPermission, requireUser } from '@/lib/auth';
import { toActionError } from '@/lib/errors';
import {
  acknowledgePurchaseOrder,
  issuePurchaseOrder,
  receiveGoods,
} from '@/features/order/service';
import { postInvoice, receiveInvoiceAndMatch } from '@/features/finance/service';

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

export async function issuePoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let poId: string;
  try {
    const user = await requireUser();
    await assertPermission(user, 'purchaseOrder', 'issue');

    // Khóa idempotency do client sinh, giữ nguyên khi người dùng bấm lại.
    const key = String(formData.get('idempotencyKey') || randomUUID());
    const result = await issuePurchaseOrder(
      user,
      String(formData.get('awardId')),
      new Date(String(formData.get('deliveryDate'))),
      String(formData.get('deliveryAddress') ?? ''),
      key,
    );
    poId = result.poId;
  } catch (error) {
    return { error: toActionError(error).message };
  }

  return { redirectTo: `/don-hang/${poId}` };
}

export async function acknowledgePoAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const poId = String(formData.get('poId'));
  try {
    const user = await requireUser();
    await assertPermission(user, 'purchaseOrder', 'acknowledge');
    await acknowledgePurchaseOrder(user, poId);
  } catch (error) {
    return { error: toActionError(error).message };
  }
  return { redirectTo: `/don-hang/${poId}?tb=da-xac-nhan-po` };
}

export async function receiveGoodsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const poId = String(formData.get('poId'));
  try {
    const user = await requireUser();
    await assertPermission(user, 'grn', 'create');

    const poLineIds = formData.getAll('poLineId').map(String);
    const delivered = formData.getAll('deliveredQty').map((v) => Number(v));
    const accepted = formData.getAll('acceptedQty').map((v) => Number(v));
    const reasons = formData.getAll('reason').map(String);

    const lines = poLineIds
      .map((poLineId, i) => ({
        poLineId,
        deliveredQty: delivered[i],
        acceptedQty: accepted[i],
        reason: reasons[i] || undefined,
      }))
      .filter((l) => l.deliveredQty > 0);

    if (lines.length === 0) {
      return { error: 'Phải nhập số lượng giao cho ít nhất một dòng.' };
    }

    await receiveGoods(
      user,
      poId,
      lines,
      String(formData.get('vehicleNo') ?? '') || undefined,
      String(formData.get('note') ?? '') || undefined,
      String(formData.get('idempotencyKey') || randomUUID()),
    );
  } catch (error) {
    return { error: toActionError(error).message };
  }

  return { redirectTo: `/don-hang/${poId}?tb=da-nhan-hang` };
}

export async function receiveInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const poId = String(formData.get('poId'));
  let invoiceId: string;
  try {
    const user = await requireUser();
    await assertPermission(user, 'invoice', 'create');

    const poLineIds = formData.getAll('poLineId').map(String);
    const quantities = formData.getAll('quantity').map((v) => Number(v));
    const prices = formData.getAll('unitPrice').map((v) => Number(v));

    const lines = poLineIds
      .map((poLineId, i) => ({
        poLineId,
        quantity: quantities[i],
        unitPrice: prices[i],
      }))
      .filter((l) => l.quantity > 0);

    if (lines.length === 0) {
      return { error: 'Hóa đơn phải có ít nhất một dòng với số lượng lớn hơn 0.' };
    }

    const result = await receiveInvoiceAndMatch(
      user,
      poId,
      String(formData.get('invoiceCode') ?? ''),
      new Date(String(formData.get('issueDate'))),
      lines,
      String(formData.get('idempotencyKey') || randomUUID()),
    );
    invoiceId = result.invoiceId;
  } catch (error) {
    return { error: toActionError(error).message };
  }

  // Đưa người dùng tới trang hóa đơn để xem ngay kết quả đối chiếu từng dòng.
  return { redirectTo: `/hoa-don/${invoiceId}` };
}

export async function postInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const invoiceId = String(formData.get('invoiceId'));
  try {
    const user = await requireUser();
    await assertPermission(user, 'invoice', 'submit');
    await postInvoice(user, invoiceId);
  } catch (error) {
    return { error: toActionError(error).message };
  }
  return { redirectTo: `/hoa-don/${invoiceId}?tb=da-ghi-so` };
}
