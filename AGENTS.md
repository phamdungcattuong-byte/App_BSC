# AGENTS.md — Quy trình thiết kế app (dùng chung cho Claude Code và Codex)

File này là **nguồn quy định duy nhất** cho mọi AI agent làm việc trong repo.
- **Codex** đọc trực tiếp file này.
- **Claude Code** đọc qua `CLAUDE.md` (file đó import file này).

Quy trình mô phỏng SOP nhiều vai trò của MetaGPT (PM → Kiến trúc → Lập kế hoạch → Lập trình → QA),
nhưng chạy bằng chính Claude Code / Codex, không cài thêm framework.

---

## 1. Nguyên tắc bắt buộc

1. **Không viết code khi chưa có tài liệu được duyệt.** Thứ tự: PRD → Thiết kế hệ thống → Danh sách task → Code → Kiểm thử.
2. **Mỗi giai đoạn có một "cổng duyệt" (gate).** Agent dừng lại, tóm tắt, và chờ người dùng duyệt trước khi sang giai đoạn sau — trừ khi người dùng nói rõ "chạy liền".
3. **Tài liệu là đầu ra chính**, lưu trong `docs/` theo mẫu ở `docs/sop/templates/`. Code phải truy được về task, task truy được về yêu cầu (mã `REQ-xx`).
4. **Ngôn ngữ:** tài liệu và giao diện người dùng bằng tiếng Việt; tên biến, hàm, bảng dữ liệu bằng tiếng Anh.
5. **Không đưa dữ liệu thật** (tài chính, nhân sự, khách hàng, mật khẩu, API key) vào prompt, tài liệu hay dữ liệu mẫu. Dùng dữ liệu giả.
6. **Nêu rủi ro và giả định** ở mọi giai đoạn — không im lặng giả định.

## 2. Các vai trò và đầu ra

| # | Vai trò | Đầu vào | Đầu ra (file) | Cổng duyệt |
|---|---------|---------|---------------|------------|
| 1 | Product Manager | Ý tưởng / yêu cầu của người dùng | `docs/01-prd.md` | Người dùng duyệt phạm vi, user story, tiêu chí nghiệm thu |
| 2 | Architect | PRD đã duyệt | `docs/02-system-design.md` | Duyệt kiến trúc, mô hình dữ liệu, API, phân quyền |
| 3 | Project Manager | PRD + Thiết kế | `docs/03-tasks.md` | Duyệt danh sách task, thứ tự, ước lượng |
| 4 | Engineer | Task đã duyệt | Code + test đơn vị | Mỗi task: test xanh, lint sạch |
| 5 | QA Engineer | Code + PRD | `docs/04-test-report.md` | Mọi tiêu chí nghiệm thu đạt hoặc có lý do |

Mẫu cho từng file nằm ở `docs/sop/templates/`. Chi tiết từng vai trò: `.claude/agents/*.md`
(Codex: đọc các file này như hướng dẫn vai trò).

## 3. Cách gọi quy trình

- **Claude Code:** gõ `/thiet-ke-app <mô tả ý tưởng>` hoặc nói "chạy quy trình thiết kế app".
- **Codex:** nói "Chạy quy trình thiết kế app theo AGENTS.md cho: <mô tả ý tưởng>".
- Muốn chạy một giai đoạn: "Chỉ làm giai đoạn 2 (Architect)".
- Muốn sửa giai đoạn trước: sửa file tài liệu tương ứng, rồi chạy lại các giai đoạn sau nó.

## 4. Chuẩn kỹ thuật mặc định (đổi được trong PRD)

- **Backend:** NestJS + Prisma + PostgreSQL.
- **Frontend:** Next.js (App Router) + TypeScript.
- **Bắt buộc với app nội bộ doanh nghiệp:**
  - Nhiều đơn vị / công ty con (multi-tenant): mọi bảng nghiệp vụ có `tenantId`.
  - Phân quyền theo vai trò (RBAC) — có ma trận quyền trong thiết kế.
  - Nhật ký thao tác (audit log) cho mọi thao tác tạo / sửa / xóa / duyệt.
  - Đa ngôn ngữ, mặc định `vi-VN`; định dạng tiền VND, ngày `dd/MM/yyyy`.
- **Kiểm thử:** Jest + Supertest cho API; mỗi tiêu chí nghiệm thu có ít nhất một test.

## 5. Định nghĩa "Xong" (Definition of Done)

- [ ] Code ứng với một task trong `docs/03-tasks.md`.
- [ ] Test viết và chạy xanh; lint / typecheck sạch.
- [ ] Không có bí mật (secret) trong code.
- [ ] Đã cập nhật tài liệu nếu thiết kế thay đổi.
- [ ] QA đã đối chiếu tiêu chí nghiệm thu trong `docs/04-test-report.md`.
