/**
 * THAM SỐ NGHIỆP VỤ — CHƯA ĐƯỢC PHÊ DUYỆT
 *
 * Toàn bộ giá trị trong file này là GIÁ TRỊ TẠM để hệ thống chạy được,
 * KHÔNG phải quy tắc nghiệp vụ đã chốt.
 *
 * Theo quy tắc bàn giao CTG BuildHub V1.0:
 *   "Dev không tự đặt business rule/hạn mức/tolerance."
 *
 * Các mục dưới đây đang chờ Decision Log PD-03 (Owner: CFO / Process Owner).
 * Khi PD-03 được phê duyệt, thay số tại đây — không sửa rải rác trong code
 * nghiệp vụ, và ghi Change Request kèm cập nhật Traceability.
 *
 * Mọi hằng số nghiệp vụ mới BẮT BUỘC khai báo tại file này.
 */

export type PendingDecision = 'PD-03';

export interface ApprovalTier {
  /** Ngưỡng trên của bậc, tính theo VND. null nghĩa là không giới hạn. */
  maxValue: number | null;
  /** Vai trò được phép phê duyệt ở bậc này. */
  approverRole: 'APPROVER';
  /** Số cấp phê duyệt cần thiết. */
  requiredApprovals: number;
  label: string;
}

export const BUSINESS_PARAMS = {
  /** Trạng thái phê duyệt của toàn bộ tham số trong file này. */
  status: 'PROVISIONAL' as const,
  pendingDecision: 'PD-03' as PendingDecision,
  decisionOwner: 'CFO / Process Owner',

  /**
   * COM-02 — Hạn mức phê duyệt đề nghị mua theo giá trị.
   * Bậc đầu tiên có maxValue >= giá trị PR sẽ được áp dụng.
   */
  approvalTiers: [
    { maxValue: 50_000_000, approverRole: 'APPROVER', requiredApprovals: 1, label: 'Dưới 50 triệu' },
    { maxValue: 500_000_000, approverRole: 'APPROVER', requiredApprovals: 1, label: '50 triệu đến 500 triệu' },
    { maxValue: null, approverRole: 'APPROVER', requiredApprovals: 1, label: 'Trên 500 triệu' },
  ] as ApprovalTier[],

  /**
   * COM-02 — Chống tách PR để né hạn mức.
   * Cảnh báo khi cùng dự án, cùng người đề nghị tạo nhiều PR trong cửa sổ này.
   */
  prSplitDetection: {
    windowHours: 24,
    minCount: 2,
    /** Tổng giá trị các PR trong cửa sổ vượt ngưỡng này thì cảnh báo. */
    aggregateThreshold: 50_000_000,
  },

  /**
   * FUL-02 — Tolerance nhận hàng so với số lượng còn lại trên PO.
   * Vượt ngưỡng này thì CHẶN nhận, không cho ghi đè.
   */
  receiptTolerance: {
    /** Tỷ lệ nhận vượt cho phép, 0.02 = 2%. */
    overReceiptRate: 0.02,
    /** Tỷ lệ giao thiếu vẫn coi là đóng dòng, dưới mức này không cần bổ sung. */
    underReceiptRate: 0.02,
  },

  /**
   * FIN-01 — Dung sai đối chiếu 3 chiều PO - GRN - Invoice.
   * Lệch trong dung sai thì MATCHED, ngoài dung sai thì tạo EXCEPTION.
   */
  threeWayMatchTolerance: {
    /** Chênh lệch đơn giá cho phép so với PO. */
    priceRate: 0.01,
    /** Chênh lệch số lượng hóa đơn so với số lượng đã nhận. */
    quantityRate: 0.0,
    /** Chênh lệch tuyệt đối cho phép trên tổng hóa đơn, tính theo VND. */
    absoluteAmount: 10_000,
  },

  /** FUL-04 — Ngưỡng điều chỉnh kho cần người phê duyệt độc lập. */
  inventoryAdjustmentThreshold: 5_000_000,

  /** Thuế suất GTGT mặc định khi nhà cung cấp không khai. */
  defaultTaxRate: 0.08,

  currency: 'VND',
} as const;

/** Trả về bậc phê duyệt áp dụng cho một giá trị đề nghị mua. */
export function resolveApprovalTier(value: number): ApprovalTier {
  const tier = BUSINESS_PARAMS.approvalTiers.find(
    (t) => t.maxValue === null || value <= t.maxValue,
  );
  // Bậc cuối luôn có maxValue null nên nhánh này chỉ để thỏa kiểu dữ liệu.
  return tier ?? BUSINESS_PARAMS.approvalTiers[BUSINESS_PARAMS.approvalTiers.length - 1];
}
