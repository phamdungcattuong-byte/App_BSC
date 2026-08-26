# CTG VLMS — Sàn vật liệu xây dựng B2B

Ứng dụng thương mại vật liệu xây dựng giữa doanh nghiệp, bám baseline **61 quy trình
CTG BuildHub V1.0**. Phạm vi hiện tại là xương sống thương mại R2:

```
Đề nghị mua → Phê duyệt → Hỏi giá → Báo giá → Chọn NCC → Đơn hàng → Xác nhận
   → Nhận hàng → Hóa đơn → Đối chiếu ba chiều → Ghi sổ
   → Đề nghị thanh toán → Phê duyệt → Lệnh chi → Công nợ
```

---

## 1. Chạy trên máy Windows

### Yêu cầu

| Thành phần | Phiên bản | Ghi chú |
|---|---|---|
| Node.js | 20 trở lên | Khuyến nghị bản LTS |
| PostgreSQL | 14 trở lên | Hoặc dùng Docker theo hướng dẫn bên dưới |
| Git | bất kỳ | Để clone mã nguồn |

### Các bước

Mở **PowerShell** và chạy lần lượt:

```powershell
# 1. Lấy mã nguồn về đúng thư mục bạn muốn
cd "$env:USERPROFILE\Desktop"
git clone -b claude/phan-tich-tai-lieu-x0mf9i https://github.com/phamdungcattuong-byte/App_BSC.git "Web app sieu thi vat lieu"
cd "Web app sieu thi vat lieu\vlms"

# 2. Cài thư viện
npm install

# 3. Khởi động PostgreSQL bằng Docker (bỏ qua nếu đã có sẵn PostgreSQL)
docker run --name vlms-db -e POSTGRES_USER=vlms -e POSTGRES_PASSWORD=vlms `
  -e POSTGRES_DB=vlms -p 5432:5432 -d postgres:16

# 4. Tạo file cấu hình
Copy-Item .env.example .env
#    Mở .env, đổi SESSION_SECRET thành một chuỗi ngẫu nhiên dài ít nhất 32 ký tự.

# 5. Tạo bảng và nạp dữ liệu mẫu
npm run setup

# 6. Chạy ứng dụng
npm run dev
```

Mở trình duyệt tại **http://localhost:3000**.

### Mở bằng Google Antigravity IDE

1. Trong Antigravity chọn **File → Open Folder**.
2. Trỏ tới `C:\Users\<tên của bạn>\Desktop\Web app sieu thi vat lieu`.
3. Mở terminal tích hợp và chạy các lệnh ở bước 2 đến 6 phía trên.

Dự án là mã nguồn Next.js tiêu chuẩn nên mọi IDE hỗ trợ TypeScript đều mở được.
Không có cấu hình riêng nào ràng buộc vào một IDE cụ thể.

---

## 2. Tài khoản dùng thử

Mật khẩu chung cho mọi tài khoản: `matkhau123`

| Email | Vai trò | Làm được gì |
|---|---|---|
| `denghi@cattuong.vn` | Người đề nghị mua | Chọn vật liệu, lập và trình đề nghị mua |
| `pheduyet@cattuong.vn` | Người phê duyệt | Phê duyệt hoặc từ chối đề nghị mua |
| `muahang@cattuong.vn` | Chuyên viên mua hàng | Phát hành RFQ, so sánh báo giá, chọn NCC, phát hành đơn hàng |
| `nhanhang@cattuong.vn` | Người nhận hàng | Ghi nhận nhận hàng tại công trường |
| `ketoan@cattuong.vn` | Kế toán công nợ | Tiếp nhận hóa đơn, đối chiếu ba chiều, ghi sổ, xác minh tài khoản NCC, lập đề nghị thanh toán |
| `nganquy@cattuong.vn` | Ngân quỹ | Thực hiện lệnh chi cho đề nghị đã được phê duyệt |
| `ncc.thep@donga.vn` | Nhà cung cấp thép | Nộp báo giá, xác nhận đơn hàng |
| `ncc.ximang@binhminh.vn` | Nhà cung cấp xi măng | Nộp báo giá, xác nhận đơn hàng |
| `ncc.vlxd@namphat.vn` | Nhà cung cấp tổng hợp | Nộp báo giá, xác nhận đơn hàng |
| `quantri@buildhub.vn` | Quản trị sàn | Xem toàn bộ dữ liệu trong phạm vi tổ chức quản trị |

Để đi trọn một vòng nghiệp vụ, hãy đăng nhập lần lượt theo thứ tự bảng trên.

---

## 3. Kiến trúc

| Lớp | Công nghệ | Vị trí |
|---|---|---|
| Giao diện | Next.js 15 App Router, React 19, Tailwind CSS | `src/app` |
| Nghiệp vụ | Server Actions gọi vào các service thuần | `src/features` |
| Dữ liệu | Prisma ORM trên PostgreSQL | `prisma/schema.prisma` |
| Nền tảng | Phiên đăng nhập ký HMAC, RBAC, audit log, idempotency | `src/lib` |
| Chặn truy cập | Middleware kiểm quyền theo route trước khi render | `src/middleware.ts` |

```
src/
  app/
    dang-nhap/            Đăng nhập
    (app)/                Khu vực cần đăng nhập
      bang-dieu-khien/    Bảng điều khiển theo vai trò
      vat-lieu/           Danh mục vật liệu và giá nhà cung cấp
      de-nghi-mua/        Đề nghị mua, phê duyệt
      hoi-gia/            RFQ, so sánh báo giá, chọn nhà cung cấp
      bao-gia/            Phía nhà cung cấp nộp báo giá
      don-hang/           Đơn hàng, xác nhận, nhận hàng, hóa đơn
      nhan-hang/          Phiếu nhận hàng
      hoa-don/            Hóa đơn và kết quả đối chiếu ba chiều
      tai-khoan-ngan-hang/ Khai và xác minh tài khoản nhận tiền
      de-nghi-thanh-toan/ Đề nghị thanh toán, phê duyệt, lệnh chi
      cong-no/            Công nợ phải trả theo tuổi nợ
      nhat-ky/            Nhật ký kiểm toán
  features/               Quy tắc nghiệp vụ, tách khỏi giao diện
  lib/                    Hạ tầng dùng chung
