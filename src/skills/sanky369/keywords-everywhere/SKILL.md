---
name: keywords-everywhere
description: SEO keyword research and competitor analysis via Keywords Everywhere API. Use when you need to get search volume, CPC, competition data for keywords, find related keywords (PASF), analyze what keywords a domain/URL ranks for, or retrieve backlink data.
---

# Keywords Everywhere API

CLI tool for SEO keyword research, competitor analysis, and backlink metrics.

## Setup

Requires API key. Configure in clawdbot config under `skills.entries.keywords-everywhere.apiKey` or set environment:
```bash
export KEYWORDS_EVERYWHERE_API_KEY="your_api_key"
```

## Usage

```bash
python3 scripts/kwe.py <command> [arguments] [options]
```

Or add an alias:
```bash
alias kwe="python3 /path/to/skills/keywords-everywhere/scripts/kwe.py"
```

## Commands

### Keyword Research

**Get keyword data** (volume, CPC, competition, trends):
```bash
kwe keywords "seo tools" "keyword research" --country us --currency usd
```

**Related keywords** (discover related terms):
```bash
kwe related "content marketing" --num 20
```

**People Also Search For**:
```bash
kwe pasf "best crm software" --num 15
```

### Domain/URL Analysis

**Keywords a domain ranks for** (with traffic estimates):
```bash
kwe domain-keywords example.com --country us --num 100
```

**Keywords a specific URL ranks for**:
```bash
kwe url-keywords "https://example.com/blog/post" --num 50
```

### Backlink Analysis

**Domain backlinks**:
```bash
kwe domain-backlinks example.com --num 50
```

**Unique domain backlinks** (one per referring domain):
```bash
kwe unique-domain-backlinks example.com --num 30
```

**Page backlinks** (specific URL):
```bash
kwe page-backlinks "https://example.com/page" --num 20
```

**Unique page backlinks**:
```bash
kwe unique-page-backlinks "https://example.com/page"
```

### Account

**Check credit balance**:
```bash
kwe credits
```

**List supported countries**:
```bash
kwe countries
```

**List supported currencies**:
```bash
kwe currencies
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--country` | Country code (empty for global, `us`, `uk`, `in`, etc.) | global |
| `--currency` | Currency code (`usd`, `gbp`, `inr`, etc.) | usd |
| `--num` | Number of results (max 2000 for Silver plan) | 10 |
| `--output` | Output format: `table`, `json`, `csv` | table |

## Output Data

### Keyword Data (keywords command)
- `vol`: Monthly search volume
- `cpc`: Cost per click (advertiser bid)
- `competition`: Competition score (0-1)
- `trend`: 12-month search trend data

### Domain/URL Keywords
- `keyword`: Ranking keyword
- `estimated_monthly_traffic`: Estimated monthly organic traffic
- `serp_position`: Current SERP position

### Backlink Data
- `domain_source`: Referring domain
- `anchor_text`: Link anchor text
- `url_source` / `url_target`: Source/target URLs

## Credit Usage

1 credit = 1 keyword. Silver plan: 400,000 credits/year, top 2,000 keywords/backlinks per site.

## Examples

**Competitor keyword research**:
```bash
# What keywords does competitor rank for?
kwe domain-keywords competitor.com --num 200 --output json > keywords.json

# Get detailed metrics for specific keywords
kwe keywords "keyword1" "keyword2" "keyword3" --country us
```

**Content gap analysis**:
```bash
# Find keywords competitor ranks for
kwe domain-keywords competitor.com --num 500

# Get related keywords for your topic
kwe related "your topic" --num 100
kwe pasf "your topic" --num 100
```

**Backlink prospecting**:
```bash
# Find who links to competitor
kwe unique-domain-backlinks competitor.com --num 100 --output json
```
