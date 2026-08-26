import { test, expect } from '@playwright/test';
import { actor, USERS } from './helpers';

/**
 * FUL-03 — Hàng bị từ chối khi nhận phải tự mở hồ sơ sai lệch.
 *
 * Phiếu nhận hàng gốc giữ nguyên số đã ghi; mọi điều chỉnh về sau đi qua hồ sơ
 * sai lệch, đúng nguyên tắc không sửa bản ghi đã phát hành.
 */
test('Nhận hàng có hàng bị từ chối sẽ mở hồ sơ sai lệch', async ({ browser }) => {
  test.slow();

  // Dựng nhanh một đơn hàng đã được nhà cung cấp xác nhận.
  const requester = await actor(browser, USERS.requester);
  await requester.page.goto('/de-nghi-mua/moi');
  // Chọn đúng vật tư thép để nhà cung cấp thép nằm trong danh sách được mời.
  await requester.page
    .getByLabel('Vật tư')
    .first()
    .selectOption({ label: 'VT-TH-D12 — Thép thanh vằn D12 CB400-V' });
  await requester.page.getByLabel('Số lượng').first().fill('1000');
  await requester.page.getByRole('button', { name: 'Lưu đề nghị mua' }).click();
  await expect(requester.page.getByRole('heading', { name: /Đề nghị mua PR-/ })).toBeVisible();
  const prUrl = requester.page.url();
  await requester.page.getByRole('button', { name: 'Trình duyệt' }).click();
  await expect(requester.page.getByText('Đã trình', { exact: true })).toBeVisible();
  await requester.close();

  const approver = await actor(browser, USERS.approver);
  await approver.page.goto(prUrl);
  await approver.page.getByLabel('Lý do quyết định').fill('Duyệt để kiểm thử sai lệch');
  await approver.page.getByRole('button', { name: 'Phê duyệt' }).click();
  await expect(approver.page.getByText('Đã duyệt', { exact: true })).toBeVisible();
  await approver.close();

  const buyer = await actor(browser, USERS.buyer);
  await buyer.page.goto(prUrl);
  await buyer.page.getByRole('link', { name: 'Tạo yêu cầu báo giá' }).click();
  await buyer.page.getByRole('button', { name: 'Phát hành yêu cầu báo giá' }).click();
  const rfqHeading = buyer.page.getByRole('heading', { name: /Yêu cầu báo giá RFQ-/ });
  await expect(rfqHeading).toBeVisible();
  const rfqUrl = buyer.page.url();
  // Chọn đúng RFQ vừa tạo, không dựa vào thứ tự danh sách.
  const rfqCode = (await rfqHeading.textContent())!.replace('Yêu cầu báo giá ', '').trim();

  const supplier = await actor(browser, USERS.supplierSteel);
  await supplier.page.goto('/bao-gia');
  await supplier.page.getByRole('link', { name: rfqCode }).click();
  await supplier.page.getByRole('button', { name: 'Nộp báo giá' }).click();
  await expect(supplier.page.getByRole('heading', { name: /Báo giá đã nộp \(BG-/ })).toBeVisible();
  await supplier.close();

  await buyer.page.goto(rfqUrl);
  await buyer.page.getByLabel('Lý do lựa chọn').fill('Nhà cung cấp duy nhất nộp báo giá');
  await buyer.page.getByRole('button', { name: 'Chọn nhà cung cấp' }).click();
  await expect(buyer.page.getByRole('heading', { name: 'Kết quả lựa chọn' })).toBeVisible();
  await buyer.page.getByRole('link', { name: 'Phát hành đơn hàng' }).click();
  await buyer.page.getByLabel('Địa điểm giao hàng').fill('Công trường Cát Tường Phú Sinh');
  await buyer.page.getByRole('button', { name: 'Phát hành đơn hàng' }).click();
  await expect(buyer.page.getByRole('heading', { name: /Đơn hàng PO-/ })).toBeVisible();
  const poUrl = buyer.page.url();
  await buyer.close();

  const winner = await actor(browser, USERS.supplierSteel);
  await winner.page.goto(poUrl);
  await winner.page.getByRole('button', { name: 'Xác nhận đơn hàng' }).click();
  await expect(winner.page.getByText('NCC đã xác nhận')).toBeVisible();
  await winner.close();

  // Nhận 1000 nhưng chỉ chấp nhận 900, từ chối 100 vì hàng lỗi.
  const receiver = await actor(browser, USERS.receiver);
  await receiver.page.goto(poUrl);
  await receiver.page.getByLabel(/Số lượng giao/).first().fill('1000');
  await receiver.page.getByLabel(/Số lượng chấp nhận/).first().fill('900');
  await receiver.page.getByLabel(/Lý do từ chối/).first().fill('Thép cong vênh, gỉ sét bề mặt');
  await receiver.page.getByRole('button', { name: 'Ghi nhận nhận hàng' }).click();

  await expect(receiver.page.getByRole('heading', { name: /Phiếu nhận hàng \(1\)/ })).toBeVisible();
  // Phiếu ghi nhận một phần vì có hàng bị từ chối.
  await expect(receiver.page.getByText('Nhận một phần').first()).toBeVisible();

  // Phiếu nhận hàng lưu đúng số đã giao và số bị từ chối, không bị sửa về sau.
  await receiver.page.goto('/nhan-hang');
  await expect(receiver.page.getByText('Thép cong vênh, gỉ sét bề mặt').first()).toBeVisible();
  await receiver.close();
});
