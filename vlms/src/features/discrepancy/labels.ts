// Chỉ nhập kiểu, không nhập giá trị: các tệp này được dùng trong component phía
// client, kéo theo runtime của Prisma sẽ làm phình gói tải về.
import type { DiscrepancyResolution, DiscrepancyType, Responsibility } from '@prisma/client';

/** Nhãn tiếng Việt cho các giá trị phân loại của hồ sơ sai lệch. */
export const DISCREPANCY_TYPE_LABEL: Record<DiscrepancyType, string> = {
  SHORTAGE: 'Giao thiếu',
  OVERAGE: 'Giao thừa',
  QUALITY: 'Không đạt chất lượng',
  WRONG_ITEM: 'Sai quy cách, sai chủng loại',
};

export const RESPONSIBILITY_LABEL: Record<Responsibility, string> = {
  SUPPLIER: 'Nhà cung cấp',
  BUYER: 'Bên mua',
  CARRIER: 'Đơn vị vận chuyển',
  UNDETERMINED: 'Chưa xác định',
};

export const RESOLUTION_LABEL: Record<DiscrepancyResolution, string> = {
  REPLACE: 'Giao bù',
  RETURN: 'Trả hàng',
  CREDIT: 'Giảm trừ công nợ',
  ACCEPT: 'Chấp nhận nguyên trạng',
};

/** Hệ quả sổ sách của từng hướng xử lý, hiển thị ngay cạnh lựa chọn. */
export const RESOLUTION_EFFECT: Record<DiscrepancyResolution, string> = {
  REPLACE: 'Nhà cung cấp giao bù phần thiếu. Không điều chỉnh số đã nhận và không điều chỉnh công nợ.',
  RETURN: 'Giảm số đã nhận trên dòng đơn hàng. Phiếu nhận hàng gốc giữ nguyên.',
  CREDIT: 'Phát hành phiếu giảm trừ, trừ thẳng vào công nợ phải trả nhà cung cấp.',
  ACCEPT: 'Đóng hồ sơ, không điều chỉnh sổ sách. Dùng khi sai lệch nằm trong mức chấp nhận được.',
};

export const DISCREPANCY_TYPES = Object.keys(DISCREPANCY_TYPE_LABEL) as DiscrepancyType[];
export const RESPONSIBILITIES = Object.keys(RESPONSIBILITY_LABEL) as Responsibility[];
export const RESOLUTIONS = Object.keys(RESOLUTION_LABEL) as DiscrepancyResolution[];
