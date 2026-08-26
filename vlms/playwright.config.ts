import { defineConfig, devices } from '@playwright/test';

/**
 * Kiểm thử end-to-end đi hết luồng nghiệp vụ của sàn.
 *
 * Chạy: npm run test:e2e
 * Điều kiện: PostgreSQL đang chạy, đã seed dữ liệu, ứng dụng đã build.
 *
 * Trên máy lập trình viên chỉ cần chạy `npx playwright install chromium` một lần.
 * Trong CI có sẵn Chromium, đặt biến CHROMIUM_PATH để dùng bản có sẵn thay vì tải lại.
 */
const executablePath = process.env.CHROMIUM_PATH;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  timeout: 120_000,
  // Server Action đi trọn vòng máy chủ rồi render lại trang, nên cho biên độ rộng hơn mặc định.
  expect: { timeout: 15_000 },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run start',
        url: 'http://127.0.0.1:3000/dang-nhap',
        reuseExistingServer: true,
        timeout: 60_000,
      },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000',
    locale: 'vi-VN',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
});
