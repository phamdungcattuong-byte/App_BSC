# CLAUDE.md

Quy định chung cho mọi AI agent nằm ở AGENTS.md (Codex cũng dùng file đó):

@AGENTS.md

## Riêng cho Claude Code

- Lệnh khởi chạy quy trình: `/thiet-ke-app <mô tả ý tưởng>` (skill ở `.claude/skills/thiet-ke-app/`).
- Mỗi vai trò là một subagent trong `.claude/agents/`: `product-manager`, `architect`,
  `project-manager`, `engineer`, `qa-engineer`. Gọi đúng subagent cho từng giai đoạn.
- Ở mỗi cổng duyệt, dùng câu hỏi lựa chọn để người dùng duyệt / yêu cầu sửa.
