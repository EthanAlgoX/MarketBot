# Frontend Bridge Agent
# 前端协作助手 - 前端开发人员通过Clawdbot上报API问题

name: "前端协作助手"
version: "1.0.0"

# Clawdbot配置
clawdbot:
  gateway: "https://gateway.clawd.bot"
  sessionKey: "agent:frontend:dev"
  timeout: 30000
  
  # 通信配置（使用占位符，避免泄露本地路径）
  agents:
    backend:
      sessionKey: "agent:backend:dev"
      
    admin:
      sessionKey: "agent:admin:dev"

# 状态存储（使用环境变量，不硬编码本地路径）
state:
  # 环境变量优先，否则使用clawdhub默认路径
  file: "${CLAWDBOT_STATE_DIR:-/data/clawdbot}/PROBLEMS_STATE.json"
  # 内存缓存（可选）
  cache:
    enabled: true
    ttl: 3600  # 1小时

# 命令触发器
triggers:
  # 问题报告
  - regex: "^/report\\s+(.+)$"
    handler: "report_problem"
    description: "报告API问题"
  
  - regex: "^/bug\\s+(.+)$"
    handler: "report_problem"
    description: "报告Bug"
  
  - regex: "^/issue\\s+(.+)$"
    handler: "report_problem"
    description: "报告Issue"
  
  # 修复操作
  - regex: "^/apply\\s+([a-f0-9-]+)$"
    handler: "apply_fix"
    description: "应用修复方案"
  
  - regex: "^/resolve\\s+([a-f0-9-]+)$"
    handler: "resolve_problem"
    description: "标记问题已解决"
  
  - regex: "^/continue\\s+([a-f0-9-]+)$"
    handler: "continue_fix"
    description: "需要继续修复"
  
  # 历史查询
  - regex: "^/history$"
    handler: "show_history"
    description: "查看历史问题"
  
  - regex: "^/status\\s+([a-f0-9-]+)$"
    handler: "show_status"
    description: "查看问题状态"
  
  - regex: "^/timeline\\s+([a-f0-9-]+)$"
    handler: "show_timeline"
    description: "查看时间线"

# 环境变量（使用占位符或示例值）
environment:
  # AI配置（示例值，不包含实际密钥）
  AI_MODEL: "gpt-4"
  AI_TEMPERATURE: 0.7
  AI_MAX_TOKENS: 2000
  
  # 时间格式
  TIMEZONE: "Asia/Shanghai"
  DATETIME_FORMAT: "%Y-%m-%d %H:%M:%S"

# 权限配置
permissions:
  # 前端Agent可以执行的操作
  allowed_actions:
    - "problem:report"
    - "problem:read"
    - "fix:apply"
    - "problem:resolve"
    - "timeline:read"
