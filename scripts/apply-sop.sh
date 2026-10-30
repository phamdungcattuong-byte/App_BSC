#!/usr/bin/env bash
# Chép bộ quy trình thiết kế app (AGENTS.md, CLAUDE.md, subagent, skill, mẫu tài liệu)
# sang một dự án khác. Không ghi đè file đã có, trừ khi dùng --force.
#
# Cách dùng: scripts/apply-sop.sh <thư-mục-dự-án-đích> [--force]
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:?Cách dùng: $0 <thư-mục-dự-án-đích> [--force]}"
FORCE="${2:-}"

[ -d "$DEST" ] || { echo "Không tìm thấy thư mục: $DEST" >&2; exit 1; }

FILES=(
  AGENTS.md
  CLAUDE.md
  .claude/agents/product-manager.md
  .claude/agents/architect.md
  .claude/agents/project-manager.md
  .claude/agents/engineer.md
  .claude/agents/qa-engineer.md
  .claude/skills/thiet-ke-app/SKILL.md
  docs/sop/templates/01-prd.md
  docs/sop/templates/02-system-design.md
  docs/sop/templates/03-tasks.md
  docs/sop/templates/04-test-report.md
)

for f in "${FILES[@]}"; do
  if [ -e "$DEST/$f" ] && [ "$FORCE" != "--force" ]; then
    echo "Bỏ qua (đã có): $f"
    continue
  fi
  mkdir -p "$DEST/$(dirname "$f")"
  cp "$SRC/$f" "$DEST/$f"
  echo "Đã chép: $f"
done

echo "Xong. Kiểm tra lại AGENTS.md mục 4 (chuẩn kỹ thuật) cho phù hợp dự án đích."
