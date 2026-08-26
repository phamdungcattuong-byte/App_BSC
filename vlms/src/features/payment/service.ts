import { randomUUID } from 'node:crypto';
import {
  BankAccountStatus,
  InvoiceStatus,
  PaymentRequestStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { nextDocCode } from '@/lib/doc-code';
import { runIdempotent } from '@/lib/idempotency';
import { conflict, dependency, invalid } from '@/lib/errors';
import { BUSINESS_PARAMS, resolveApprovalTier } from '@/lib/config/business-params';
import type { SessionUser } from '@/lib/auth';
import { num } from '@/lib/money';

// ------------------------------------------------ Tài khoản ngân hàng

/**
 * Nhà cung cấp khai tài khoản nhận tiền.
 *
 * Tài khoản mới luôn ở trạng thái chờ xác minh. Khai tài khoản mới sẽ đánh dấu
 * tài khoản cũ là bị thay thế, nhưng KHÔNG tự động chuyển trạng thái xác minh
 * sang tài khoản mới — đây là chốt chặn gian lận đổi tài khoản (CT-06).
 */
export async function declareBankAccount(
  user: SessionUser,
  input: { bankName: string; branch?: string; accountNumber: string; accountHolder: string },
): Promise<string> {
  const accountNumber = input.accountNumber.replace(/\s+/g, '');
  if (!/^\d{6,20}$/.test(accountNumber)) {
    throw invalid('Số tài khoản chỉ gồm chữ số, độ dài từ 6 đến 20.');
  }
  if (!input.bankName.trim() || !input.accountHolder.trim()) {
    throw invalid('Vui lòng nhập đầy đủ tên ngân hàng và chủ tài khoản.');
  }

  const correlationId = randomUUID();

  return prisma.$transaction(async (tx) => {
    const duplicate = await tx.supplierBankAccount.findUnique({
      where: {
        organizationId_accountNumber: { organizationId: user.organizationId, accountNumber },
      },
    });
    if (duplicate) {
      throw conflict('Số tài khoản này đã được khai trước đó.');
    }

    // Các tài khoản đang hiệu lực chuyển sang bị thay thế.
    await tx.supplierBankAccount.updateMany({
      where: {
        organizationId: user.organizationId,
        status: { in: [BankAccountStatus.VERIFIED, BankAccountStatus.PENDING] },
      },
      data: { status: BankAccountStatus.SUPERSEDED },
    });

    const account = await tx.supplierBankAccount.create({
      data: {
        organizationId: user.organizationId,
        bankName: input.bankName.trim(),
        branch: input.branch?.trim() || null,
        accountNumber,
        accountHolder: input.accountHolder.trim(),
        declaredById: user.id,
      },
    });

    await writeAudit(
      {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'SupplierBankAccount',
        entityId: account.id,
        action: 'DECLARE',
        toState: BankAccountStatus.PENDING,
        metadata: { bank: account.bankName, tail: accountNumber.slice(-4) },
        correlationId,
      },
      tx,
    );

    return account.id;
  });
}

/** Bên mua xác minh tài khoản trước khi cho phép chi tiền vào đó. */
export async function decideBankAccount(
  user: SessionUser,
  accountId: string,
  decision: 'VERIFY' | 'REJECT',
  reason: string,
): Promise<void> {
  if (decision === 'REJECT' && !reason.trim()) {
    throw invalid('Vui lòng nhập lý do từ chối tài khoản.');
  }
  const correlationId = randomUUID();

  await prisma.$transaction(async (tx) => {
    const account = await tx.supplierBankAccount.findUnique({ where: { id: accountId } });
    if (!account) throw invalid('Không tìm thấy tài khoản ngân hàng.');
    if (account.status !== BankAccountStatus.PENDING) {
      throw conflict('Chỉ tài khoản đang chờ xác minh mới xử lý được.');
    }
    // Người khai không được tự xác minh tài khoản của chính mình.
    if (account.declaredById === user.id) {
      throw invalid('Người khai tài khoản không được tự xác minh (phân tách nhiệm vụ).');
    }

    const verified = decision === 'VERIFY';
    await tx.supplierBankAccount.update({
      where: { id: accountId },
      data: {
        status: verified ? BankAccountStatus.VERIFIED : BankAccountStatus.REJECTED,
        verifiedById: user.id,
        verifiedAt: new Date(),
        rejectReason: verified ? null : reason,
      },
    });

    await writeAudit(
      {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'SupplierBankAccount',
        entityId: accountId,
        action: decision,
        fromState: BankAccountStatus.PENDING,
        toState: verified ? BankAccountStatus.VERIFIED : BankAccountStatus.REJECTED,
        reason: reason || null,
        correlationId,
      },
      tx,
    );
  });
}

// ------------------------------------------ FIN-02 Đề nghị thanh toán

/**
 * Lập đề nghị thanh toán từ các hóa đơn đã ghi sổ.
 *
 * Điều kiện bắt buộc:
 *   - Hóa đơn phải ở trạng thái POSTED, tức đã khớp đối chiếu ba chiều.
 *   - Cùng một nhà cung cấp.
 *   - Nhà cung cấp phải có tài khoản ngân hàng đã xác minh.
 *   - Hóa đơn chưa nằm trong đề nghị thanh toán nào còn hiệu lực.
 */
export async function createPaymentRequest(
  user: SessionUser,
  invoiceIds: string[],
  note?: string,
): Promise<string> {
  if (invoiceIds.length === 0) {
    throw invalid('Phải chọn ít nhất một hóa đơn để lập đề nghị thanh toán.');
  }
  const correlationId = randomUUID();

  return prisma.$transaction(async (tx) => {
    const invoices = await tx.invoice.findMany({
      where: { id: { in: invoiceIds }, buyerOrgId: user.organizationId },
      include: { paymentLines: { include: { paymentRequest: true } } },
    });

    if (invoices.length !== invoiceIds.length) {
      throw invalid('Có hóa đơn không thuộc tổ chức của bạn.');
    }

    const notPosted = invoices.filter((i) => i.status !== InvoiceStatus.POSTED);
    if (notPosted.length > 0) {
      throw dependency(
        `Chỉ thanh toán được hóa đơn đã ghi sổ. Hóa đơn chưa đạt: ${notPosted
          .map((i) => i.code)
          .join(', ')}.`,
      );
    }

    const alreadyRequested = invoices.filter((i) =>
      i.paymentLines.some((l) => l.paymentRequest.status !== PaymentRequestStatus.REJECTED),
    );
    if (alreadyRequested.length > 0) {
      throw conflict(
        `Hóa đơn đã nằm trong đề nghị thanh toán khác: ${alreadyRequested
          .map((i) => i.code)
          .join(', ')}.`,
      );
    }

    const supplierIds = new Set(invoices.map((i) => i.supplierOrgId));
    if (supplierIds.size > 1) {
      throw invalid('Mỗi đề nghị thanh toán chỉ gồm hóa đơn của một nhà cung cấp.');
    }
    const supplierOrgId = invoices[0].supplierOrgId;

    const bankAccount = await tx.supplierBankAccount.findFirst({
      where: { organizationId: supplierOrgId, status: BankAccountStatus.VERIFIED },
      orderBy: { verifiedAt: 'desc' },
    });
    if (!bankAccount) {
      throw dependency(
        'Nhà cung cấp chưa có tài khoản ngân hàng được xác minh. Không thể lập đề nghị thanh toán.',
      );
    }

    const total = invoices.reduce((sum, i) => sum + num(i.grandTotal), 0);
    const code = await nextDocCode(tx, 'DNTT', { organizationId: user.organizationId });

    const request = await tx.paymentRequest.create({
      data: {
        code,
        buyerOrgId: user.organizationId,
        supplierOrgId,
        bankAccountId: bankAccount.id,
        totalAmount: new Prisma.Decimal(total),
        dueDate: new Date(Date.now() + BUSINESS_PARAMS.paymentTermDays * 86_400_000),
        note,
        createdById: user.id,
        lines: {
          create: invoices.map((i) => ({ invoiceId: i.id, amount: i.grandTotal })),
        },
      },
    });

    await writeAudit(
      {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'PaymentRequest',
        entityId: request.id,
        action: 'CREATE',
        toState: PaymentRequestStatus.DRAFT,
        metadata: { code, total, invoiceCount: invoices.length },
        correlationId,
      },
      tx,
    );

    return request.id;
  });
}

export async function submitPaymentRequest(user: SessionUser, requestId: string): Promise<void> {
  const correlationId = randomUUID();

  await prisma.$transaction(async (tx) => {
    const request = await tx.paymentRequest.findFirst({
      where: { id: requestId, buyerOrgId: user.organizationId },
      include: { bankAccount: true },
    });
    if (!request) throw invalid('Không tìm thấy đề nghị thanh toán.');
    if (request.status !== PaymentRequestStatus.DRAFT) {
      throw conflict('Chỉ đề nghị ở trạng thái nháp mới trình duyệt được.');
    }
    if (request.createdById !== user.id) {
      throw invalid('Chỉ người lập mới được trình duyệt đề nghị này.');
    }
    // Tài khoản có thể bị thay thế sau khi lập đề nghị.
    if (request.bankAccount.status !== BankAccountStatus.VERIFIED) {
      throw dependency(
        'Tài khoản ngân hàng gắn với đề nghị này không còn hiệu lực. Hãy lập lại đề nghị.',
      );
    }

    await tx.paymentRequest.update({
      where: { id: requestId },
      data: { status: PaymentRequestStatus.SUBMITTED, submittedAt: new Date() },
    });

    await writeAudit(
      {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'PaymentRequest',
        entityId: requestId,
        action: 'SUBMIT',
        fromState: PaymentRequestStatus.DRAFT,
        toState: PaymentRequestStatus.SUBMITTED,
        correlationId,
      },
      tx,
    );
  });
}

/**
 * FIN-02 — Phê duyệt đề nghị thanh toán.
 *
 * Ba chốt kiểm soát cùng lúc:
 *   1. Người lập không tự phê duyệt (phân tách nhiệm vụ).
 *   2. Người xác minh tài khoản ngân hàng không được là người phê duyệt
 *      đề nghị chi vào chính tài khoản đó (CT-06, chống gian lận đổi tài khoản).
 *   3. Tài khoản nhận tiền phải còn hiệu lực tại thời điểm phê duyệt.
 */
export async function decidePaymentRequest(
  user: SessionUser,
  requestId: string,
  decision: 'APPROVE' | 'REJECT',
  reason: string,
): Promise<void> {
  if (!reason.trim()) throw invalid('Vui lòng nhập lý do cho quyết định.');
  const correlationId = randomUUID();

  await prisma.$transaction(async (tx) => {
    const request = await tx.paymentRequest.findFirst({
      where: { id: requestId, buyerOrgId: user.organizationId },
      include: { bankAccount: true },
    });
    if (!request) throw invalid('Không tìm thấy đề nghị thanh toán.');
    if (request.status !== PaymentRequestStatus.SUBMITTED) {
      throw conflict('Đề nghị này không ở trạng thái chờ phê duyệt.');
    }
    if (request.createdById === user.id) {
      throw invalid('Người lập đề nghị không được tự phê duyệt (phân tách nhiệm vụ).');
    }

    const approved = decision === 'APPROVE';

    if (approved) {
      if (request.bankAccount.status !== BankAccountStatus.VERIFIED) {
        throw dependency('Tài khoản nhận tiền không còn hiệu lực. Không thể phê duyệt.');
      }
      if (request.bankAccount.verifiedById === user.id) {
        throw invalid(
          'Người đã xác minh tài khoản ngân hàng không được phê duyệt lệnh chi vào chính tài khoản đó.',
        );
      }
    }

    await tx.paymentRequest.update({
      where: { id: requestId },
      data: {
        status: approved ? PaymentRequestStatus.APPROVED : PaymentRequestStatus.REJECTED,
        decidedById: user.id,
        decidedAt: new Date(),
        decisionReason: reason,
      },
    });

    await writeAudit(
      {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'PaymentRequest',
        entityId: requestId,
        action: decision,
        fromState: PaymentRequestStatus.SUBMITTED,
        toState: approved ? PaymentRequestStatus.APPROVED : PaymentRequestStatus.REJECTED,
        reason,
        metadata: {
          tier: resolveApprovalTier(num(request.totalAmount)).label,
          pendingDecision: BUSINESS_PARAMS.pendingDecision,
          bankAccountTail: request.bankAccount.accountNumber.slice(-4),
        },
        correlationId,
      },
      tx,
    );
  });
}

// -------------------------------------------- FIN-03 Thực hiện chi tiền

/**
 * Ngân quỹ phát lệnh chi. Idempotent để một lần bấm hai lần không chi hai lần.
 * Hóa đơn trong đề nghị chuyển sang đã thanh toán.
 */
export async function executePayment(
  user: SessionUser,
  requestId: string,
  bankRef: string,
  idempotencyKey: string,
): Promise<{ paymentId: string; replayed: boolean }> {
  if (!bankRef.trim()) throw invalid('Vui lòng nhập số tham chiếu giao dịch ngân hàng.');
  const correlationId = randomUUID();

  const { resultId, replayed } = await runIdempotent(
    idempotencyKey,
    'payment:execute',
    async (tx) => {
      const request = await tx.paymentRequest.findFirst({
        where: { id: requestId, buyerOrgId: user.organizationId },
        include: { bankAccount: true, lines: true, payment: true },
      });
      if (!request) throw invalid('Không tìm thấy đề nghị thanh toán.');
      if (request.payment) throw conflict('Đề nghị này đã được chi.');
      if (request.status !== PaymentRequestStatus.APPROVED) {
        throw conflict('Chỉ chi tiền cho đề nghị đã được phê duyệt.');
      }
      if (request.bankAccount.status !== BankAccountStatus.VERIFIED) {
        throw dependency('Tài khoản nhận tiền không còn hiệu lực. Dừng lệnh chi.');
      }
      // Maker-checker: người lập đề nghị không được là người chi tiền.
      if (
        num(request.totalAmount) >= BUSINESS_PARAMS.paymentMakerCheckerThreshold &&
        request.createdById === user.id
      ) {
        throw invalid('Người lập đề nghị thanh toán không được đồng thời thực hiện lệnh chi.');
      }

      const code = await nextDocCode(tx, 'LC', { organizationId: user.organizationId });

      const payment = await tx.payment.create({
        data: {
          code,
          paymentRequestId: requestId,
          status: PaymentStatus.PAID,
          amount: request.totalAmount,
          bankRef: bankRef.trim(),
          executedById: user.id,
        },
      });

      await tx.paymentRequest.update({
        where: { id: requestId },
        data: { status: PaymentRequestStatus.PAID },
      });

      await tx.invoice.updateMany({
        where: { id: { in: request.lines.map((l) => l.invoiceId) } },
        data: { status: InvoiceStatus.PAID },
      });

      await writeAudit(
        {
          organizationId: user.organizationId,
          actorId: user.id,
          actorRole: user.role,
          entityType: 'Payment',
          entityId: payment.id,
          action: 'EXECUTE',
          toState: PaymentStatus.PAID,
          metadata: {
            code,
            requestCode: request.code,
            amount: num(request.totalAmount),
            bankRef: bankRef.trim(),
            bankAccountTail: request.bankAccount.accountNumber.slice(-4),
          },
          correlationId,
        },
        tx,
      );

      return payment.id;
    },
  );

  return { paymentId: resultId, replayed };
}

// ------------------------------------------------- FIN-04 Công nợ

export interface DebtRow {
  supplierId: string;
  supplierName: string;
  buckets: number[];
  overdue: number;
  total: number;
  invoiceCount: number;
}

/** Tổng hợp công nợ phải trả theo nhà cung cấp và tuổi nợ. */
export async function getSupplierDebt(organizationId: string): Promise<{
  rows: DebtRow[];
  bucketLabels: string[];
}> {
  const buckets = BUSINESS_PARAMS.debtAgingBuckets;

  const invoices = await prisma.invoice.findMany({
    where: { buyerOrgId: organizationId, status: InvoiceStatus.POSTED },
    include: { supplierOrg: { select: { id: true, name: true } } },
  });

  const now = Date.now();
  const bySupplier = new Map<string, DebtRow>();

  for (const invoice of invoices) {
    const row =
      bySupplier.get(invoice.supplierOrgId) ??
      ({
        supplierId: invoice.supplierOrgId,
        supplierName: invoice.supplierOrg.name,
        buckets: new Array(buckets.length + 1).fill(0),
        overdue: 0,
        total: 0,
        invoiceCount: 0,
      } satisfies DebtRow);

    const ageDays = Math.floor((now - invoice.issueDate.getTime()) / 86_400_000);
    const amount = num(invoice.grandTotal);

    let slot = buckets.findIndex((limit) => ageDays <= limit);
    if (slot === -1) slot = buckets.length;
    row.buckets[slot] += amount;

    if (ageDays > BUSINESS_PARAMS.paymentTermDays) row.overdue += amount;
    row.total += amount;
    row.invoiceCount += 1;

    bySupplier.set(invoice.supplierOrgId, row);
  }

  const bucketLabels = [
    ...buckets.map((limit, i) => (i === 0 ? `Đến ${limit} ngày` : `${buckets[i - 1] + 1}–${limit} ngày`)),
    `Trên ${buckets[buckets.length - 1]} ngày`,
  ];

  return {
    rows: [...bySupplier.values()].sort((a, b) => b.total - a.total),
    bucketLabels,
  };
}
