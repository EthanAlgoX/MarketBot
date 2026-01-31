# Confirm Form

**让 AI 助手批量收集决策，人类一次性确认，效率翻倍**

## 痛点

AI 做完任务后，经常遇到需要人类决策的问题：
- 数据有出入，用哪个？
- 方案有几种，选哪个？
- 格式不确定，要改吗？

传统方式：AI 问一个 → 人答一个 → AI 再问 → 人再答...  来回聊天，效率低下。

## 解决方案

```
AI 完成任务
    ↓
遇到 5 个需要决策的问题
    ↓
生成 1 个确认表单（含完整上下文）
    ↓
发链接给人类
    ↓
人类一次看完、一次确认
    ↓
AI 拿到结果继续执行
```

**效果**：本来要来回 10 条消息的沟通，变成 1 个表单 + 1 次确认。

## 表单长什么样

每个问题包含：
- 📋 **问题标题**：清晰的一句话
- 📖 **背景**：我在做什么任务
- ❓ **不确定点**：为什么需要你决定
- 📎 **发现**：原始数据 + 来源引用
- 💡 **我的判断**：AI 的推荐 + 理由
- ✅ **选项**：带理由的多选项

人类只需要勾选，不用重新看原始材料。

## 快速使用

```bash
# 1. 准备问题 JSON
cat questions.json

# 2. 生成表单
node scripts/generate.js questions.json

# 3. 发送链接给人类，等待确认

# 4. 解析返回的 JSON 结果
```

## 适用场景

- ✅ CC (Claude Code) 完成文档整理，发现数据不一致
- ✅ AI 做调研，有多个方案需要选择
- ✅ 批量审核任务，需要人类抽查确认
- ✅ 任何"AI 做完了但有几个点拿不准"的情况

## 安装

这是一个 [Clawdbot](https://clawd.bot) / [Agent Skill](https://agentskills.io)。

```bash
# Clawdbot 用户
clawdhub install confirm-form

# 或直接克隆
git clone https://github.com/xiaozhuang0127/confirm-form-skill.git
```

## 详细文档

见 [SKILL.md](./SKILL.md)

---

Made with 💁‍♀️ by XiaoZhuang
