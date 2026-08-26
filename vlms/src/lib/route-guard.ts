import type { Action, Resource } from '@/lib/rbac';

/**
 * Ánh xạ tiền tố đường dẫn sang quyền cần có.
 * Middleware dùng bảng này để chặn truy cập trước khi trang bắt đầu render,
 * nhờ vậy phản hồi có mã HTTP đúng thay vì 200 kèm màn hình lỗi.
 */
export const ROUTE_PERMISSIONS: Array<{
  prefix: string;
  resource: Resource;
  action: Action;
}> = [
  { prefix: '/vat-lieu', resource: 'catalog', action: 'view' },
  { prefix: '/de-nghi-mua', resource: 'requisition', action: 'view' },
  { prefix: '/hoi-gia', resource: 'rfq', action: 'view' },
  { prefix: '/bao-gia', resource: 'quote', action: 'view' },
  { prefix: '/don-hang', resource: 'purchaseOrder', action: 'view' },
  { prefix: '/nhan-hang', resource: 'grn', action: 'view' },
  { prefix: '/hoa-don', resource: 'invoice', action: 'view' },
  { prefix: '/nhat-ky', resource: 'audit', action: 'view' },
];

export function requiredPermissionFor(pathname: string) {
  return ROUTE_PERMISSIONS.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  );
}
