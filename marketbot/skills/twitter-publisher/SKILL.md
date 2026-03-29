---
name: twitter-publisher
description: Publish or interact on Twitter/X through twitter-cli when the user explicitly asks to post to Twitter/X.
metadata: {"marketbot":{"emoji":"🐦","triggers":["发推","发 twitter","发 x","发布到 twitter","发布到 x","tweet this","post to twitter","post on x","publish to twitter","publish on x","send to twitter"],"output":"twitter-publish-result","risk":"high","freshness":"live","tools":["twitter_cli"],"required_tools":["twitter_cli"],"markets":["global","mixed"],"asset_classes":["equity","crypto","commodity","macro","etf"],"task_type":"publisher","determinism":"tool-backed","priority":88}}
---

# Twitter Publisher

Use this skill only when the user explicitly asks to publish or interact on Twitter/X.

## Workflow

1. Use `twitter_cli(...)` directly.
2. Common operations:
   - post: `twitter_cli(operation="post", text="...")`
   - reply: `twitter_cli(operation="reply", target="<tweet-id-or-url>", text="...")`
   - quote: `twitter_cli(operation="quote", target="<tweet-id-or-url>", text="...")`
3. Optional:
   - `images=["/abs/path/a.png"]` for post, reply, or quote
   - By default, publish requests may render a local Twitter poster image and attach it automatically.
   - If the user explicitly asks for `纯文本` / `不要图` / `text-only`, skip the auto-generated image and send text only.
4. After a successful action, report success briefly and include the returned structured result when useful.

## Rules

- Do not use `exec` for posting when `twitter_cli` is available.
- Do not claim posting is impossible if `twitter_cli` is installed. The current write gate is `tools.twitterCli.allowWrite`.
- If `allowWrite` is disabled, say that controlled posting is available but the safety switch is off.
- Do not silently publish. The user must explicitly ask to post or interact.
- For reply or quote, require an explicit tweet id or tweet URL.
- Auto-generated Twitter images are the default publish mode unless the user explicitly asks for text only.
