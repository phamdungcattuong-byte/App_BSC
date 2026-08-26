import { test, expect } from '@playwright/test';
import { actor, USERS } from './helpers';

/**
 * Đi trọn xương sống thương mại của sàn:
 * Đề nghị mua → Phê duyệt → Hỏi giá → Báo giá → Chọn NCC → Đơn hàng
 * → Xác nhận → Nhận hàng → Hóa đơn → Đối chiếu ba chiều → Ghi sổ.
 *
 * Mỗi vai dùng một phiên trình duyệt riêng, đúng như thực tế sáu người
 * ở sáu tổ chức và vị trí khác nhau cùng tham gia một giao dịch.
 */
test('Luồng mua hàng đầy đủ từ đề nghị mua đến ghi sổ hóa đơn', async ({ browser }) => {
  test.slow();

  // 1. Người đề nghị chọn vật liệu trong danh mục và lập đề nghị mua.
  const requester = await actor(browser, USERS.requester);
  await requester.page.goto('/vat-lieu?q=D12');
  await requester.page.getByText('Thép thanh vằn D12 CB400-V').first().click();
  await requester.page.getByRole('link', { name: 'Thêm vào đề nghị mua' }).click();

  await requester.page.getByLabel('Số lượng').first().fill('5000');
  await requester.page.getByRole('button', { name: 'Lưu đề nghị mua' }).click();

  await expect(requester.page.getByRole('heading', { name: /Đề nghị mua PR-/ })).toBeVisible();
  const prUrl = requester.page.url();

  // 2. Trình duyệt — hệ thống kiểm ngân sách còn lại của hạng mục WBS.
  await requester.page.getByRole('button', { name: 'Trình duyệt' }).click();
  await expect(requester.page.getByText('Đã trình', { exact: true })).toBeVisible();
  await expect(requester.page.getByRole('button', { name: 'Trình duyệt' })).toBeDisabled();
  // Người tạo không được tự phê duyệt: panel quyết định không hiện với họ.
  await expect(requester.page.getByRole('button', { name: 'Phê duyệt' })).toHaveCount(0);
  await requester.close();

  // 3. Người phê duyệt quyết định, bắt buộc nêu lý do.
  const approver = await actor(browser, USERS.approver);
  await approver.page.goto(prUrl);
  await approver.page.getByLabel('Lý do quyết định').fill('Đúng nhu cầu thi công, trong ngân sách');
  await approver.page.getByRole('button', { name: 'Phê duyệt' }).click();
  await expect(approver.page.getByText('Đã duyệt', { exact: true })).toBeVisible();
  await approver.close();

  // 4. Chuyên viên mua hàng phát hành RFQ tới các nhà cung cấp đủ điều kiện.
  const buyer = await actor(browser, USERS.buyer);
  await buyer.page.goto(prUrl);
  await buyer.page.getByRole('link', { name: 'Tạo yêu cầu báo giá' }).click();
  await buyer.page.getByRole('button', { name: 'Phát hành yêu cầu báo giá' }).click();

  await expect(buyer.page.getByRole('heading', { name: /Yêu cầu báo giá RFQ-/ })).toBeVisible();
  const rfqUrl = buyer.page.url();

  // 5. Hai nhà cung cấp cùng nộp báo giá để có cơ sở so sánh.
  for (const email of [USERS.supplierSteel, USERS.supplierGeneral]) {
    const supplier = await actor(browser, email);
    await supplier.page.goto('/bao-gia');
    await supplier.page.getByRole('link', { name: /RFQ-/ }).first().click();
    await supplier.page.getByRole('button', { name: 'Nộp báo giá' }).click();
    await expect(supplier.page.getByRole('heading', { name: /Báo giá đã nộp \(BG-/ })).toBeVisible();
    await supplier.close();
  }

  // 6. Bên mua so sánh trên cùng mặt bằng rồi chọn nhà cung cấp.
  await buyer.page.goto(rfqUrl);
  await expect(buyer.page.getByRole('heading', { name: 'So sánh báo giá' })).toBeVisible();
  await buyer.page.getByLabel('Lý do lựa chọn').fill('Giá thấp nhất và đủ chứng chỉ CO/CQ');
  await buyer.page.getByRole('button', { name: 'Chọn nhà cung cấp' }).click();
  await expect(buyer.page.getByRole('heading', { name: 'Kết quả lựa chọn' })).toBeVisible();

  const winnerLine = await buyer.page.getByText(/Trúng thầu:/).textContent();
  const winnerAccount = winnerLine!.includes('Đông Á')
    ? USERS.supplierSteel
    : USERS.supplierGeneral;

  // 7. Phát hành đơn hàng từ kết quả lựa chọn, không nhập tay lại giá.
  await buyer.page.getByRole('link', { name: 'Phát hành đơn hàng' }).click();
  await buyer.page
    .getByLabel('Địa điểm giao hàng')
    .fill('Công trường Cát Tường Phú Sinh, Đức Hòa');
  await buyer.page.getByRole('button', { name: 'Phát hành đơn hàng' }).click();

  await expect(buyer.page.getByRole('heading', { name: /Đơn hàng PO-/ })).toBeVisible();
  const poUrl = buyer.page.url();
  await buyer.close();

  // 8. Nhà cung cấp trúng thầu xác nhận đơn hàng.
  const winner = await actor(browser, winnerAccount);
  await winner.page.goto('/don-hang');
  await winner.page.getByRole('link', { name: /PO-/ }).first().click();
  await winner.page.getByRole('button', { name: 'Xác nhận đơn hàng' }).click();
  await expect(winner.page.getByText('NCC đã xác nhận')).toBeVisible();
  await winner.close();

  // 9. Người nhận hàng ghi nhận thực nhận tại công trường.
  const receiver = await actor(browser, USERS.receiver);
  await receiver.page.goto(poUrl);
  await expect(receiver.page.getByRole('heading', { name: 'Ghi nhận nhận hàng' })).toBeVisible();
  await receiver.page.getByLabel(/Số lượng giao/).first().fill('5000');
  await receiver.page.getByRole('button', { name: 'Ghi nhận nhận hàng' }).click();
  await expect(receiver.page.getByRole('heading', { name: /Phiếu nhận hàng \(1\)/ })).toBeVisible();
  await receiver.close();

  // 10. Kế toán tiếp nhận hóa đơn, hệ thống tự đối chiếu ba chiều.
  const ap = await actor(browser, USERS.ap);
  await ap.page.goto(poUrl);
  await ap.page.getByLabel('Số hóa đơn').fill(`HD-${Date.now()}`);
  await ap.page.getByRole('button', { name: 'Tiếp nhận và đối chiếu ba chiều' }).click();

  // Sau khi đối chiếu, hệ thống đưa thẳng tới trang hóa đơn kèm kết quả từng dòng.
  await expect(ap.page.getByRole('heading', { name: 'Kết quả đối chiếu ba chiều' })).toBeVisible();
  await expect(ap.page.getByText('Khớp ba chiều').first()).toBeVisible();

  // 11. Hóa đơn khớp mới được ghi sổ.
  await ap.page.getByRole('button', { name: 'Ghi sổ hóa đơn' }).click();
  await expect(ap.page.getByText('Đã ghi sổ', { exact: true })).toBeVisible();
  await expect(ap.page.getByRole('button', { name: 'Ghi sổ hóa đơn' })).toBeDisabled();

  // 12. Nhật ký kiểm toán lưu lại toàn bộ chuỗi hành động.
  await ap.page.goto('/nhat-ky');
  await expect(ap.page.getByText('Đối chiếu ba chiều').first()).toBeVisible();
  await ap.close();
});
