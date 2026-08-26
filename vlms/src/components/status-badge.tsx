const TONES: Record<string, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  info: 'bg-navy-50 text-navy-700',
  progress: 'bg-teal-50 text-teal-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-800',
  danger: 'bg-red-50 text-red-700',
};

/** Nhãn tiếng Việt và sắc thái màu cho mọi trạng thái chứng từ trong hệ thống. */
const STATUS: Record<string, { label: string; tone: keyof typeof TONES }> = {
  // Đề nghị mua
  DRAFT: { label: 'Nháp', tone: 'neutral' },
  SUBMITTED: { label: 'Đã trình', tone: 'info' },
  BUDGET_CHECK: { label: 'Đang kiểm ngân sách', tone: 'progress' },
  APPROVED: { label: 'Đã duyệt', tone: 'success' },
  REJECTED: { label: 'Từ chối', tone: 'danger' },
  CONVERTED: { label: 'Đã chuyển RFQ', tone: 'info' },
  // RFQ
  ISSUED: { label: 'Đã phát hành', tone: 'progress' },
  CLOSED: { label: 'Đã đóng', tone: 'neutral' },
  AWARDED: { label: 'Đã chọn nhà cung cấp', tone: 'success' },
  CANCELLED: { label: 'Đã hủy', tone: 'danger' },
  // Báo giá
  WON: { label: 'Trúng thầu', tone: 'success' },
  LOST: { label: 'Không trúng', tone: 'neutral' },
  // Đơn hàng
  ACKNOWLEDGED: { label: 'NCC đã xác nhận', tone: 'progress' },
  RECEIVING: { label: 'Đang nhận hàng', tone: 'progress' },
  // Nhận hàng
  ACCEPTED: { label: 'Đã nhận đủ', tone: 'success' },
  PARTIAL: { label: 'Nhận một phần', tone: 'warning' },
  QUARANTINED: { label: 'Tạm giữ', tone: 'warning' },
  // Hóa đơn
  RECEIVED: { label: 'Đã tiếp nhận', tone: 'info' },
  MATCHED: { label: 'Khớp ba chiều', tone: 'success' },
  EXCEPTION: { label: 'Có sai lệch', tone: 'danger' },
  POSTED: { label: 'Đã ghi sổ', tone: 'success' },
  // Tài khoản ngân hàng
  PENDING: { label: 'Chờ xác minh', tone: 'warning' },
  VERIFIED: { label: 'Đã xác minh', tone: 'success' },
  SUPERSEDED: { label: 'Đã thay thế', tone: 'neutral' },
  // Thanh toán
  PAID: { label: 'Đã thanh toán', tone: 'success' },
  SENT: { label: 'Đã gửi ngân hàng', tone: 'progress' },
  FAILED: { label: 'Chi thất bại', tone: 'danger' },
  // Kết quả đối chiếu
  QTY_MISMATCH: { label: 'Lệch số lượng', tone: 'danger' },
  PRICE_MISMATCH: { label: 'Lệch đơn giá', tone: 'danger' },
  MISSING_GRN: { label: 'Thiếu phiếu nhận hàng', tone: 'danger' },
  OVER_PO: { label: 'Vượt đơn hàng', tone: 'danger' },
};

export function StatusBadge({ status }: { status: string }) {
  const entry = STATUS[status] ?? { label: status, tone: 'neutral' as const };
  return <span className={`badge ${TONES[entry.tone]}`}>{entry.label}</span>;
}

export function statusLabel(status: string): string {
  return STATUS[status]?.label ?? status;
}
