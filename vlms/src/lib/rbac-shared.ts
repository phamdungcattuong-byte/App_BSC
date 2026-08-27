/**
 * Ma trận phân quyền dùng chung cho cả máy chủ và middleware.
 *
 * File này cố ý không import Prisma: middleware chạy trên Edge runtime,
 * nơi không nạp được Prisma Client.
 */

export type Role =
  | 'REQUESTER'
  | 'BUYER'
  | 'APPROVER'
  | 'RECEIVER'
  | 'AP'
  | 'TREASURY'
  | 'SUPPLIER_ADMIN'
  | 'PLATFORM_ADMIN';

/**
 * Ma trận phân quyền — role × resource × action.
 *
 * Đây là phần cụ thể hóa tài liệu 04 của bộ hồ sơ BuildHub, nơi cả 61 dòng
 * đang để cùng một giá trị mặc định. Bảng dưới đây chỉ phủ phạm vi R2 Commerce
 * (PR → RFQ → Award → PO → GRN → Invoice) và cần Process Owner rà soát.
 *
 * Nguyên tắc bắt buộc kèm theo:
 *   - Mọi truy vấn đều lọc theo organizationId của phiên đăng nhập.
 *   - Người tạo không tự phê duyệt chứng từ của mình (SoD, kiểm ở tầng nghiệp vụ).
 *   - Middleware chặn theo route trước khi render; tầng trang kiểm lại lần nữa.
 */

export type Resource =
  | 'catalog'
  | 'requisition'
  | 'rfq'
  | 'quote'
  | 'award'
  | 'purchaseOrder'
  | 'grn'
  | 'invoice'
  | 'discrepancy'
  | 'bankAccount'
  | 'paymentRequest'
  | 'payment'
  | 'debt'
  | 'audit';

export type Action =
  | 'view'
  | 'create'
  | 'submit'
  | 'approve'
  | 'issue'
  | 'acknowledge'
  | 'verify'
  | 'execute'
  | 'respond'
  | 'resolve';

type Matrix = Record<Role, Partial<Record<Resource, Action[]>>>;

const MATRIX: Matrix = {
  REQUESTER: {
    catalog: ['view'],
    requisition: ['view', 'create', 'submit'],
    purchaseOrder: ['view'],
  },
  BUYER: {
    catalog: ['view'],
    requisition: ['view'],
    rfq: ['view', 'create', 'issue'],
    quote: ['view'],
    award: ['view', 'create'],
    purchaseOrder: ['view', 'create', 'issue'],
    grn: ['view'],
    invoice: ['view'],
    // Chuyên viên mua hàng là người chốt hướng xử lý sai lệch với nhà cung cấp.
    discrepancy: ['view', 'create', 'resolve'],
    audit: ['view'],
  },
  APPROVER: {
    catalog: ['view'],
    requisition: ['view', 'approve'],
    rfq: ['view'],
    award: ['view', 'approve'],
    purchaseOrder: ['view', 'approve'],
    invoice: ['view'],
    bankAccount: ['view'],
    paymentRequest: ['view', 'approve'],
    debt: ['view'],
    audit: ['view'],
  },
  RECEIVER: {
    catalog: ['view'],
    purchaseOrder: ['view'],
    grn: ['view', 'create', 'submit'],
    // Người nhận hàng ghi nhận sai lệch nhưng không tự chốt hướng xử lý.
    discrepancy: ['view', 'create'],
  },
  AP: {
    purchaseOrder: ['view'],
    grn: ['view'],
    invoice: ['view', 'create', 'submit'],
    discrepancy: ['view'],
    // Kế toán xác minh tài khoản ngân hàng và lập đề nghị thanh toán,
    // nhưng không tự phê duyệt và không tự chi tiền.
    bankAccount: ['view', 'verify'],
    paymentRequest: ['view', 'create', 'submit'],
    debt: ['view'],
    audit: ['view'],
  },
  TREASURY: {
    purchaseOrder: ['view'],
    invoice: ['view'],
    bankAccount: ['view'],
    paymentRequest: ['view'],
    // Ngân quỹ chỉ thực hiện lệnh chi đã được phê duyệt.
    payment: ['view', 'execute'],
    debt: ['view'],
    audit: ['view'],
  },
  SUPPLIER_ADMIN: {
    catalog: ['view', 'create'],
    rfq: ['view'],
    quote: ['view', 'create', 'submit'],
    purchaseOrder: ['view', 'acknowledge'],
    grn: ['view'],
    invoice: ['view', 'create', 'submit'],
    // Nhà cung cấp tự khai tài khoản nhận tiền, nhưng không tự xác minh.
    bankAccount: ['view', 'create'],
    paymentRequest: ['view'],
    payment: ['view'],
    // Nhà cung cấp phản hồi sai lệch, không được tự chốt hướng xử lý.
    discrepancy: ['view', 'respond'],
  },
  PLATFORM_ADMIN: {
    catalog: ['view', 'create'],
    requisition: ['view'],
    rfq: ['view'],
    quote: ['view'],
    award: ['view'],
    purchaseOrder: ['view'],
    grn: ['view'],
    invoice: ['view'],
    discrepancy: ['view'],
    bankAccount: ['view'],
    paymentRequest: ['view'],
    payment: ['view'],
    debt: ['view'],
    audit: ['view'],
  },
};

export function can(role: Role, resource: Resource, action: Action): boolean {
  return MATRIX[role]?.[resource]?.includes(action) ?? false;
}

const ROLE_LABELS: Record<Role, string> = {
  REQUESTER: 'Người đề nghị mua',
  BUYER: 'Chuyên viên mua hàng',
  APPROVER: 'Người phê duyệt',
  RECEIVER: 'Người nhận hàng',
  AP: 'Kế toán công nợ',
  TREASURY: 'Ngân quỹ',
  SUPPLIER_ADMIN: 'Quản trị nhà cung cấp',
  PLATFORM_ADMIN: 'Quản trị sàn',
};

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}
