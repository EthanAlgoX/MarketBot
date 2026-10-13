# 新闻关联、样例预览与留存

本轮实现面向公开 RSS/Atom。来源状态、主题匹配和关联规则均可解释，不调用模型，不把匹配或关联解释为买卖方向。

## 跨来源候选

`intelligence.list` 增加 `grouping`，日报增可空 `grouping`。算法版本为 `exact-link-or-title-utc-v1`：

1. 相同原文链接先形成一组。去掉 fragment、`utm_*`、`fbclid/gclid/dclid/msclkid`，其余 query 参数保留，参数顺序规范化。
2. 剩余内容仅在实际发表的 UTC 日期相同、标题经 NFKC/大小写/空白规范化后完全相同、且来源 ID 不同的情况下形成标题候选。
3. 其他内容单独保留。未知发表时间不参加标题关联；同一来源的重复标题不形成跨来源标题候选；不做相似度、实体因果或观点合并，也不做传递性扩张。

每组保留全部 `recommendationIds`、`sourceIds` 和 `sourceNames`，`association=candidate`。原推荐及各自理由、反馈、修订仍可独立查看。候选仅表达可核对的链接/标题关联，可能漏掉改写的报道，也可能关联标题相同的不同观点。

新日报与更正把 `items`、分组及算法版本一同写入 JSON envelope。归档读取直接使用当时保存的分组，不读取实时内容重新计算。旧数组快照保持原值且 `grouping=null`；升级不重写已有 v1。

## 订阅样例预览

`intelligence.previewSubscription` 接收 `{sourceId,includeTerms,excludeTerms}`，身份由认证上下文决定。指定其他用户来源返回 NOT_FOUND。此接口只读已有缓存，不抓取链接、不启用订阅、不新增推荐/反馈。

返回真实缓存样例和来源状态，最多扫描最新 100 个内容修订，在这个有界窗口内取各来源/外部键最新修订。`coverage.basis=latest_cached_revisions`；`truncated` 明示缓存窗口截断，样例不是来源全集或市场全量覆盖。`capturedAt`、`publishedAt`、`firstSeenAt` 区分采集、实际发表及首次见到。

样例共享正式订阅的匹配规则，Latin ticker 有边界保护：

- `matched`：命中主题词且没有排除词。
- `excluded`：命中排除词，优先于主题匹配。
- `review`：当前标题与 RSS 摘录未命中主题词，需人工复核；没有读取全文。

来源从未成功采集时覆盖为 `unavailable`，即使样例空也不能解释为“没有相关新闻”。含失败、待采集或停用来源时为 `partial`，保留旧缓存和最后成功时间。所有来源当前正常时为 `available`，仍只是缓存可用而非穷尽覆盖。

## 留存边界

当前策略 `rss-metadata-excerpt-v1` 保留来源 ID/名称、公开 feed 的原链接、标题、作者、时间、内容 hash/修订和最多 500 字符摘录。原 XML 不保存，不另行获取文章正文。来源许可仍约束可留存内容，本策略不推断全文或永久转载授权；不接入需付费或登录的文章正文。

内容修订、推荐和日报由助手侧持有；日报内容为独立 JSON 快照，反馈追加，更正生成新版本。因此后续若引入缓存清理，不能级联清除已发布档案。当前 `automaticDeletion=false`，没有运行自动 TTL/purge；单独清理与按来源许可调整保留期仍需后续实现。此轮不删除现有档案、缓存、反馈或来源。

## 定向验证

```bash
python3 scripts/verify-intelligence.py
```

此命令只使用本项目 PostgreSQL marker 及开发配置，创建新随机 `finance_intelligence_*` 数据库，应用实际 migrations，运行规则、鉴权、真实 PostgreSQL 预览/归档测试，最后删除该随机数据库。不会向开发用户插入样例，不联网抓取 feed，不修改开发能力 gate。2026-10-12 实际 6 files / 24 tests 通过；证据 `.local/intelligence-audit/finance_intelligence_e60b7db15582e9f4/result.json`。
