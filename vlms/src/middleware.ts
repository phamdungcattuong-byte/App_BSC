import { NextResponse, type NextRequest } from 'next/server';
import { can, type Role } from '@/lib/rbac-shared';
import { requiredPermissionFor } from '@/lib/route-guard';

const COOKIE_NAME = 'vlms_session';

/**
 * Xác minh chữ ký phiên bằng Web Crypto vì middleware không dùng được node:crypto.
 */
async function verify(token: string, secret: string): Promise<{ role: string } | null> {
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [userId, role, expiresAt, signature] = parts;
  if (Number(expiresAt) < Date.now()) return null;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${userId}.${role}.${expiresAt}`),
  );

  // base64url không đệm, khớp với cách ký ở phía máy chủ.
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return expected === signature ? { role } : null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rule = requiredPermissionFor(pathname);
  if (!rule) return NextResponse.next();

  const secret = process.env.SESSION_SECRET;
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!secret || !token) {
    return NextResponse.redirect(new URL('/dang-nhap', request.url));
  }

  const session = await verify(token, secret);
  if (!session) {
    return NextResponse.redirect(new URL('/dang-nhap', request.url));
  }

  if (!can(session.role as Role, rule.resource, rule.action)) {
    // Yêu cầu RSC (điều hướng phía client và cả prefetch của thẻ Link) chỉ nhận
    // một mã 404 rỗng. Nếu trả nguyên trang báo lỗi dưới dạng RSC thì bộ định
    // tuyến sẽ nhớ nhầm nội dung đó cho chính địa chỉ vừa gọi, làm lần chuyển
    // trang sau đó treo. Trả 404 rỗng thì trình duyệt tự chuyển sang tải cả
    // trang, và lần đó middleware mới dựng trang báo lỗi.
    if (request.headers.get('RSC') === '1') {
      return new NextResponse(null, { status: 404 });
    }
    // Trả 404 thay vì 403 để không tiết lộ tài nguyên có tồn tại hay không.
    return NextResponse.rewrite(new URL('/khong-tim-thay', request.url), { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/vat-lieu/:path*',
    '/de-nghi-mua/:path*',
    '/hoi-gia/:path*',
    '/bao-gia/:path*',
    '/don-hang/:path*',
    '/nhan-hang/:path*',
    '/hoa-don/:path*',
    '/sai-lech/:path*',
    '/tai-khoan-ngan-hang/:path*',
    '/de-nghi-thanh-toan/:path*',
    '/cong-no/:path*',
    '/nhat-ky/:path*',
  ],
};
