---
name: send-greeting
description: Generate short Chinese greeting or onboarding messages for the health assistant. Use when the assistant needs to welcome a new user, send a daily check-in opener, draft a brief friendly greeting, or prepare reusable greeting variants for different tones and times of day.
---

# send-greeting

为健康助手撰写简短问候语。

## 工作流程

1. 先判断场景：欢迎、日常问候、跟进、节日问候或群内问候。
2. 再判断语气：温和、专业、随意、积极或礼貌克制。
3. 决定使用通用话术还是个性化话术。
4. 除非用户要求固定单条文案，否则提供 1 到 3 个选项。
5. 保持消息简短，可直接复制使用。

## 输出要求

- 除非用户要求其他语言，否则默认使用中文。
- 默认控制在 1 到 2 句话内。
- 除非被明确要求，否则避免过度热情、表情轰炸或营销口吻。
- 在持续对话中优先使用自然衔接的表达，避免过于仪式化的措辞。

## 参考资料

- 阅读 `references/templates.md`，了解可复用的问候模板和示例。
