# log-workout

训练记录 Skill，解析自然语言训练描述，提取动作/组数/重量，写入当日训练文件。

## 输入参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `user_sender_id` | ✅ | 用户 ID |
| `data_dir` | ✅ | 用户数据目录，如 `~/.health/{sender_id}/` |
| `content` | ✅ | 自然语言训练描述 |
| `reply_target` | ✅ | 回复目标（群组 ID 或私聊 ID） |
| `sender_name` | ✅ | 发送者显示名（群组回复前缀用） |

## 执行流程

```
1. 用 LLM 解析训练描述，提取：
   - 动作名称（标准化：如"bench press"/"卧推"统一为"卧推"）
   - 组数（sets）
   - 每组次数（reps）
   - 重量（weight_kg，若无则为 0，如有氧运动）
   - 持续时间（duration_min，有氧类动作）
   - 类型（category）：含重量 → strength；含时间无重量 → cardio

2. 计算总容量：total_volume_kg = sets × reps × weight_kg

3. 读取 {data_dir}/workout/YYYY-MM-DD.json（不存在则创建）
4. 追加本次动作记录
5. 写回文件

6. 异步调用 sync-dashboard skill（非阻塞）

7. 返回确认消息
```

## 解析示例

| 用户输入 | 解析结果 |
|---------|---------|
| "卧推 80kg 5组10次" | name=卧推, sets=5, reps=10, weight=80, category=strength |
| "跑步40分钟" | name=跑步, duration_min=40, weight=0, category=cardio |
| "深蹲 100kg，做了4组，每组8个" | name=深蹲, sets=4, reps=8, weight=100, category=strength |

## 回复格式

```
💪 [sender_name 的]训练已记录
─────────────
卧推  5 × 10 @ 80kg
总容量：4000 kg
─────────────
今日训练：1 个动作

[📊 查看数据看板]
```

## 数据文件格式

写入 `{data_dir}/workout/YYYY-MM-DD.json`：

```json
{
  "date": "2026-03-24",
  "exercises": [
    {
      "id": "ex_001",
      "time": "09:00",
      "name": "卧推",
      "category": "strength",
      "sets": [
        {"set_no": 1, "reps": 10, "weight_kg": 80},
        {"set_no": 2, "reps": 10, "weight_kg": 80}
      ],
      "total_volume_kg": 1600
    },
    {
      "id": "ex_002",
      "time": "09:30",
      "name": "跑步",
      "category": "cardio",
      "sets": [],
      "duration_min": 30,
      "total_volume_kg": 0
    }
  ]
}
```

> `category`：`strength`（力量）或 `cardio`（有氧）
