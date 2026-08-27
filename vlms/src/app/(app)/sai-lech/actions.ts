'use server';

import { DiscrepancyResolution, DiscrepancyType, Responsibility } from '@prisma/client';
import { assertPermission, requireUser } from '@/lib/auth';
import { toActionError } from '@/lib/errors';
import {
  createDiscrepancy,
  resolveDiscrepancy,
  respondToDiscrepancy,
} from '@/features/discrepancy/service';

export interface ActionState {
  error?: string;
  ok?: string;
  redirectTo?: string;
}

export async function createDiscrepancyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let discrepancyId: string;
  try {
    const user = await requireUser();
    await assertPermission(user, 'discrepancy', 'create');

    const type = String(formData.get('type')) as DiscrepancyType;
    if (!Object.values(DiscrepancyType).includes(type)) {
      return { error: 'Loại sai lệch không hợp lệ.' };
    }
    const quantity = Number(formData.get('quantity'));
    if (!Number.isFinite(quantity)) return { error: 'Số lượng sai lệch không hợp lệ.' };

    discrepancyId = await createDiscrepancy(user, {
      grnLineId: String(formData.get('grnLineId')),
      type,
      quantity,
      description: String(formData.get('description') ?? ''),
    });
  } catch (error) {
    return { error: toActionError(error).message };
  }
  return { redirectTo: `/sai-lech/${discrepancyId}?tb=da-ghi-nhan-sl` };
}

export async function respondToDiscrepancyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const discrepancyId = String(formData.get('discrepancyId'));
  try {
    const user = await requireUser();
    await assertPermission(user, 'discrepancy', 'respond');
    await respondToDiscrepancy(user, discrepancyId, String(formData.get('note') ?? ''));
  } catch (error) {
    return { error: toActionError(error).message };
  }
  return { redirectTo: `/sai-lech/${discrepancyId}?tb=da-phan-hoi-sl` };
}

export async function resolveDiscrepancyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const discrepancyId = String(formData.get('discrepancyId'));
  try {
    const user = await requireUser();
    await assertPermission(user, 'discrepancy', 'resolve');

    const resolution = String(formData.get('resolution')) as DiscrepancyResolution;
    if (!Object.values(DiscrepancyResolution).includes(resolution)) {
      return { error: 'Hướng xử lý không hợp lệ.' };
    }
    const responsibility = String(formData.get('responsibility')) as Responsibility;
    if (!Object.values(Responsibility).includes(responsibility)) {
      return { error: 'Trách nhiệm không hợp lệ.' };
    }

    // Ô số tiền chỉ có ý nghĩa với hướng giảm trừ công nợ; để trống thì
    // dịch vụ tự tính theo đơn giá đơn hàng.
    const rawCredit = String(formData.get('creditAmount') ?? '').trim();
    const creditAmount =
      resolution === DiscrepancyResolution.CREDIT && rawCredit !== ''
        ? Number(rawCredit)
        : undefined;
    if (creditAmount !== undefined && !Number.isFinite(creditAmount)) {
      return { error: 'Số tiền giảm trừ không hợp lệ.' };
    }

    await resolveDiscrepancy(user, discrepancyId, {
      resolution,
      responsibility,
      note: String(formData.get('note') ?? ''),
      creditAmount,
    });
  } catch (error) {
    return { error: toActionError(error).message };
  }
  return { redirectTo: `/sai-lech/${discrepancyId}?tb=da-xu-ly-sl` };
}
