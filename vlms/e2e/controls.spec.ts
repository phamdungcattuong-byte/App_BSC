import { test, expect } from '@playwright/test';
import { login, logout, USERS } from './helpers';

/**
 * Kiểm thử các chốt kiểm soát, tương ứng bộ abuse-case CT của bộ hồ sơ BuildHub.
 */

test('CT-01 — Nhà cung cấp không xem được đề nghị mua của bên mua', async ({ page }) => {
  await login(page, USERS.supplierSteel);

  // Menu của nhà cung cấp không có mục Đề nghị mua.
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Đề nghị mua' })).toHaveCount(0);

  // Truy cập thẳng đường dẫn cũng bị chặn, không lộ dữ liệu.
  const response = await page.goto('/de-nghi-mua');
  expect(response?.status()).toBeGreaterThanOrEqual(400);

  await page.goto('/bang-dieu-khien');
  await logout(page);
});

test('Phân tách nhiệm vụ — người tạo không thấy nút phê duyệt trên chính đề nghị của mình', async ({
  page,
}) => {
  await login(page, USERS.requester);
  await page.goto('/vat-lieu');
  await page.getByRole('navigation').getByRole('link', { name: 'Đề nghị mua' }).click();
  await page.getByRole('link', { name: 'Tạo đề nghị mua' }).click();

  await page.getByLabel('Số lượng').first().fill('100');
  await page.getByRole('button', { name: 'Lưu đề nghị mua' }).click();
  await expect(page.getByRole('heading', { name: /Đề nghị mua PR-/ })).toBeVisible();

  await page.getByRole('button', { name: 'Trình duyệt' }).click();
  await expect(page.getByText('Đã trình', { exact: true })).toBeVisible();

  await page.reload();
  // Người tạo không có ô quyết định, và được giải thích rõ vì sao.
  await expect(page.getByRole('button', { name: 'Phê duyệt' })).toHaveCount(0);
  await expect(page.getByText(/không thể tự phê duyệt/)).toBeVisible();
  // Nút trình duyệt vẫn hiện nhưng đã bị khóa vì chứng từ đã trình.
  await expect(page.getByRole('button', { name: 'Trình duyệt' })).toBeDisabled();

  await logout(page);
});

test('Người đề nghị không có quyền vào màn hình hóa đơn', async ({ page }) => {
  await login(page, USERS.requester);
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Hóa đơn' })).toHaveCount(0);
  const response = await page.goto('/hoa-don');
  expect(response?.status()).toBeGreaterThanOrEqual(400);
});
