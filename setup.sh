#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "❌ 需要 Node.js 来读取 JSON 配置，请先安装"
  exit 1
fi

CONFIG_JSON=$(node <<'NODE'
const fs = require('fs');
const path = require('path');
const cwd = process.cwd();

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(cwd, name), 'utf8'));
}

function merge(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) {
    return override === undefined ? base : override;
  }
  if (base && typeof base === 'object' && override && typeof override === 'object') {
    const out = { ...base };
    for (const [key, value] of Object.entries(override)) {
      out[key] = merge(base[key], value);
    }
    return out;
  }
  return override === undefined ? base : override;
}

const base = readJson('config.json');
let local = {};
try {
  local = readJson('config.local.json');
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error;
  }
}

const cfg = merge(base, local);
cfg.health_data_dir = (cfg.health_data_dir || '~/.health').replace(/^~(?=\/|$)/, process.env.HOME);
cfg.dashboard_data_dir = path.resolve(cwd, cfg.dashboard_data_dir || './dashboard/data');
process.stdout.write(JSON.stringify(cfg));
NODE
)

json_get() {
  local expression="$1"
  CONFIG_JSON="$CONFIG_JSON" node -e "const cfg = JSON.parse(process.env.CONFIG_JSON); const value = ${expression}; process.stdout.write(value == null ? '' : String(value));"
}

HEALTH_DATA_DIR="$(json_get 'cfg.health_data_dir')"
DASHBOARD_DATA_DIR="$(json_get 'cfg.dashboard_data_dir')"
ADMIN_USER_ID="$(json_get 'cfg.admin && cfg.admin.user_id')"
ADMIN_SENDER_ID="$(json_get 'cfg.admin && cfg.admin.sender_id')"
ADMIN_CHANNEL="$(json_get 'cfg.admin && cfg.admin.channel')"
ADMIN_USERNAME="$(json_get 'cfg.admin && cfg.admin.username')"
ADMIN_NAME="$(json_get 'cfg.admin && cfg.admin.name')"

if [ -z "$ADMIN_USERNAME" ] || [ -z "$ADMIN_SENDER_ID" ]; then
  echo "❌ 请先在 config.local.json 中填写 admin.username 和 admin.sender_id"
  exit 1
fi

if [ -z "$ADMIN_CHANNEL" ]; then
  ADMIN_CHANNEL="unknown"
fi

if [ -z "$ADMIN_USER_ID" ]; then
  ADMIN_USER_ID="$(node -e "const { randomUUID } = require('crypto'); console.log(randomUUID())")"
fi

if [ -z "$ADMIN_NAME" ]; then
  ADMIN_NAME="$ADMIN_USERNAME"
fi

if [ "$ADMIN_CHANNEL" = "unknown" ]; then
  DAILY_REPORT_TARGET="dm:$ADMIN_SENDER_ID"
else
  DAILY_REPORT_TARGET="$ADMIN_CHANNEL:dm:$ADMIN_SENDER_ID"
fi

echo "📁 数据目录：$HEALTH_DATA_DIR"
echo "📊 看板数据目录：$DASHBOARD_DATA_DIR"
echo "👤 管理员：$ADMIN_NAME (@$ADMIN_USERNAME, user_id=$ADMIN_USER_ID, $ADMIN_CHANNEL:$ADMIN_SENDER_ID)"

mkdir -p "$HEALTH_DATA_DIR"
mkdir -p "$DASHBOARD_DATA_DIR"
mkdir -p "$HEALTH_DATA_DIR/$ADMIN_USER_ID/diet"
mkdir -p "$HEALTH_DATA_DIR/$ADMIN_USER_ID/workout"
mkdir -p "$HEALTH_DATA_DIR/$ADMIN_USER_ID/weight"

USERS_FILE="$HEALTH_DATA_DIR/users.json"
if [ ! -f "$USERS_FILE" ]; then
  TODAY=$(date +%Y-%m-%d)
  DASHBOARD_TOKEN=$(node -e "const { randomUUID } = require('crypto'); console.log(randomUUID())")
  cat > "$USERS_FILE" <<EOF_USERS
{
  "users": [
    {
      "user_id": "$ADMIN_USER_ID",
      "sender_id": "$ADMIN_SENDER_ID",
      "channel": "$ADMIN_CHANNEL",
      "username": "$ADMIN_USERNAME",
      "identities": [
        {
          "channel": "$ADMIN_CHANNEL",
          "sender_id": "$ADMIN_SENDER_ID"
        }
      ],
      "name": "$ADMIN_NAME",
      "role": "admin",
      "status": "active",
      "dashboard_token": "$DASHBOARD_TOKEN",
      "daily_report_target": "$DAILY_REPORT_TARGET",
      "registered_at": "$TODAY",
      "last_active_at": "$TODAY"
    }
  ]
}
EOF_USERS
  echo "✅ 已初始化 users.json"
else
  echo "⏭️  users.json 已存在，跳过"
fi

INVITES_FILE="$HEALTH_DATA_DIR/invites.json"
if [ ! -f "$INVITES_FILE" ]; then
  echo '{"invites": []}' > "$INVITES_FILE"
  echo "✅ 已初始化 invites.json"
else
  echo "⏭️  invites.json 已存在，跳过"
fi

PROFILE_FILE="$HEALTH_DATA_DIR/$ADMIN_USER_ID/profile.json"
if [ ! -f "$PROFILE_FILE" ]; then
  cat > "$PROFILE_FILE" <<'EOF_PROFILE'
{
  "daily_calorie_target": 2000,
  "protein_target_g": 120,
  "carb_target_g": 250,
  "fat_target_g": 65,
  "weekly_workout_target": 3
}
EOF_PROFILE
  echo "✅ 已初始化管理员 profile.json"
else
  echo "⏭️  profile.json 已存在，跳过"
fi

RUNTIME_DIR="$SCRIPT_DIR/agent/.openclaw"
RUNTIME_CONFIG_FILE="$RUNTIME_DIR/health-config.json"
mkdir -p "$RUNTIME_DIR"
cat > "$RUNTIME_CONFIG_FILE" <<EOF_RUNTIME
{
  "health_data_dir": "$HEALTH_DATA_DIR",
  "dashboard_data_dir": "$DASHBOARD_DATA_DIR",
  "users_file": "$HEALTH_DATA_DIR/users.json",
  "invites_file": "$HEALTH_DATA_DIR/invites.json",
  "sync_lock_file": "$HEALTH_DATA_DIR/sync_lock.json",
  "default_user_id": "$ADMIN_USER_ID",
  "default_channel": "$ADMIN_CHANNEL",
  "default_sender_id": "$ADMIN_SENDER_ID",
  "default_sender_name": "$ADMIN_NAME"
}
EOF_RUNTIME

echo "✅ 已生成运行时配置：$RUNTIME_CONFIG_FILE"
echo ""
echo "下一步："
echo "  1. openclaw agents add health-agent --workspace '$SCRIPT_DIR/agent' --non-interactive"
echo "  2. openclaw agents bind --agent health-agent --bind telegram --bind feishu"
echo "  3. openclaw gateway restart"
echo "  4. 在飞书群中 @机器人，发送 '记录体重 75kg' 验证路由"
