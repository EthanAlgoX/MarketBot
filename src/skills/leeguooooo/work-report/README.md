# Work Report Skill

基于 git 活动生成日报/周报，支持多仓库与项目分组。

## 安装

### Codex CLI

方式一：直接克隆到 Codex 技能目录：

```
git clone https://github.com/leeguooooo/work-report.git ~/.codex/skills/work-report
```

方式二：下载 release 的 `.skill` 并解压到 `~/.codex/skills`：

```
unzip work-report.skill -d ~/.codex/skills
```

安装完成后重启 Codex。

### Claude Code

Claude Code 当前不支持 `.skill` 格式的原生安装。建议：

1. 克隆此仓库到本地任意目录。
2. 在 Claude Code 的自定义提示/规则中粘贴 `SKILL.md` 的内容。
3. 需要时手动运行 `scripts/git_today_commits.sh`，再把输出粘贴给 Claude Code 生成日报/周报。

### Cursor

Cursor 不支持 `.skill` 直接安装。建议：

1. 克隆此仓库到本地任意目录。
2. 在 Cursor 的项目规则/聊天规则中粘贴 `SKILL.md` 的内容。
3. 需要时手动运行 `scripts/git_today_commits.sh`，再把输出粘贴给 Cursor 生成日报/周报。

## 配置

重要提示：支持显式 `--root`（或使用 `--repo` 指定单仓库），也支持隐式设置 `WORK_REPORT_ROOT`/`CODEX_WORK_ROOT`；未提供任何根目录会报错。
重要提示：Codex 需将 /Approval mode 设为 Agent(full access) 才能正常运行本技能。

示例：

```
scripts/git_today_commits.sh --root /path/to/your/workspace
```

也可设置默认根目录（可减少交互）：

```
export WORK_REPORT_ROOT=/path/to/your/workspace
```

## 使用

在 Codex 中可直接说：

- 日报：`日报` 或 `发日报`
- 周报：`周报` 或 `发周报`

输出时应使用中文条目；若提交信息为英文，请改写/翻译为中文后再生成日报/周报。
默认会对提交信息做“业务化”归一化（例如“解决冲突”会转成“代码集成与稳定性维护”）；如需保留原始提交信息，可用 `--no-normalize`。

脚本用法：

```
scripts/git_today_commits.sh --root /path/to/repos --period daily --group-by-repo
```

说明：

- 只会统计包含 `.git` 目录或文件的项目，非 git 目录会被忽略
- 默认使用 `git log --all`，跨分支收集提交（可用 `--no-all` 限制为当前分支）
- `--period weekly` 使用自然周（周一开始）作为时间范围
- 可用 `--summary-source diff` 基于改动文件生成摘要（适合提交信息不够明确的场景）

## 输出格式

日报：

```
MM.DD 今日工作总结
<项目A>
1.<item>
2.<item>
```

周报：

```
MM.DD-MM.DD 本周工作总结
<项目A>
1.<item>
2.<item>
```

## License

MIT
