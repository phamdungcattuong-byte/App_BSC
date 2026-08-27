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

  // Bám theo đúng phiếu nhận hàng vừa lập, không dựa vào thứ tự danh sách.
  const grnCode = (await receiver.page.getByText(/^PNH-/).first().textContent())!.trim();

  // Phiếu nhận hàng lưu đúng số đã giao và số bị từ chối, không bị sửa về sau.
  await receiver.page.goto('/nhan-hang');
  await expect(receiver.page.getByText('Thép cong vênh, gỉ sét bề mặt').first()).toBeVisible();

  // Hàng bị từ chối mở sẵn hồ sơ sai lệch, người nhận hàng không phải nhập lại.
  await receiver.page.goto('/sai-lech');
  const row = receiver.page.getByRole('row').filter({ hasText: grnCode }).first();
  await expect(row).toContainText('Chờ phản hồi');
  await expect(row).toContainText('100');
  const discrepancyCode = (await row.getByRole('link').textContent())!.trim();

  // Người nhận hàng mở được hồ sơ nhưng không có quyền chốt hướng xử lý,
  // và cũng không phản hồi thay nhà cung cấp.
  await row.getByRole('link').click();
  await expect(
    receiver.page.getByRole('heading', { name: `Sai lệch ${discrepancyCode}` }),
  ).toBeVisible();
  await expect(receiver.page.getByRole('button', { name: 'Chốt hướng xử lý' })).toHaveCount(0);
  await expect(receiver.page.getByRole('button', { name: 'Gửi phản hồi' })).toHaveCount(0);
  await receiver.close();

  // Nhà cung cấp phản hồi; đây là bên duy nhất được phản hồi.
  const responder = await actor(browser, USERS.supplierSteel);
  await responder.page.goto('/sai-lech');
  await responder.page.getByRole('link', { name: discrepancyCode }).click();
  await expect(
    responder.page.getByRole('heading', { name: `Sai lệch ${discrepancyCode}` }),
  ).toBeVisible();
  // Nhà cung cấp không được tự chốt hướng xử lý.
  await expect(responder.page.getByRole('button', { name: 'Chốt hướng xử lý' })).toHaveCount(0);
  await responder.page
    .getByLabel('Nội dung phản hồi')
    .fill('Đã kiểm tra lô hàng, xác nhận 100 kg bị gỉ, đồng ý giảm trừ công nợ.');
  await responder.page.getByRole('button', { name: 'Gửi phản hồi' }).click();
  await expect(responder.page.getByText('Đang làm rõ')).toBeVisible();
  await responder.close();

  // Chuyên viên mua hàng chốt hướng xử lý: giảm trừ công nợ.
  const resolver = await actor(browser, USERS.buyer);
  await resolver.page.goto('/sai-lech');
  await resolver.page.getByRole('link', { name: discrepancyCode }).click();
  await resolver.page.getByLabel('Hướng xử lý').selectOption('CREDIT');
  await resolver.page.getByLabel('Trách nhiệm').selectOption('SUPPLIER');
  // Số tiền mặc định là trần giảm trừ theo đơn giá đơn hàng, đã gồm thuế.
  const suggested = Number(await resolver.page.getByLabel(/Số tiền giảm trừ/).inputValue());
  expect(suggested).toBeGreaterThan(0);
  await resolver.page
    .getByLabel('Căn cứ xử lý')
    .fill('Biên bản hiện trường, hai bên thống nhất giảm trừ phần hàng gỉ.');
  await resolver.page.getByRole('button', { name: 'Chốt hướng xử lý' }).click();

  await expect(resolver.page.getByText('Phiếu giảm trừ đã phát hành')).toBeVisible();
  await expect(resolver.page.getByText(/^GT-/)).toBeVisible();
  await expect(resolver.page.getByText('Đã đóng')).toBeVisible();

  // Hồ sơ đã đóng thì không chốt lại được nữa.
  await expect(resolver.page.getByRole('button', { name: 'Chốt hướng xử lý' })).toBeDisabled();
  await resolver.close();

  // Khoản giảm trừ đi thẳng vào báo cáo công nợ phải trả.
  const ap = await actor(browser, USERS.ap);
  await ap.page.goto('/cong-no');
  const debtRow = ap.page.getByRole('row').filter({ hasText: 'Thép Xây dựng Đông Á' }).first();
  // Tùy dư nợ sẵn có, khoản giảm trừ hoặc được đối trừ ngay, hoặc treo lại chờ
  // hóa đơn kỳ sau. Cả hai trường hợp đều phải hiện trên dòng công nợ.
  await expect(debtRow).toContainText(/-\s?[\d.]+|chưa đối trừ/);

  // Thẻ tổng hợp phải phản ánh khoản giảm trừ, dù đã đối trừ hay còn treo.
  const creditCard = ap.page.locator('div.card').filter({ hasText: 'Giảm trừ từ sai lệch' }).first();
  await expect(creditCard).toContainText(/[1-9]/);

  // Giảm trừ vượt dư nợ không bao giờ đẩy công nợ phải trả xuống số âm.
  const netCard = ap.page.locator('div.card').filter({ hasText: 'Thực phải trả' }).first();
  await expect(netCard).not.toContainText(/-\s?\d/);
  await ap.close();
});
