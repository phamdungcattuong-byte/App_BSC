import { notFound, redirect } from 'next/navigation';
import type { Organization, Role, User } from '@prisma/client';
import { prisma } from '@/lib/db';
import { readSessionUserId } from '@/lib/session';
import { can, type Action, type Resource } from '@/lib/rbac';
import { forbidden } from '@/lib/errors';

export type SessionUser = User & { organization: Organization };

/** Đọc người dùng của phiên hiện tại, trả về null nếu chưa đăng nhập. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const userId = await readSessionUserId();
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { organization: true },
  });

  if (!user || !user.isActive) return null;
  return user;
}

/** Bắt buộc đăng nhập; chuyển hướng về trang đăng nhập nếu chưa. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/dang-nhap');
  return user;
}

/**
 * Bắt buộc đăng nhập và có quyền tương ứng trên tài nguyên.
 *
 * Khi thiếu quyền, trả về 404 thay vì màn hình lỗi hệ thống. Đây là yêu cầu
 * AUTH-403 của mô hình lỗi: từ chối truy cập nhưng không để lộ tài nguyên đó
 * có tồn tại hay không.
 */
export async function requirePermission(
  resource: Resource,
  action: Action,
): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, resource, action)) {
    notFound();
  }
  return user;
}

/** Kiểm quyền cho Server Action, ném lỗi nghiệp vụ thay vì redirect. */
export async function assertPermission(
  user: SessionUser,
  resource: Resource,
  action: Action,
): Promise<void> {
  if (!can(user.role, resource, action)) {
    throw forbidden();
  }
}

export function isSupplier(user: SessionUser): boolean {
  return user.organization.type === 'SUPPLIER';
}

export function isBuyerSide(user: SessionUser): boolean {
  return user.organization.type === 'BUYER';
}

export function roleIn(user: SessionUser, ...roles: Role[]): boolean {
  return roles.includes(user.role);
}
