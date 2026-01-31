---
name: aliyun-search
description: Perform web searches using Alibaba Cloud UnifiedSearch API. Provides advanced search capabilities with configurable parameters.
---

# Alibaba Cloud UnifiedSearch Skill

This skill provides the ability to perform web searches using Alibaba Cloud UnifiedSearch API.

## Features

- Support multiple search engine types (Generic, GenericAdvanced, LiteAdvanced)
- Configurable time range filtering
- Category-specific search (finance, law, medical, etc.)
- Location-based search (city/IP)
- Rich result formatting

## Usage

### Basic Usage
```bash
python search.py "云栖大会"
```

### Advanced Usage
```bash
python search.py "北京天气" --engine-type "Generic" --city "北京市"
```

```bash
python search.py "金融新闻" --category "finance" --time-range "OneWeek" --engine-type "GenericAdvanced"
```

## Scripts

- `search.py`: Python implementation of Alibaba Cloud UnifiedSearch API

## Configuration

Before using, you need to:
1. Obtain Alibaba Cloud AccessKey and Secret
2. Set environment variables:
   ```bash
   export ALIBABA_CLOUD_ACCESS_KEY_ID="your_access_key_id"
   export ALIBABA_CLOUD_ACCESS_KEY_SECRET="your_access_key_secret"
   ```
3. Ensure the required permissions are granted
4. Install dependencies: `pip install aliyun-python-sdk-core requests`
