# log-diet

饮食记录 Skill，支持文字和图片两种输入方式，估算热量和宏量营养素并写入当日饮食文件。

## 输入参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `user_sender_id` | ✅ | 当前渠道中的用户 ID |
| `user_id` | ✅ | 内部稳定用户 ID |
| `user_channel` | ✅ | 当前渠道，如 `telegram` / `feishu` |
| `data_dir` | ✅ | 用户数据目录，如 `~/.health/{user_id}/` |
| `input_type` | ✅ | `text` 或 `image` |
| `content` | ✅ | 文字描述或图片数据 |
| `reply_target` | ✅ | 回复目标（群组 ID 或私聊 ID） |
| `sender_name` | ✅ | 发送者显示名（群组回复前缀用） |
| `meal_time` | ❌ | 用户指定的用餐时间，如"昨天"、"早上" |

## 执行流程

```
1. 若 input_type=image：
   用 Claude Vision 识别图片中的食物种类和估算分量

2. 根据食物列表，用 LLM 逐项估算：
   - 热量（kcal）
   - 蛋白质（g）
   - 碳水（g）
   - 脂肪（g）
   热量为估算值，返回时标注"约"

3. 推断 meal_type（早/中/晚/加餐）：
   - 若用户指定 → 使用指定值
   - 否则按当前时间推断：
     06:00–09:30 → breakfast
     11:00–13:30 → lunch
     17:00–20:00 → dinner
     其他 → snack
   - 若 meal_type=snack，再细分 snack_period：
     06:00–10:59 → morning
     11:00–17:59 → afternoon
     18:00–23:59 → evening

4. 禁止直接手写 JSON；必须把记录请求组织成一个“工具入参对象”，再调用：
   `node {workspace}/../scripts/append-diet-entry.js --payload-json '<JSON>'`
5. 工具入参必须只关心：
   - `data_dir`
   - `date`
   - `time`
   - `meal_type`
   - `snack_period`（仅 snack）
   - `description`
   - `items`
   - `meal_calories`
   - `meal_protein_g`
   - `meal_carb_g`
   - `meal_fat_g`
   - `source`
   - `channel`
   - `sender_id`
   - `sender_name`
   - `raw_text`
   模型不需要关心“这是新增还是追加”，工具内部会按槽位自动判断
6. 调用前必须先保证入参合法：
   - `date = YYYY-MM-DD`
   - `time = HH:MM`
   - `meal_type ∈ {breakfast,lunch,dinner,snack}`
   - `snack` 时必须提供 `snack_period ∈ {morning,afternoon,evening}`
   - `items` 必须为非空数组，且每项至少有 `name` 和 `amount`
   - 热量和三大营养素必须是非负数
   若工具返回 `validation_error`，必须修正参数后再重试，而不是绕过工具直接写文件
7. 该工具负责读取 `{data_dir}/diet/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}.json`
   - 文件不存在则创建标准对象格式
   - 若发现旧版数组格式，先迁移为标准对象格式
   - 按餐次槽位追加写入并更新 total_calories / total_protein_g / total_carb_g / total_fat_g
8. 餐次槽位规则：
   - `breakfast`
   - `lunch`
   - `dinner`
   - `snack:morning`
   - `snack:afternoon`
   - `snack:evening`
   只允许这 6 个槽位，不允许再创建其他自定义槽位
   同一天同一槽位再次记录时，应合并到已有槽位：
   - 早餐可追加
   - 午餐可追加
   - 晚餐可追加
   - 上午加餐可追加
   - 下午加餐可追加
   - 晚上加餐可追加
   例如“早餐一份肠粉”后再说“还有一杯豆浆”，应并入同一个 breakfast 槽

9. 工具成功后会返回：
   - 命中的 `slot_key`
   - 当前槽位聚合后的 `slot`
   - 今日累计 `daily_totals`

10. 读取 {data_dir}/profile.json 获取每日目标
11. 计算今日累计与目标的差值，生成进度条（▓▓▓░░░）

12. 异步调用 sync-dashboard skill（非阻塞，不等待完成）

13. 返回确认消息
    - 必须明确说明“已记录”
    - 必须给出本餐热量估算和今日累计
    - 若 input_type=image，不允许只返回图片识别点评而不写入文件
    - 简短建议只能作为确认消息后的补充，不能替代记录结果
```

## 图片输入特殊要求

- 对餐食图片，默认行为是“记录饮食”而不是“点评这顿饭”
- 识别完成后必须先写入 `{data_dir}/diet/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}.json`，再组织回复
- 回复第一句必须是确认句，例如：`✅ 午餐已记录（图片识别）`
- 回复中必须包含：菜品估算、`本餐合计`、`今日累计`
- 可选建议最多 2 句，放在最后，且不能喧宾夺主
- 禁止输出类似“健康度 7/10、减脂友好度 6.5/10”这类主观打分作为主结果

## 回复格式

```
✅ [sender_name 的]午餐已记录[（图片识别）]
─────────────
米饭      约 200g  ~232 kcal
鸡胸肉    约 150g  ~165 kcal  蛋白质 ~31g
─────────────
本餐合计：~397 kcal
今日累计：897 / 2000 kcal ▓▓▓▓░░░░░░ 45%

[📊 查看数据看板]
```

> 群组场景：前缀加发送者姓名，如"✅ A 的午餐已记录"
> 私聊场景：省略姓名前缀，直接"✅ 午餐已记录"

## 错误处理

| 错误情况 | 处理方式 |
|---------|---------|
| 图片无法识别食物 | 回复"无法识别图片中的食物，请描述您吃了什么" |
| 文件写入失败 | 回复"记录失败，请稍后重试"并记录错误日志 |

## 数据文件格式

写入 `{data_dir}/diet/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}.json`：

```json
{
  "date": "2026-03-24",
  "meals": [
    {
      "id": "meal_001",
      "meal_type": "lunch",
      "slot_key": "lunch",
      "time": "12:30",
      "description": "米饭 + 鸡胸肉",
      "source": "image",
      "items": [
        {
          "name": "米饭",
          "amount": "200g",
          "calories_est": 232,
          "protein_est_g": 4,
          "carb_est_g": 51,
          "fat_est_g": 0.5
        }
      ],
      "meal_calories": 397,
      "meal_protein_g": 35,
      "meal_carb_g": 51,
      "meal_fat_g": 4.1
    },
    {
      "id": "meal_002",
      "meal_type": "snack",
      "snack_period": "afternoon",
      "slot_key": "snack:afternoon",
      "time": "16:20",
      "description": "希腊酸奶 + 香蕉",
      "source": "text",
      "items": [],
      "meal_calories": 180,
      "meal_protein_g": 11,
      "meal_carb_g": 18,
      "meal_fat_g": 4
    }
  ],
  "total_calories": 577,
  "total_protein_g": 46,
  "total_carb_g": 69,
  "total_fat_g": 8.1
}
```

> `source`：`text`（文字输入）或 `image`（图片识别）
> 同一天同一 `slot_key` 再次记录时，应合并到现有 meal，而不是新建第二个早餐、第二个午餐、第二个晚餐或第二个同时间段加餐
