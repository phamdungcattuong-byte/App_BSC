import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'vlms_session';
const MAX_AGE_SECONDS = 60 * 60 * 8;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      'SESSION_SECRET chưa được đặt hoặc ngắn hơn 32 ký tự. Xem hướng dẫn trong .env.example.',
    );
  }
  return value;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

/**
 * Phiên mang theo cả vai trò để middleware chặn được route trước khi render,
 * không phải truy vấn cơ sở dữ liệu. Chuỗi đã ký nên không sửa được từ client.
 * Đổi vai trò của một người dùng chỉ có hiệu lực sau khi họ đăng nhập lại.
 */
export function serializeSession(userId: string, role: string): string {
  const payload = `${userId}.${role}.${Date.now() + MAX_AGE_SECONDS * 1000}`;
  return `${payload}.${sign(payload)}`;
}

/** Trả về userId và vai trò nếu chữ ký hợp lệ và phiên chưa hết hạn. */
export function parseSession(
  token: string | undefined,
): { userId: string; role: string } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [userId, role, expiresAt, signature] = parts;
  const expected = sign(`${userId}.${role}.${expiresAt}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(expiresAt) < Date.now()) return null;
  return { userId, role };
}

export async function setSessionCookie(userId: string, role: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, serializeSession(userId, role), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function readSessionUserId(): Promise<string | null> {
  const store = await cookies();
  return parseSession(store.get(COOKIE_NAME)?.value)?.userId ?? null;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
