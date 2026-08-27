import { execFileSync } from 'node:child_process';

/**
 * Nạp lại dữ liệu mẫu trước mỗi lượt chạy kiểm thử.
 *
 * Các bài kiểm thử đi qua trọn vòng đời chứng từ nên để lại trạng thái thật:
 * tài khoản ngân hàng bị thay thế, hóa đơn đã chi, hồ sơ sai lệch đã đóng.
 * Nếu chạy lượt sau trên đúng dữ liệu đó thì bài kiểm thử hỏng vì lý do không
 * liên quan tới mã nguồn. Dựng lại dữ liệu ở đây để mỗi lượt chạy bắt đầu từ
 * cùng một điểm xuất phát.
 *
 * Đặt E2E_SKIP_SEED=1 nếu muốn giữ nguyên dữ liệu đang có để soi lỗi.
 */
export default function globalSetup(): void {
  if (process.env.E2E_SKIP_SEED === '1') return;
  execFileSync('npx', ['prisma', 'db', 'seed'], { stdio: 'inherit' });
}
