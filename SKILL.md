---
name: AI-video-made-skill
description: Use when generating Chinese AI video prompts for 即梦, 可灵, Sora, Runway, or similar tools. Supports two workflows: direct generation from images + type (剧情 or 展示) + rough idea; and reference-video recreation from a reference video + the user's game/product brief. Produces separated sections: 画面风格, 场景, 角色, 具体内容, 正向提示词, 镜头设计思路.
---

# AI Video Made Skill

Use this skill to create copy-ready Chinese prompts for AI video generation.

## Invocation Intro

Whenever this skill is invoked, first output this short guide before the actual prompt, unless the user explicitly asks to skip the guide:

```text
【AI-video-made-skill 使用方式】
我可以处理两类需求：
1. 直接生成：给我参考图片 + 类型（剧情/展示）+ 大致内容，我会直接写成中文 AI 视频提示词。
2. 参考复刻：给我参考视频 + 你的游戏/产品 brief，我会先拆参考结构，再迁移成适合你产品的剧情/展示提示词。
```

Then provide the requested result.

## Required Output Sections

Always use these sections, in this order:

1. 【画面风格】
2. 【场景】
3. 【角色】
4. 【具体内容】
5. 【正向提示词】
6. 【镜头设计思路】

If the user asks to rewrite only one section, output only that section.

## Workflow A: 直接生成

Use when the user provides images, a type, and a rough idea.

Expected input:

- 参考图片: one or more character/object/scene images.
- 类型: 剧情 or 展示.
- 大致内容: what should happen, such as "独角兽黑化成灰烬战马" or "末世里踹人出门".

### A1. 展示类

Use for: 进化、黑化、变身、觉醒、稀有形态展示、时装展示、技能展示、角色展示、宠物展示。

Goal: make one character/object's visual change or showcase clear, attractive, and stylistically unified. Do not force a full plot.

Rules:

- 【场景】 must include before/after contrast when the subject changes. For 黑化/进化/净化/灾变, the environment changes with the character.
- 【角色】 describes the starting form and final form using reference-image features.
- 【具体内容】 describes continuous visual progression: camera movement, which body/material/light detail changes first, how effects spread, and the final display pose.
- End with a readable hero frame or final showcase pose.
- Dialogue is optional and usually minimal.

展示类 【具体内容】 rhythm:

```text
开场建立原始形态 -> 局部变化开始 -> 变化扩散到全身 -> 场景同步变化 -> 最终形态定格展示
```

### A2. 剧情类

Use for: 买量前贴剧情、生存钩子、反套路剧情、角色冲突、对话戏、爽文桥段、悬念剧情。

Goal: tell a short, clear conflict with hook, escalation, reversal, and suspense/payoff.

Rules:

- 【具体内容】 must use detailed storyboards unless the user asks for a shorter paragraph.
- Every storyboard must include: 时间轴、运镜、景别、场景、画面、具体内容.
- If there is dialogue, include 配音 + 声线 in the relevant storyboard.
- Do not write "字幕感文案" unless the user explicitly asks for subtitles.
- The first 3 seconds must contain a strong hook: crisis, contradiction, absurd reversal, strong visual, or urgent choice.
- Character positions must conflict clearly.
- Actions must be visible and filmable; avoid abstract-only emotions.

剧情类 storyboard template:

```text
分镜N
时间轴：
运镜：
景别：
场景：
画面：
具体内容：
配音：
```

## Workflow B: 参考视频复刻

Use when the user provides a reference video and their own game/product brief.

Expected input:

- 参考视频: file path, uploaded video, or accessible URL.
- 游戏/产品 brief: product name, genre, target audience, core gameplay, first 30 seconds of real experience, showable mechanics/selling points, forbidden claims, available assets, market/platform if known.
- Desired type if known: 剧情 or 展示. If not specified, infer from the reference video.

### B1. Analyze Reference First

Before writing the final prompt, internally identify:

