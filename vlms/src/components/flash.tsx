const MESSAGES: Record<string, string> = {
  'da-trinh': 'Đã trình duyệt đề nghị mua.',
  'da-duyet': 'Đã phê duyệt đề nghị mua.',
  'da-tu-choi': 'Đã từ chối đề nghị mua.',
  'da-nop-bao-gia': 'Đã nộp báo giá. Báo giá đã nộp không sửa được.',
  'da-chon-ncc': 'Đã chọn nhà cung cấp trúng thầu.',
  'da-xac-nhan-po': 'Đã xác nhận đơn hàng.',
  'da-nhan-hang': 'Đã ghi nhận phiếu nhận hàng.',
  'da-ghi-so': 'Đã ghi sổ hóa đơn.',
};

/**
 * Thông báo kết quả sau khi Server Action điều hướng lại trang.
 *
 * Dùng tham số truy vấn thay vì làm mới phía client: điều hướng tới một địa chỉ
 * khác luôn dựng lại trang với dữ liệu mới, không phụ thuộc thời điểm router
 * hoàn tất việc làm mới.
 */
export function Flash({ code }: { code?: string }) {
  if (!code) return null;
  const message = MESSAGES[code];
  if (!message) return null;

  return (
    <p
      role="status"
      className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
    >
      {message}
    </p>
  );
}
