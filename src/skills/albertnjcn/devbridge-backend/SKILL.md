# Backend Fixer Agent
# 后端修复助手 - 后端开发人员通过Clawdbot分析问题并生成修复方案

name: "后端修复助手"
version: "1.0.0"

# Clawdbot配置
clawdbot:
  gateway: "https://gateway.clawd.bot"
  sessionKey: "agent:backend:dev"
  timeout: 60000
  
  # 通信配置（使用占位符，不硬编码本地路径）
  agents:
    frontend:
      sessionKey: "agent:frontend:dev"
      
    admin:
      sessionKey: "agent:admin:dev"

# 状态存储（使用环境变量，不硬编码本地路径）
state:
  # 环境变量优先，否则使用clawdhub默认路径
  file: "${CLAWDBOT_STATE_DIR:-/data/clawdbot}/PROBLEMS_STATE.json"
  # 修复尝试记录（可选）
  cache:
    enabled: true
    ttl: 3600  # 1小时

# 命令触发器
triggers:
  # 修复请求
  - regex: "^/fix\\s+(.+)$"
    handler: "handle_fix_request"
    description: "接收修复请求并分析问题"
  
  - regex: "^/analyze\\s+(.+)$"
    handler: "analyze_problem"
    description: "分析API问题"
  
  - regex: "^/ready\\s+([a-f0-9-]+)$"
    handler: "mark_fix_ready"
    description: "标记修复为就绪"
  
  - regex: "^/complete\\s+([a-f0-9-]+)$"
    handler: "mark_fix_complete"
    description: "标记修复完成"

# 命令列表
commands:
  # 分析命令
  - name: "analyze_problem"
    description: "分析API问题并生成解决方案"
    parameters:
      - name: "problem_id"
        type: "string"
        required: true
        description: "问题ID"
  
  - name: "handle_fix_request"
    description: "处理修复请求"
    parameters:
      - name: "message"
        type: "string"
        required: true
        description: "完整问题信息"

  - name: "mark_fix_ready"
    description: "标记修复为就绪"
    parameters:
      - name: "problem_id"
        type: "string"
        required: true
        description: "问题ID"
      - name: "fix_code"
        type: "string"
        required: true
        description: "修复代码"
      - name: "explanation"
        type: "string"
        required: true
        description: "修复说明"

  - name: "mark_fix_complete"
    description: "标记修复完成"
    parameters:
      - name: "problem_id"
        type: "string"
        required: true
        description: "问题ID"

  # 状态查询命令
  - name: "get_problem_status"
    description: "获取问题状态"
    parameters:
      - name: "problem_id"
        type: "string"
        required: true
        description: "问题ID"

  - name: "list_pending_fixes"
    description: "列出待修复的问题"

# 环境变量（使用占位符或示例值，不包含实际密钥）
environment:
  # AI模型配置（占位符或提示）
  AI_PROVIDER: "openai"
  AI_MODEL: "gpt-4"
  AI_TEMPERATURE: 0.7
  AI_MAX_TOKENS: 2000
  AI_TIMEOUT: 30
  
  # API规范配置
  API_STRICT_MODE: true
  ENFORCE_VALIDATION: true
  AUTO_GENERATE_TESTS: true
  
  # 代码生成配置
  CODE_LANGUAGE: "javascript"
  CODE_FRAMEWORK: "express"
  CODE_COMMENT_STYLE: "detailed"
  
  # 时间格式
  TIMEZONE: "Asia/Shanghai"
  DATETIME_FORMAT: "%Y-%m-%d %H:%M:%S"

# 权限配置
permissions:
  # 可以访问的资源
  allowed_resources:
    - "problem:read"
    - "fix:read"
    - "fix:write"
    - "timeline:read"
  
  # 安全配置
  security:
    validate_fixes: true
    require_approval: true
    max_fix_attempts: 5
