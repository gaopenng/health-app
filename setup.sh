#!/bin/bash
set -e

# ── 读取配置（config.json + config.local.json 深合并）────────────────
if ! command -v node &>/dev/null; then
  echo "❌ 需要 Node.js 来读取 JSON 配置，请先安装"
  exit 1
fi

HEALTH_DATA_DIR=$(node -e "
  const fs = require('fs');
  const base = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  let local = {};
  try { local = JSON.parse(fs.readFileSync('./config.local.json', 'utf8')); } catch(e) {}
  const cfg = Object.assign({}, base, local);
  console.log(cfg.health_data_dir.replace('~', process.env.HOME));
")

ADMIN_SENDER_ID=$(node -e "
  const fs = require('fs');
  const base = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  let local = {};
  try { local = JSON.parse(fs.readFileSync('./config.local.json', 'utf8')); } catch(e) {}
  const admin = Object.assign({}, base.admin || {}, (local.admin || {}));
  console.log(admin.sender_id || '');
")

ADMIN_NAME=$(node -e "
  const fs = require('fs');
  const base = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  let local = {};
  try { local = JSON.parse(fs.readFileSync('./config.local.json', 'utf8')); } catch(e) {}
  const admin = Object.assign({}, base.admin || {}, (local.admin || {}));
  console.log(admin.name || '');
")

if [ -z "$ADMIN_SENDER_ID" ] || [ -z "$ADMIN_NAME" ]; then
  echo "❌ 请先在 config.local.json 中填写 admin.sender_id 和 admin.name"
  exit 1
fi

echo "📁 数据目录：$HEALTH_DATA_DIR"
echo "👤 管理员：$ADMIN_NAME ($ADMIN_SENDER_ID)"

# ── 创建数据目录 ─────────────────────────────────────────────────────
mkdir -p "$HEALTH_DATA_DIR"
mkdir -p "$HEALTH_DATA_DIR/$ADMIN_SENDER_ID/diet"
mkdir -p "$HEALTH_DATA_DIR/$ADMIN_SENDER_ID/workout"
mkdir -p "$HEALTH_DATA_DIR/$ADMIN_SENDER_ID/weight"

# ── 初始化 users.json ────────────────────────────────────────────────
USERS_FILE="$HEALTH_DATA_DIR/users.json"
if [ ! -f "$USERS_FILE" ]; then
  TODAY=$(date +%Y-%m-%d)
  DASHBOARD_TOKEN=$(node -e "const {randomUUID}=require('crypto');console.log(randomUUID())")
  cat > "$USERS_FILE" <<EOF
{
  "users": [
    {
      "sender_id": "$ADMIN_SENDER_ID",
      "name": "$ADMIN_NAME",
      "role": "admin",
      "status": "active",
      "dashboard_token": "$DASHBOARD_TOKEN",
      "daily_report_target": "dm:$ADMIN_SENDER_ID",
      "registered_at": "$TODAY",
      "last_active_at": "$TODAY"
    }
  ]
}
EOF
  echo "✅ 已初始化 users.json"
else
  echo "⏭️  users.json 已存在，跳过"
fi

# ── 初始化 invites.json ──────────────────────────────────────────────
INVITES_FILE="$HEALTH_DATA_DIR/invites.json"
if [ ! -f "$INVITES_FILE" ]; then
  echo '{"invites": []}' > "$INVITES_FILE"
  echo "✅ 已初始化 invites.json"
else
  echo "⏭️  invites.json 已存在，跳过"
fi

# ── 初始化管理员 profile.json ────────────────────────────────────────
PROFILE_FILE="$HEALTH_DATA_DIR/$ADMIN_SENDER_ID/profile.json"
if [ ! -f "$PROFILE_FILE" ]; then
  cat > "$PROFILE_FILE" <<'EOF'
{
  "daily_calorie_target": 2000,
  "protein_target_g": 120,
  "carb_target_g": 250,
  "fat_target_g": 65,
  "weekly_workout_target": 3
}
EOF
  echo "✅ 已初始化管理员 profile.json"
else
  echo "⏭️  profile.json 已存在，跳过"
fi

echo ""
echo "✅ 部署完成！请重启 OpenClaw"
echo ""
echo "下一步："
echo "  1. 将 agent/AGENTS.md 和 agent/skills/ 注册到 OpenClaw"
echo "  2. 将 agent/settings.json 复制到 OpenClaw 配置目录"
echo "  3. 在 Cloudflare Pages 绑定本仓库，Root directory 设为 dashboard/"
