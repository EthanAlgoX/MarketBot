---
name: wechat-article-search
description: 用于搜索微信公众号文章。支持通过微信搜一搜接口获取文章列表，包括标题、概要、来源、发布时间和原文链接。适合追踪 A 股小众研报、深度深度调研和市场小道消息。
metadata: {"marketbot":{"emoji":"💬","triggers":["wechat search","weixin search","search wechat articles","微信搜索","搜一搜","公众号搜索"],"output":"wechat-search-report","risk":"medium","freshness":"live","tools":["web_search"]}}
---

# 💬 WeChat Article Search (微信文章搜索)

用于搜索微信公众号文章，是获取 A 股深度调研、行业小众资讯的重要补充渠道。

## 使用场景

- **深度研报**：搜索特定分析师或公众号发布的深度报告。
- **市场风向**：追踪微信生态内讨论热度较高的市场话题。
- **调研纪要**：寻找最新的专家调研总结。

## 使用方法

### 基础搜索

```bash
/search-wechat "关键词"
```

### 指定数量与解析链接

```bash
/search-wechat "中钨高新 调研" -n 5 -r
```

## 参数说明

- `query`：搜索关键词（必填）
- `-n, --num`：返回数量（默认 10，最大 50）
- `-r, --resolve-url`：尝试解析微信文章真实链接（会额外请求每条结果）

## 输出字段

- **文章标题**
- **原文链接**
- **发布来源** (公众号名称)
- **内容概要**
- **发布时间**

## 注意事项

- **解析限制**：微信对真实 URL 有较强的反爬限制，解析可能失败，建议提示用户通过中间链接访问。
- **频率控制**：过度使用可能导致 IP 临时受限，请勿高频抓取。

---
*Note: 此技能为 MarketBot 提供了独特的中文社交媒体深度资讯获取能力。*
