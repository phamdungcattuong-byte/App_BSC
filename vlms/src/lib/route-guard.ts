import type { Action, Resource } from '@/lib/rbac';

/**
 * Ánh xạ đường dẫn sang quyền cần có.
 *
 * Middleware dùng bảng này để chặn truy cập trước khi trang bắt đầu render,
 * nhờ vậy phản hồi có mã HTTP đúng thay vì 200 kèm màn hình lỗi.
 *
 * Quy tắc khớp: tiền tố dài nhất thắng. Nhờ đó một trang con cần quyền mạnh hơn
 * (ví dụ trang lập chứng từ cần `create`) không bị lọt qua chỉ nhờ quyền `view`
 * của cả nhóm.
 */
export const ROUTE_PERMISSIONS: Array<{
  prefix: string;
  resource: Resource;
  action: Action;
}> = [
  // Trang lập chứng từ: cần quyền tạo, không chỉ quyền xem.
  { prefix: '/de-nghi-mua/moi', resource: 'requisition', action: 'create' },
  { prefix: '/hoi-gia/moi', resource: 'rfq', action: 'create' },
  { prefix: '/don-hang/moi', resource: 'purchaseOrder', action: 'create' },
  { prefix: '/de-nghi-thanh-toan/moi', resource: 'paymentRequest', action: 'create' },
  { prefix: '/sai-lech/moi', resource: 'discrepancy', action: 'create' },

  // Trang danh sách và chi tiết: chỉ cần quyền xem.
  { prefix: '/vat-lieu', resource: 'catalog', action: 'view' },
  { prefix: '/de-nghi-mua', resource: 'requisition', action: 'view' },
  { prefix: '/hoi-gia', resource: 'rfq', action: 'view' },
  { prefix: '/bao-gia', resource: 'quote', action: 'view' },
  { prefix: '/don-hang', resource: 'purchaseOrder', action: 'view' },
  { prefix: '/nhan-hang', resource: 'grn', action: 'view' },
  { prefix: '/hoa-don', resource: 'invoice', action: 'view' },
  { prefix: '/sai-lech', resource: 'discrepancy', action: 'view' },
  { prefix: '/tai-khoan-ngan-hang', resource: 'bankAccount', action: 'view' },
  { prefix: '/de-nghi-thanh-toan', resource: 'paymentRequest', action: 'view' },
  { prefix: '/cong-no', resource: 'debt', action: 'view' },
  { prefix: '/nhat-ky', resource: 'audit', action: 'view' },
];

// Sắp xếp một lần khi nạp module để luôn xét tiền tố cụ thể nhất trước.
const RULES = [...ROUTE_PERMISSIONS].sort((a, b) => b.prefix.length - a.prefix.length);

export function requiredPermissionFor(pathname: string) {
  return RULES.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
}
