import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

/**
 * Chống tạo trùng bản ghi đơn hàng và tài chính khi người dùng bấm hai lần
 * hoặc client retry (BR-GEN-05, và mục 6 của tài liệu 08).
 *
 * Nếu key đã tồn tại, trả về id của bản ghi đã tạo trước đó thay vì tạo mới.
 */
export async function runIdempotent(
  key: string,
  scope: string,
  work: (tx: Prisma.TransactionClient) => Promise<string>,
): Promise<{ resultId: string; replayed: boolean }> {
  const existing = await prisma.idempotencyKey.findUnique({ where: { key } });
  if (existing) return { resultId: existing.resultId, replayed: true };

  const resultId = await prisma.$transaction(async (tx) => {
    const id = await work(tx);
    await tx.idempotencyKey.create({ data: { key, scope, resultId: id } });
    return id;
  });

  return { resultId, replayed: false };
}
