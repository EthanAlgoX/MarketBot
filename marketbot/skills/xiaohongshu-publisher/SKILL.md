---
name: xiaohongshu-publisher
description: Publish Xiaohongshu image notes through xiaohongshu-cli when the user explicitly asks to post to Xiaohongshu.
metadata: {"marketbot":{"emoji":"📝","triggers":["发小红书","发布小红书","小红书发帖","post to xiaohongshu","publish to xiaohongshu","send to xiaohongshu"],"output":"xiaohongshu-publish-result","risk":"high","freshness":"live","tools":["xiaohongshu_cli"],"required_tools":["xiaohongshu_cli"],"markets":["a-share","hong-kong","global","mixed"],"asset_classes":["equity","etf","commodity"],"task_type":"publisher","determinism":"tool-backed","priority":88}}
---

# Xiaohongshu Publisher

Use this skill only when the user explicitly asks to publish content to Xiaohongshu.

## Workflow

1. Use `xiaohongshu_cli(operation="post", ...)` directly.
2. Require:
   - `title`
   - `body`
   - at least one local image path in `images`
3. Optional:
   - `topics`
   - `is_private=true`
4. After a successful publish, report success briefly and include the returned structured result if useful.

## Rules

- Do not use `exec` for posting when `xiaohongshu_cli` is available.
- Do not claim posting is impossible if `xiaohongshu_cli` is installed. The current write gate is `tools.xiaohongshuCli.allowWrite`.
- If `allowWrite` is disabled, say that controlled posting is available but the safety switch is off.
- If the user provides no image, stop and say that the current integration only supports image-note publishing.
- Do not silently publish. The user must explicitly ask to post.
