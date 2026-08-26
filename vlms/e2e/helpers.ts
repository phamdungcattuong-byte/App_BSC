import { expect, type Browser, type Page } from '@playwright/test';

export const PASSWORD = 'matkhau123';

export const USERS = {
  requester: 'denghi@cattuong.vn',
  buyer: 'muahang@cattuong.vn',
  approver: 'pheduyet@cattuong.vn',
  receiver: 'nhanhang@cattuong.vn',
  ap: 'ketoan@cattuong.vn',
  supplierSteel: 'ncc.thep@donga.vn',
  supplierGeneral: 'ncc.vlxd@namphat.vn',
} as const;

export async function login(page: Page, email: string): Promise<void> {
  await page.goto('/dang-nhap');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/bang-dieu-khien/);
}

/**
 * Chờ trang hydrate xong trước khi thao tác.
 * Bấm nút khi React chưa gắn sự kiện sẽ làm form gửi đi mà giao diện không cập nhật.
 */
export async function waitReady(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(/dang-nhap/);
}

/**
 * Mở một phiên trình duyệt độc lập cho từng vai.
 *
 * Luồng mua hàng đi qua sáu vai khác nhau. Dùng chung một tab và đăng xuất
 * đăng nhập liên tục khiến router cache phía client tích tụ trạng thái của
 * phiên trước. Mỗi vai một context là cách mô phỏng đúng thực tế: sáu người
 * khác nhau, trên sáu máy khác nhau.
 */
export async function actor(browser: Browser, email: string) {
  const context = await browser.newContext({ locale: 'vi-VN' });
  const page = await context.newPage();
  if (process.env.E2E_TRACE_POSTS) {
    const who = email.split('@')[0];
    page.on('response', (r) => {
      if (r.request().method() === 'POST') {
        console.log(`[POST ${r.status()}] ${who} -> ${r.url().replace(/^https?:\/\/[^/]+/, '')}`);
      }
    });
    page.on('pageerror', (e) => console.log(`[pageerror ${who}]`, e.message.slice(0, 200)));
  }
  await login(page, email);
  return {
    page,
    close: () => context.close(),
  };
}
