# log-weight

体重记录 Skill，从自然语言中提取体重数值并写入当日体重文件。

## 输入参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `user_sender_id` | ✅ | 用户 ID |
| `data_dir` | ✅ | 用户数据目录，如 `~/.health/{sender_id}/` |
| `content` | ✅ | 包含体重的文字描述 |
| `reply_target` | ✅ | 回复目标（群组 ID 或私聊 ID） |
| `sender_name` | ✅ | 发送者显示名（群组回复前缀用） |

## 执行流程

```
1. 用 LLM 提取体重数值，统一转换为 kg：
   - 斤：除以 2（如"150斤" → 75.0 kg）
   - 磅：乘以 0.453592（如"165 lbs" → 74.8 kg）
   - kg：直接使用

2. 读取最近一次体重记录：
   从今天往前遍历最近 7 天的 {data_dir}/weight/YYYY-MM-DD.json，取第一个存在的文件

3. 写入今日体重文件 {data_dir}/weight/YYYY-MM-DD.json

4. 异步调用 sync-dashboard skill（非阻塞）

5. 返回确认消息，附带与上次记录的对比
```

## 回复格式

```
⚖️ [sender_name 的]体重已记录
─────────────
今日体重：75.2 kg
较上次（75.8 kg）：↓ 0.6 kg

[📊 查看数据看板]
```

> 若无历史记录，省略对比行

## 数据文件格式

写入 `{data_dir}/weight/YYYY-MM-DD.json`：

```json
{
  "date": "2026-03-24",
  "time": "08:00",
  "weight_kg": 75.2,
  "source": "manual"
}
```

> V2 接入 Health Kit 后 `source` 改为 `"apple_health"` 或 `"huawei_health"`，数据层零改动
