---
name: send-greeting
description: Generate and send short greeting messages in Chinese for chats, onboarding, customer support, or daily check-ins. Use when the user asks to create a greeting skill, send a welcome message, draft a friendly opener, or prepare reusable greeting templates for different tones and times of day.
---

# Send Greeting

## Overview

Generate concise, natural greeting text that fits the context, tone, and time of day.
Prefer short messages that sound human rather than overly formal or generic.

## Workflow

1. Identify the scenario: first contact, daily greeting, welcome, follow-up, holiday, or group greeting.
2. Identify the tone: warm, professional, casual, upbeat, or respectful.
3. Identify whether the greeting should be generic or personalized with a name, team, or context.
4. Draft 1 to 3 options unless the user requests a single fixed message.
5. Keep the greeting brief by default; add one short follow-up sentence only when helpful.

## Output Guidelines

- Prefer Chinese unless the user requests another language.
- Keep default greetings within 1 to 2 sentences.
- Avoid exaggerated enthusiasm, emoji spam, or salesy language unless explicitly requested.
- If the recipient is unknown, use neutral wording.
- If the greeting is meant to be sent immediately, make it copy-ready.

## Reusable Templates

### 通用问候

- 你好，今天辛苦啦，有什么我可以帮你的？
- 早上好，祝你今天顺顺利利。
- 晚上好，今天过得怎么样？

### 欢迎语

- 欢迎加入，有任何问题随时告诉我。
- 你好，欢迎来到这里，我可以帮你快速上手。
- 欢迎～后面如果你需要帮助，直接找我就行。

### 稍正式一点

- 您好，很高兴为您服务，有需要可以随时告诉我。
- 您好，欢迎联系我，我会尽快协助您处理。
- 您好，祝您今天工作顺利。

### 更轻松一点

- 嗨，来啦～
- 哈喽，今天想让我帮你做点什么？
- 在呢，直接说吧。

## Adaptation Rules

- Morning: prefer “早上好”.
- Afternoon: prefer “下午好”.
- Evening: prefer “晚上好”.
- New user or first interaction: prioritize welcome wording.
- Existing ongoing chat: prioritize natural continuation over ceremonial greeting.
- Group context: keep it shorter and less intimate.

## Examples

User request: “给客户一句简短问候语”  
Output: “您好，很高兴为您服务，有需要可以随时告诉我。”

User request: “写一个轻松点的早安问候”  
Output: “早呀，祝你今天心情和进度都在线。”

User request: “给新用户一条欢迎语”  
Output: “欢迎加入，有任何问题随时告诉我，我会帮你尽快上手。”
