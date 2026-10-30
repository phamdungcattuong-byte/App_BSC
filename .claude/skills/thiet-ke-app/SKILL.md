---
name: thiet-ke-app
description: Chạy quy trình thiết kế app nhiều vai trò (PM → Architect → Project Manager → Engineer → QA) theo AGENTS.md, có cổng duyệt sau mỗi giai đoạn. Dùng khi người dùng muốn thiết kế / xây một app hoặc tính năng mới.
argument-hint: <mô tả ý tưởng app>
---

Ý tưởng của người dùng: $ARGUMENTS

Thực hiện quy trình ở `AGENTS.md` mục 2, lần lượt từng giai đoạn:

1. **Kiểm tra trạng thái:** xem trong `docs/` đã có `01-prd.md`, `02-system-design.md`,
   `03-tasks.md`, `04-test-report.md` chưa. Tiếp tục từ giai đoạn đầu tiên chưa xong
   (không làm lại giai đoạn đã duyệt, trừ khi người dùng yêu cầu).
2. **Giai đoạn 1** — gọi subagent `product-manager`. Trình bày tóm tắt + câu hỏi mở. **Dừng, chờ duyệt.**
3. **Giai đoạn 2** — gọi subagent `architect`. Trình bày kiến trúc, mô hình dữ liệu, rủi ro. **Dừng, chờ duyệt.**
4. **Giai đoạn 3** — gọi subagent `project-manager`. Trình bày số task, ước lượng, đường găng. **Dừng, chờ duyệt.**
5. **Giai đoạn 4** — gọi subagent `engineer` theo từng nhóm task (các task độc lập có thể chạy song song).
   Sau mỗi nhóm: báo tiến độ, test xanh / đỏ.
6. **Giai đoạn 5** — gọi subagent `qa-engineer`. Trình bày kết luận Đạt / Không đạt.
   Lỗi Nghiêm trọng / Cao → quay lại giai đoạn 4.

Ở mỗi cổng duyệt, hỏi người dùng: **Duyệt** / **Sửa (ghi rõ điểm cần sửa)** / **Dừng**.
Nếu người dùng nói "chạy liền", bỏ qua cổng duyệt nhưng vẫn báo tóm tắt mỗi giai đoạn.
