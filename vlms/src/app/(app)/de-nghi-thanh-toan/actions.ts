'use server';

import { randomUUID } from 'node:crypto';
import { assertPermission, requireUser } from '@/lib/auth';
import { toActionError } from '@/lib/errors';
import {
  createPaymentRequest,
  decideBankAccount,
  declareBankAccount,
  decidePaymentRequest,
  executePayment,
  submitPaymentRequest,
} from '@/features/payment/service';

export interface ActionState {
  error?: string;
  ok?: string;
  redirectTo?: string;
}

export async function declareBankAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireUser();
    await assertPermission(user, 'bankAccount', 'create');
    await declareBankAccount(user, {
      bankName: String(formData.get('bankName') ?? ''),
      branch: String(formData.get('branch') ?? '') || undefined,
      accountNumber: String(formData.get('accountNumber') ?? ''),
      accountHolder: String(formData.get('accountHolder') ?? ''),
    });
  } catch (error) {
    return { error: toActionError(error).message };
  }
  return { redirectTo: '/tai-khoan-ngan-hang?tb=da-khai-tk' };
}

export async function decideBankAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const decision = String(formData.get('decision')) === 'VERIFY' ? 'VERIFY' : 'REJECT';
  try {
    const user = await requireUser();
    await assertPermission(user, 'bankAccount', 'verify');
    await decideBankAccount(
      user,
      String(formData.get('accountId')),
      decision,
      String(formData.get('reason') ?? ''),
    );
  } catch (error) {
    return { error: toActionError(error).message };
  }
  return {
    redirectTo: `/tai-khoan-ngan-hang?tb=${decision === 'VERIFY' ? 'da-xac-minh-tk' : 'da-tu-choi-tk'}`,
  };
}

export async function createPaymentRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let requestId: string;
  try {
    const user = await requireUser();
    await assertPermission(user, 'paymentRequest', 'create');
    const invoiceIds = formData.getAll('invoiceId').map(String).filter(Boolean);
    requestId = await createPaymentRequest(
      user,
      invoiceIds,
      String(formData.get('note') ?? '') || undefined,
    );
  } catch (error) {
    return { error: toActionError(error).message };
  }
  return { redirectTo: `/de-nghi-thanh-toan/${requestId}` };
}

export async function submitPaymentRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const requestId = String(formData.get('requestId'));
  try {
    const user = await requireUser();
    await assertPermission(user, 'paymentRequest', 'submit');
    await submitPaymentRequest(user, requestId);
  } catch (error) {
    return { error: toActionError(error).message };
  }
  return { redirectTo: `/de-nghi-thanh-toan/${requestId}?tb=da-trinh-tt` };
}

export async function decidePaymentRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const requestId = String(formData.get('requestId'));
  const decision = String(formData.get('decision')) === 'APPROVE' ? 'APPROVE' : 'REJECT';
  try {
    const user = await requireUser();
    await assertPermission(user, 'paymentRequest', 'approve');
    await decidePaymentRequest(user, requestId, decision, String(formData.get('reason') ?? ''));
  } catch (error) {
    return { error: toActionError(error).message };
  }
  return {
    redirectTo: `/de-nghi-thanh-toan/${requestId}?tb=${
      decision === 'APPROVE' ? 'da-duyet-tt' : 'da-tu-choi-tt'
    }`,
  };
}

export async function executePaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const requestId = String(formData.get('requestId'));
  try {
    const user = await requireUser();
    await assertPermission(user, 'payment', 'execute');
    await executePayment(
      user,
      requestId,
      String(formData.get('bankRef') ?? ''),
      String(formData.get('idempotencyKey') || randomUUID()),
    );
  } catch (error) {
    return { error: toActionError(error).message };
  }
  return { redirectTo: `/de-nghi-thanh-toan/${requestId}?tb=da-chi-tien` };
}
