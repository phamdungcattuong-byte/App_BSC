import { randomUUID } from 'node:crypto';
import type { Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/db';

export interface AuditInput {
  organizationId: string;
  actorId: string;
  actorRole: Role;
  entityType: string;
  entityId: string;
  action: string;
  fromState?: string | null;
  toState?: string | null;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue;
  correlationId?: string;
}

/**
 * Ghi vết kiểm toán cho mọi chuyển trạng thái (BR-GEN-05).
 * Nhận tùy chọn transaction client để audit nằm cùng giao dịch với thay đổi dữ liệu.
 */
export async function writeAudit(
  input: AuditInput,
  tx: Prisma.TransactionClient = prisma,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.actorId,
      actorRole: input.actorRole,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      fromState: input.fromState ?? null,
      toState: input.toState ?? null,
      reason: input.reason ?? null,
      metadata: input.metadata,
      correlationId: input.correlationId ?? randomUUID(),
    },
  });
}
