---
name: memory-to-obsidian
description: 将重要内容记录到 Obsidian Memory 文件夹，自动按日期整理并添加时间戳
description_en: Save important notes to Obsidian Memory folder with timestamps. Organize by date automatically.
---

# Memory to Obsidian 记忆同步

快速将重要想法、笔记和灵感记录到 Obsidian vault 的 Memory 文件夹，自动按日期整理。

Quickly save important thoughts, ideas, and notes to your Obsidian vault's Memory folder with automatic timestamp organization.

## 使用方法 | Usage

### 单条记录 | Single Note
```
记忆 <内容>
```

### 多条记录 | Multiple Notes
合并多条记录后一次性保存：
```bash
记忆 今天完成的事项：
1. 掌握了【发布】指令
2. 掌握了【api】指令
3. 掌握了【安装】指令
```

示例 | Examples:
```
记忆 今天完成了项目开发
Save today completed the project development

记忆 掌握的指令：
- 【发布】自动发布 skill 到 clawhub
- 【api】查询 API 用量
- 【安装】安装 clawhub skill
```

## 输出格式 | Output Format

保存到 `Obsidian/Javis/Memory/YYYY-MM.md`（按年月整理）：

```markdown
### 2026-01-31
- 掌握了【发布】指令 - 自动整理中英文双语描述，发布 skill 到 clawhub.ai
- 掌握了【api】指令 - 通过 minimax-coding-plan-usage skill 查询 API 用量
- 掌握了【安装】指令 - 自动安装 clawhub.ai 链接中的 skill
```

## 功能特点 | Features

- 📝 快速记录 | Quick note taking
- ⏰ 自动时间戳 | Automatic timestamps
- 📅 按日期整理 | Organized by date
- 🔄 增量追加 | Append only, no overwrites
- 📋 多条合并 | Merge multiple notes into single entry
