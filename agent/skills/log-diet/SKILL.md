# log-diet

饮食记录 Skill，支持文字和图片两种输入方式，估算热量和宏量营养素并写入当日饮食文件。

## 输入参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `user_sender_id` | ✅ | 用户 ID |
| `data_dir` | ✅ | 用户数据目录，如 `~/.health/{sender_id}/` |
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

4. 读取 {data_dir}/diet/YYYY-MM-DD.json（不存在则创建空文件）
5. 追加本餐记录，更新 total_calories / total_protein_g / total_carb_g / total_fat_g 汇总字段
6. 写回文件

7. 读取 {data_dir}/profile.json 获取每日目标
8. 计算今日累计与目标的差值，生成进度条（▓▓▓░░░）

9. 异步调用 sync-dashboard skill（非阻塞，不等待完成）

10. 返回确认消息
    - 必须明确说明“已记录”
    - 必须给出本餐热量估算和今日累计
    - 若 input_type=image，不允许只返回图片识别点评而不写入文件
    - 简短建议只能作为确认消息后的补充，不能替代记录结果
```

## 图片输入特殊要求

- 对餐食图片，默认行为是“记录饮食”而不是“点评这顿饭”
- 识别完成后必须先写入 `{data_dir}/diet/YYYY-MM-DD.json`，再组织回复
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

写入 `{data_dir}/diet/YYYY-MM-DD.json`：

```json
{
  "date": "2026-03-24",
  "meals": [
    {
      "id": "meal_001",
      "meal_type": "lunch",
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
    }
  ],
  "total_calories": 397,
  "total_protein_g": 35,
  "total_carb_g": 51,
  "total_fat_g": 4.1
}
```

> `source`：`text`（文字输入）或 `image`（图片识别）
