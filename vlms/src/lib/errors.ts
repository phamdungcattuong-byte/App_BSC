/**
 * Mô hình lỗi theo tài liệu 03 mục "Error Model" của bộ hồ sơ BuildHub.
 * Mã lỗi hiển thị cho người dùng bằng tiếng Việt, không lộ chi tiết kỹ thuật.
 */
export type ErrorCode =
  | 'VAL-400'
  | 'AUTH-401'
  | 'AUTH-403'
  | 'CONFLICT-409'
  | 'DUP-409'
  | 'DEP-422'
  | 'SYS-500';

export class BusinessError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}

export function forbidden(message = 'Bạn không có quyền thực hiện thao tác này.'): BusinessError {
  return new BusinessError('AUTH-403', message);
}

export function invalid(message: string, details?: Record<string, unknown>): BusinessError {
  return new BusinessError('VAL-400', message, details);
}

export function conflict(message: string, details?: Record<string, unknown>): BusinessError {
  return new BusinessError('CONFLICT-409', message, details);
}

export function dependency(message: string, details?: Record<string, unknown>): BusinessError {
  return new BusinessError('DEP-422', message, details);
}

/** Chuẩn hóa lỗi bất kỳ thành thông điệp an toàn để trả về giao diện. */
export function toActionError(error: unknown): { code: ErrorCode; message: string } {
  if (error instanceof BusinessError) return { code: error.code, message: error.message };
  console.error('[VLMS] Lỗi không mong đợi:', error);
  return { code: 'SYS-500', message: 'Hệ thống gặp sự cố. Vui lòng thử lại.' };
}