- Type: 剧情类 or 展示类.
- First 3-second hook.
- Rhythm: opening image -> conflict/showcase trigger -> escalation/change -> payoff -> game/product bridge.
- Visual anchor: the memorable visible object, creature, environment, action, outfit, UI, or transformation.
- Story anchor: the emotional or narrative engine, if any.
- Camera language: push, pull, tracking, POV, close-up, freeze frame, UI display, card reveal, etc.
- Copy/voiceover structure: short lines, dialogue turns, emotional beat, or no dialogue.
- Product bridge: what real feature in the user's game can truthfully replace the reference's surface element.

### B2. Recreate Mechanism, Not Surface

"复刻" means recreate the effective structure and rhythm, not copy the competitor's literal characters, scenes, UI names, or proprietary visuals.

Use this chain:

```text
reference mechanism -> product-relevant equivalent -> concrete hook -> video prompt -> risk check
```

If the product brief does not support a reference element, replace it with a truthful equivalent or remove it.

### B3. Output For Reference Recreation

Still output the standard six sections:

- 【画面风格】: style adapted to the user's product, not blindly copied.
- 【场景】: product-native scene and any before/after scene change.
- 【角色】: product characters/assets, using placeholder labels if names are missing.
- 【具体内容】: detailed storyboards for 剧情类; continuous transformation/showcase for 展示类.
- 【正向提示词】: clean generation direction only.
- 【镜头设计思路】: explain how the reference structure was migrated.

If the brief is missing and cannot be inferred from current context, ask the user for the brief before generating a product-specific recreation.

## Section Rules

### 【画面风格】

Describe visual direction, medium, era, aspect ratio, rendering style, lighting language, and quality constraints.

Examples:

- 竖屏 9:16
- 古早日本动漫、吉卜力式奇幻氛围、手绘赛璐璐、水彩背景、低饱和胶片色
- 冷蓝环境光、红色警报灯、柔和逆光、手绘阴影块
- 无血腥、无重口、无写实3D、无现代CG高光

### 【场景】

Describe where the video happens and how the space changes. Include weather, light, layout, background movement, and environmental pressure.

For transformation/evolution/blackening, include:

- before environment
- trigger environment
- after environment

### 【角色】

Extract reference-image features into concise character descriptions:

- hairstyle, clothing, colors, body proportion, accessories
- personality or current emotional state
- role in the scene

Use placeholder names like 图1、图2、图3 when the user asks for placeholders or names are unknown.

### 【具体内容】

Put all plot, action, scene events, dialogue, product mechanics, character/object names, and reference-derived structure here.

Use concrete film language:

- 低机位推进、快速推镜、侧向跟拍、门缝主观视角、眼部特写、动作定格
- 雨水打湿头发、红灯扫过脸、门缝越来越窄、火焰从发梢蔓延、草地从脚下枯萎

### 【正向提示词】

This is not a plot summary. It should contain only generation direction, style, camera language, quality goals, and constraints.

Good examples:

- 竖屏短视频
- 古早日本动漫
- 吉卜力式末世奇幻氛围
- 手绘赛璐璐
- 水彩背景
- 二次元冒险角色
- 强戏剧冲突
- 强悬念
- 快速推镜
- 门缝构图
- 眼神特写
- 动作定格
- 紧张压迫感
- 无血腥
- 无重口恐怖
- 角色形象稳定
- 无写实3D
- 无现代CG高光

Do not include plot nouns or compressed story beats when they belong in 【具体内容】, such as specific character names, exact props, exact monsters, exact locations, or the full story action.

### 【镜头设计思路】

Keep short and practical:

- 展示类: explain before/after contrast, transformation order, and final display pose.
- 剧情类: explain first hook, escalation, reversal, and ending suspense/payoff.
- 参考视频复刻: explicitly mention which reference mechanism was migrated and how it became product-native.

## Quality Checklist

Before finalizing:

- Did the response begin with the Invocation Intro, unless skipped by user?
- Did the output use the required six section labels?
- Did the chosen workflow match the user's input?
- For 展示类, does the scene change with the character if there is transformation?
- For 剧情类, does every storyboard include 时间轴、运镜、景别、场景、画面、具体内容?
- Are dialogue lines written as 配音 + 声线?
- Is 【正向提示词】 clean, without plot-summary clutter?
- For reference-video recreation, did the result migrate mechanism rather than copy surface?
- Are reference-image features integrated while keeping one consistent style?
