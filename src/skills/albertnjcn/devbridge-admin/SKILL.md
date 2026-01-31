# Review Coordinator Agent
# 审核协调器 - 管理员通过Clawdbot审核和分配修复任务

name: "审核协调器"
version: "1.0.0"

# Clawdbot配置
clawdbot:
  gateway: "https://gateway.clawd.bot"
  sessionKey: "agent:admin:dev"
  timeout: 30000
  
  # 通信配置（使用占位符，不硬编码本地路径）
  agents:
    frontend:
      sessionKey: "agent:frontend:dev"
      
    backend:
      sessionKey: "agent:backend:dev"

# 状态存储（使用环境变量，不硬编码本地路径）
state:
  # 环境变量优先，否则使用clawdhub默认路径
  file: "${CLAWDBOT_STATE_DIR:-/data/clawdbot}/PROBLEMS_STATE.json"
  review_queue: true  # 启用审核队列
  auto_approve: false  # 不自动批准，需要人工审核

# 命令触发器
triggers:
  # 审核操作
  - "/list"         # 列出待审核问题
  - "/approve"      # 批准修复任务
  - "/reject"       # 拒绝修复任务（必填原因）
  - "/history"      # 审核历史
  - "/stats"         # 审核统计
  
  # 状态查询
  - "/pending"       # 查看待审核数量
  - "/completed"      # 查看已完成数量

# 命令列表
commands:
  # 列表命令
  - name: "list_pending"
    description: "列出所有待审核的问题"
    parameters:
      - name: "limit"
        type: "number"
        required: false
        description: "限制返回数量"
        default: 10
  
  - name: "list_all"
    description: "列出所有问题（包括已审核）"
    parameters:
      - name: "status"
        type: "string"
        required: false
        description: "筛选状态：pending, approved, rejected, fixing, ready, completed"
        default: "pending"
      - name: "priority"
        type: "string"
        required: false
        description: "筛选优先级：low, medium, high, critical"
        default: ""
  
  # 审核操作
  - name: "approve_problem"
    description: "批准问题，分配给后端Agent"
    parameters:
      - name: "problem_id"
        type: "string"
        required: true
        description: "问题ID"
      - name: "priority"
        type: "string"
        required: false
        description: "设置优先级"
        default: "medium"
      - name: "note"
        type: "string"
        required: false
        description: "审核备注"
  
  - name: "reject_problem"
    description: "拒绝问题，必须填写原因"
    parameters:
      - name: "problem_id"
        type: "string"
        required: true
        description: "问题ID"
      - name: "reason"
        type: "string"
        required: true
        description: "拒绝原因（必填）"
      - name: "reason_type"
        type: "string"
        required: false
        description: "原因类型：invalid_params, permission_denied, not_applicable, already_fixed, need_more_info, duplicate, spec_unclear, out_of_scope, will_not_fix, needs_discussion, other"
        default: "other"
      - name: "suggestion"
        type: "string"
        required: false
        description: "改进建议"
        default: ""
  
  # 历史查询
  - name: "review_history"
    description: "查看审核历史"
    parameters:
      - name: "problem_id"
        type: "string"
        required: false
        description: "问题ID（不填则返回所有历史）"
      - name: "days"
        type: "number"
        required: false
        description: "最近N天的历史"
        default: 7
  
  - name: "get_status"
    description: "获取问题状态"
    parameters:
      - name: "problem_id"
        type: "string"
        required: true
        description: "问题ID"
  
  - name: "get_timeline"
    description: "获取问题时间线"
    parameters:
      - name: "problem_id"
        type: "string"
        required: true
        description: "问题ID"
      - name: "expand"
        type: "boolean"
        required: false
        description: "展开所有节点"
        default: false

# 环境变量（所有值均为占位符或示例）
environment:
  # 时间配置
  TIMEZONE: "Asia/Shanghai"
  DATETIME_FORMAT: "%Y-%m-%d %H:%M:%S"
  
  # 通知配置（占位符）
  NOTIFY_ON_APPROVE: true
  NOTIFY_ON_REJECT: true
  NOTIFY_ON_COMPLETE: true
  
  # 拒绝原因模板（示例值）
  REJECT_REASONS: {
    "invalid_params": "参数格式不正确或缺少必填参数",
    "permission_denied": "权限不足，无法访问此资源",
    "not_applicable": "此问题不适用于当前场景",
    "already_fixed": "此问题已在其他地方修复",
    "need_more_info": "需要更多信息才能定位问题",
    "duplicate": "重复的问题",
    "spec_unclear": "API规范不清晰",
    "out_of_scope": "超出当前服务范围",
    "will_not_fix": "此问题计划不修复，文档化即可",
    "needs_discussion": "需要团队讨论确定解决方案"
  }
  
  # 优先级配置（占位符）
  PRIORITY_DEFAULT: "medium"
  PRIORITY_RULES: {
    "critical": "生产环境阻塞、数据安全问题、核心业务功能失效",
    "high": "非阻塞功能缺陷、性能严重下降",
    "medium": "一般功能缺陷、用户体验受影响",
    "low": "轻微问题、优化建议"
  }

# 权限配置
permissions:
  # 可以执行的操作
  allowed_actions:
    - "review:read"      # 查看待审核问题
    - "review:approve"  # 批准问题
    - "review:reject"   # 拒绝问题
    - "review:history"  # 查看审核历史
    - "review:stats"    # 查看统计数据
  
  # 角色要求（占位符）
  required_roles:
    - "admin"           # 需要管理员角色
    - "reviewer"        # 需要审核员角色

# 统计配置
stats:
  # 统计维度
  metrics:
    - "pending_count"       # 待审核数量
    - "approved_count"      # 已批准数量
    - "rejected_count"       # 已拒绝数量
    - "avg_review_time"     # 平均审核时间（分钟）
    - "approve_rate"       # 批准率
    - "reject_by_reason"   # 按拒绝原因统计
  
  # 统计周期
  aggregation:
    - daily: true
    - weekly: true
    - monthly: true

# 消息模板（使用占位符，无真实信息）
message_templates:
  # 待审核通知（占位符）
  pending_review: "🔔 新问题待审核\n\n问题ID: {problem_id}\n接口: {endpoint}\n错误: {error}\n报告人: {reporter}"
  
  # 批准通知（占位符）
  approved: "✅ 问题已批准\n\n问题ID: {problem_id}\n接口: {endpoint}\n优先级: {priority}\n已分配给后端Agent"
  
  # 拒绝通知（占位符）
  rejected: "❌ 问题已拒绝\n\n问题ID: {problem_id}\n原因: {reason}\n建议: {suggestion}\n已通知前端Agent"
  
  # 完成通知（占位符）
  completed: "🎉 问题已完成\n\n问题ID: {problem_id}\n修复尝试次数: {attempts}\n总耗时: {duration}小时"
