import { test, expect } from '@playwright/test';
import { actor, USERS } from './helpers';

/**
 * CT-06 — Gian lận đổi tài khoản ngân hàng.
 *
 * Kịch bản: nhà cung cấp (hoặc kẻ chiếm được tài khoản của họ) khai một số tài
 * khoản mới ngay trước kỳ thanh toán. Hệ thống phải:
 *   1. Vô hiệu tài khoản cũ và đặt tài khoản mới ở trạng thái chờ xác minh.
 *   2. Chặn lập đề nghị thanh toán khi chưa có tài khoản nào được xác minh.
 *   3. Không cho người xác minh tài khoản đồng thời phê duyệt lệnh chi vào đó.
 */
test('CT-06 — Đổi tài khoản ngân hàng làm mất hiệu lực tài khoản cũ và chặn chi tiền', async ({
  browser,
}) => {
  // Trạng thái ban đầu: nhà cung cấp đã có một tài khoản được xác minh.
  const supplier = await actor(browser, USERS.supplierSteel);
  await supplier.page.goto('/tai-khoan-ngan-hang');
  await expect(supplier.page.getByText('Đã xác minh').first()).toBeVisible();

  // Khai một tài khoản mới, mô phỏng hành vi đổi tài khoản nhận tiền.
  await supplier.page.getByLabel('Ngân hàng').fill('Ngân hàng TMCP Quốc Dân');
  await supplier.page.getByLabel('Số tài khoản').fill('9999888877776');
  await supplier.page.getByLabel('Chủ tài khoản').fill('NGUYEN VAN A');
  await supplier.page.getByRole('button', { name: 'Khai tài khoản' }).click();

  await expect(supplier.page.getByText('Chờ xác minh')).toBeVisible();
  // Tài khoản cũ không còn hiệu lực.
  await expect(supplier.page.getByText('Đã thay thế')).toBeVisible();
  await expect(supplier.page.getByText('Đã xác minh')).toHaveCount(0);
  await supplier.close();

  // Kế toán không lập được đề nghị thanh toán vì không còn tài khoản hợp lệ.
  const ap = await actor(browser, USERS.ap);
  await ap.page.goto('/de-nghi-thanh-toan/moi');
  const rows = ap.page.getByText('Chưa xác minh, không chi được');
  const noInvoice = ap.page.getByText('Không có hóa đơn nào chờ thanh toán');
  await expect(rows.first().or(noInvoice)).toBeVisible();
  await ap.close();
});

test('Nhà cung cấp không tự xác minh được tài khoản của mình', async ({ browser }) => {
  const supplier = await actor(browser, USERS.supplierGeneral);
  await supplier.page.goto('/tai-khoan-ngan-hang');

  // Nhà cung cấp chỉ thấy tài khoản của chính mình và không có nút xác minh.
  await expect(supplier.page.getByRole('button', { name: 'Xác minh' })).toHaveCount(0);
  await supplier.close();
});

test('Ngân quỹ không có quyền lập hay phê duyệt đề nghị thanh toán', async ({ browser }) => {
  const treasury = await actor(browser, USERS.treasury);
  await treasury.page.goto('/de-nghi-thanh-toan');

  // Thấy danh sách để thực hiện lệnh chi, nhưng không có nút lập đề nghị.
  await expect(treasury.page.getByRole('link', { name: 'Lập đề nghị thanh toán' })).toHaveCount(0);

  // Truy cập thẳng trang lập đề nghị bị chặn trước khi render.
  const response = await treasury.page.goto('/de-nghi-thanh-toan/moi');
  expect(response?.status()).toBeGreaterThanOrEqual(400);
  await treasury.close();
});
