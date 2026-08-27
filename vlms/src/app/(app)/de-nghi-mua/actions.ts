'use server';

import { z } from 'zod';
import { assertPermission, requireUser } from '@/lib/auth';
import { toActionError } from '@/lib/errors';
import {
  createRequisition,
  decideRequisition,
  submitRequisition,
} from '@/features/requisition/service';

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

const lineSchema = z.object({
  materialId: z.string().min(1),
  wbsId: z.string().min(1, 'Chọn hạng mục WBS cho mỗi dòng.'),
  quantity: z.coerce.number().positive('Số lượng phải lớn hơn 0.'),
  estPrice: z.coerce.number().nonnegative(),
});

export async function createRequisitionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let newId: string;
  try {
    const user = await requireUser();
    await assertPermission(user, 'requisition', 'create');

    const materialIds = formData.getAll('materialId').map(String);
    const wbsIds = formData.getAll('wbsId').map(String);
    const quantities = formData.getAll('quantity').map(String);
    const prices = formData.getAll('estPrice').map(String);

    const lines = materialIds.map((materialId, i) =>
      lineSchema.parse({
        materialId,
        wbsId: wbsIds[i],
        quantity: quantities[i],
        estPrice: prices[i],
      }),
    );

    newId = await createRequisition(user, {
      projectId: String(formData.get('projectId') ?? ''),
      neededBy: new Date(String(formData.get('neededBy'))),
      note: String(formData.get('note') ?? '') || undefined,
      lines,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0].message };
    }
    return { error: toActionError(error).message };
  }

  return { redirectTo: `/de-nghi-mua/${newId}` };
}

export async function submitRequisitionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const prId = String(formData.get('prId'));
  try {
    const user = await requireUser();
    await assertPermission(user, 'requisition', 'submit');
    await submitRequisition(user, prId);
  } catch (error) {
    return { error: toActionError(error).message };
  }
  return { redirectTo: `/de-nghi-mua/${prId}?tb=da-trinh` };
}

export async function decideRequisitionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const decision = String(formData.get('decision')) === 'APPROVE' ? 'APPROVE' : 'REJECT';
  const prId = String(formData.get('prId'));
  try {
    const user = await requireUser();
    await assertPermission(user, 'requisition', 'approve');
    await decideRequisition(user, prId, decision, String(formData.get('reason') ?? ''));
  } catch (error) {
    return { error: toActionError(error).message };
  }
  return { redirectTo: `/de-nghi-mua/${prId}?tb=${decision === 'APPROVE' ? 'da-duyet' : 'da-tu-choi'}` };
}