```

---

## 4. Các chốt kiểm soát đã cài đặt

Những quy tắc này được ép ở tầng nghiệp vụ, không thể lách bằng giao diện:

| Mã | Quy tắc | Nơi cài đặt |
|---|---|---|
| BR-GEN-01 | Mọi truy vấn lọc theo `organizationId` của phiên đăng nhập | toàn bộ service |
| BR-GEN-03 | Người tạo không được tự phê duyệt chứng từ của mình | `features/requisition/service.ts` |
| BR-GEN-04 | Chặn nhận hàng vượt đơn hàng ngoài dung sai, không cho ghi đè | `features/order/service.ts` |
| BR-GEN-04 | Hóa đơn chưa khớp đối chiếu ba chiều thì không được ghi sổ | `features/finance/service.ts` |
| BR-GEN-05 | Mọi chuyển trạng thái đều ghi audit kèm người, thời điểm, lý do | `lib/audit.ts` |
| BR-GEN-05 | `Idempotency-Key` cho phát hành đơn hàng, nhận hàng và hóa đơn | `lib/idempotency.ts` |
| COM-02 | Cảnh báo dấu hiệu tách đề nghị mua để né hạn mức | `features/requisition/service.ts` |
| SRC-03 | Báo giá đã nộp bị khóa, không sửa được | `features/sourcing/service.ts` |
| SRC-05 | Chọn nhà cung cấp bắt buộc nêu lý do, lưu vĩnh viễn | `features/sourcing/service.ts` |
| AUTH-403 | Thiếu quyền trả 404, không tiết lộ tài nguyên có tồn tại hay không | `src/middleware.ts` |
| CT-06 | Đổi tài khoản ngân hàng làm mất hiệu lực tài khoản cũ, phải xác minh lại | `features/payment/service.ts` |
| CT-06 | Người xác minh tài khoản không được phê duyệt lệnh chi vào chính tài khoản đó | `features/payment/service.ts` |
| FIN-02 | Chỉ hóa đơn đã ghi sổ mới đưa được vào đề nghị thanh toán | `features/payment/service.ts` |
| FIN-02 | Một hóa đơn không nằm trong hai đề nghị thanh toán cùng lúc | `features/payment/service.ts` |
| FIN-03 | Maker-checker: người lập đề nghị không được thực hiện lệnh chi | `features/payment/service.ts` |

---

## 5. Tham số nghiệp vụ chưa được phê duyệt

> **Cảnh báo bàn giao.** Toàn bộ hạn mức, dung sai và ngưỡng trong ứng dụng là
> **giá trị tạm** để hệ thống chạy được, đặt tại một file duy nhất:
>
> `src/lib/config/business-params.ts`
>
> Chúng đang chờ **Decision Log PD-03** (chủ sở hữu: CFO / Process Owner) theo đúng
> quy tắc bàn giao *"Dev không tự đặt business rule, hạn mức, tolerance"*.
> Khi PD-03 được duyệt, sửa số tại file này kèm Change Request — không sửa rải rác
> trong mã nghiệp vụ. Chưa dùng cho giao dịch thật khi PD-03 còn treo.

| Tham số | Giá trị tạm |
|---|---|
| Hạn mức phê duyệt bậc 1 | đến 50.000.000 đ |
| Hạn mức phê duyệt bậc 2 | đến 500.000.000 đ |
| Dung sai nhận vượt đơn hàng | 2% |
| Dung sai đơn giá khi đối chiếu ba chiều | 1% |
| Hạn thanh toán mặc định | 30 ngày |
| Mốc tuổi nợ dùng cho báo cáo công nợ | 30 / 60 / 90 ngày |
| Ngưỡng điều chỉnh kho cần duyệt độc lập | 5.000.000 đ |
| Thuế suất GTGT mặc định | 8% |

---

## 6. Kiểm thử

Bộ kiểm thử end-to-end đóng vai **Execution Evidence** cho việc nghiệm thu.

```powershell
npx playwright install chromium   # chỉ cần chạy một lần
npm run build
npm run test:e2e
```

| Bài kiểm thử | Nội dung |
|---|---|
| `commerce-flow.spec.ts` | Đi trọn luồng từ đề nghị mua tới lệnh chi, qua bảy vai, mỗi vai một phiên trình duyệt riêng |
| `controls.spec.ts` | CT-01 chặn truy cập chéo tổ chức, phân tách nhiệm vụ, chặn theo vai trò |
| `payment-controls.spec.ts` | CT-06 gian lận đổi tài khoản ngân hàng, tự xác minh, và ranh giới quyền của ngân quỹ |

Kết quả trên môi trường phát triển: **7/7 đạt, khoảng 18 giây**, ổn định qua nhiều lượt chạy.

Lưu ý khi chạy: khởi động server rồi mới chạy kiểm thử, và để server ấm vài giây.
Chạy ngay lúc server vừa khởi động có thể làm bài kiểm thử đầu tiên chờ quá lâu.

Ảnh màn hình nghiệm thu nằm trong `docs/anh-man-hinh/`.

---

## 7. Lệnh thường dùng

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Chạy môi trường phát triển |
| `npm run build` | Đóng gói bản chạy thật |
| `npm run start` | Chạy bản đã đóng gói |
| `npm run typecheck` | Kiểm tra kiểu TypeScript |
| `npm run db:migrate` | Tạo và áp dụng migration |
| `npm run db:seed` | Nạp lại dữ liệu mẫu |
| `npm run db:reset` | Xóa sạch và dựng lại cơ sở dữ liệu |
| `npm run setup` | Gộp ba bước generate, migrate và seed |
| `npm run test:e2e` | Chạy kiểm thử end-to-end |

---

## 8. Phạm vi chưa làm

Những phần sau nằm ngoài đợt này, cần bổ sung trước khi dùng thật:

- Đối soát sao kê ngân hàng và hạch toán tự động (phần còn lại của FIN-03)
- Quyết toán hợp đồng và đóng công nợ cuối kỳ (FIN-04)
- Xử lý thiếu, thừa, sai và trả hàng (FUL-03)
- Kho, tồn kho và đối chiếu tiêu hao (FUL-04, FUL-05)
- Thi công, nghiệm thu, an toàn (nhóm CON)
- Đội thợ và chấm công (nhóm WRK)
- Onboarding nhà cung cấp và chấm điểm hiệu suất (nhóm SUP)
- Tích hợp ERP, hóa đơn điện tử, ngân hàng, chữ ký số
- Đăng ký tổ chức, xác minh pháp nhân, quản lý chứng chỉ (nhóm IAM ngoài đăng nhập)
- Rà soát tuân thủ Nghị định 13/2023/NĐ-CP khi thu thập dữ liệu cá nhân
