#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Frontend Bridge Agent - 前端协作助手
前端开发人员通过Clawdbot上报API问题
"""

import os
import sys
import json
import uuid
import asyncio
from datetime import datetime, timedelta
from pathlib import Path

# Clawdbot SDK导入（模拟）
# 实际使用: from clawdbot import sessions_send, respond
# 这里我们先模拟

# 配置
FRONTEND_AGENT_NAME = "frontend-dev"
FRONTEND_SESSION_KEY = "agent:frontend:dev"
BACKEND_SESSION_KEY = "agent:backend:dev"
ADMIN_SESSION_KEY = "agent:admin:dev"

# 状态存储路径（从环境变量读取，避免硬编码本地路径）
STATE_FILE = os.getenv("PROBLEMS_STATE_FILE", os.path.join(os.getenv("CLAWDBOT_STATE_DIR", "/data/clawdbot"), "PROBLEMS_STATE.json"))

# 问题ID前缀
PROBLEM_PREFIX = "prob-"

def load_state():
    """加载问题状态"""
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {
        "problems": {},
        "review_queue": [],
        "last_problem_id": None
    }

def save_state(state):
    """保存问题状态"""
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

def generate_problem_id():
    """生成唯一问题ID"""
    return f"{PROBLEM_PREFIX}{uuid.uuid4().hex[:8]}"

def parse_problem(message):
    """解析问题消息"""
    # 格式示例：
    # /report endpoint:POST /api/user/update error:缺少userId params:{"name":"张三"}
    parts = message.split()
    
    if len(parts) < 3 or not parts[0].startswith('/report'):
        return None
    
    try:
        # 提取endpoint和method
        endpoint_method = parts[1].split(':')
        if len(endpoint_method) != 2:
            return None
        
        endpoint = endpoint_method[0]
        method = endpoint_method[1]
        
        # 提取error
        error_idx = parts.index('error:') if 'error:' in parts else -1
        if error_idx == -1:
            return None
        
        error_msg = ' '.join(parts[error_idx+1:]).strip()
        
        # 提取params（如果有）
        params = {}
        params_idx = parts.index('params:') if 'params:' in parts else -1
        if params_idx != -1:
            try:
                params = json.loads(' '.join(parts[params_idx+1:]).strip())
            except:
                pass
        
        return {
            'endpoint': endpoint,
            'method': method,
            'error': error_msg,
            'params': params
        }
    except Exception as e:
        return None

def create_timeline_node(node_type, actor, content, metadata=None):
    """创建时间线节点"""
    return {
        'type': node_type,
        'actor': actor,
        'actor_type': 'frontend',
        'content': content,
        'metadata': metadata or {},
        'created_at': datetime.now().isoformat()
    }

async def report_problem(session_key, message, user_info):
    """报告API问题"""
    # 解析问题
    problem = parse_problem(message)
    if not problem:
        return "❌ 格式错误，请使用: /report endpoint:方法 error:错误说明 [params:JSON]"
    
    # 检查是否是重复问题
    state = load_state()
    
    # 简单的重复检测：最近10分钟内相同endpoint+error
    for pid, prob in list(state['problems'].items())[-20:]:
        if (prob['endpoint'] == problem['endpoint'] and 
            prob['error'] == problem['error'] and
            datetime.now() - datetime.fromisoformat(prob['created_at']).replace(tzinfo=None) < timedelta(minutes=10)):
            return f"⚠️ 相似问题最近已报告：{pid}"
    
    # 生成问题ID
    problem_id = generate_problem_id()
    
    # 创建问题对象
    problem_obj = {
        'id': problem_id,
        'endpoint': problem['endpoint'],
        'method': problem['method'],
        'error': problem['error'],
        'request_body': problem['params'],
        'response_body': {},
        'status': 'pending',
        'priority': 'medium',
        'frontend_agent': session_key,
        'backend_agent': BACKEND_SESSION_KEY,
        'created_at': datetime.now().isoformat(),
        'timeline': [
            create_timeline_node(
                'problem',
                session_key,
                f"API错误：{problem['error']}",
                {
                    'endpoint': problem['endpoint'],
                    'method': problem['method'],
                    'params': problem['params']
                }
            )
        ]
    }
    
    # 保存到状态
    state['problems'][problem_id] = problem_obj
    state['review_queue'].append(problem_id)
    state['last_problem_id'] = problem_id
    save_state(state)
    
    # 模拟发送给后端Agent
    backend_message = f"""
🔴【前端问题报告】

问题ID: {problem_id}

接口信息：
• 接口: {problem['endpoint']}
• 方法: {problem['method']}
• 错误: {problem['error']}

请求参数：
```json
{json.dumps(problem['params'], indent=2, ensure_ascii=False)}
```

报告人：{user_info}
前端Session: {session_key}
时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---
⏰ 待操作：
1. 后端Agent分析此问题
2. 生成修复方案
3. 管理员审核

回复命令：
• /approve {problem_id} - 批准修复任务
• /reject {problem_id} - 拒绝（需填写原因）

查看详情：
• /detail {problem_id} - 查看完整信息
• /timeline {problem_id} - 查看时间线
"""
    
    # 模拟sessions_send
    print(f"[→ 后端Agent] {backend_message}")
    print(f"[→ 管理员Agent] {backend_message}")
    
    return f"✅ 问题已报告，ID: {problem_id}\n\n问题：{problem['error']}\n接口：{problem['endpoint']}"

async def apply_fix(session_key, message):
    """应用修复方案"""
    parts = message.split()
    
    if len(parts) < 2 or not parts[0].startswith('/apply'):
        return "❌ 格式错误，请使用: /apply <问题ID>"
    
    problem_id = parts[1]
    
    state = load_state()
    if problem_id not in state['problems']:
        return f"❌ 问题不存在: {problem_id}"
    
    problem = state['problems'][problem_id]
    
    # 检查是否有可用的修复方案
    fix_ready = None
    for node in reversed(problem['timeline']):
        if node['type'] == 'fix_ready':
            fix_ready = node
            break
    
    if not fix_ready:
        return f"❌ 问题暂无可用修复方案: {problem_id}"
    
    # 添加应用时间线节点
    problem['timeline'].append(
        create_timeline_node(
            'apply',
            session_key,
            f"前端应用修复方案",
            fix_ready['metadata']
        )
    )
    
    # 更新状态为applied
    problem['status'] = 'applied'
    state['problems'][problem_id] = problem
    save_state(state)
    
    solution = fix_ready['metadata']
    
    user_message = f"""
🟡【修复方案已应用】

问题ID: {problem_id}
问题：{problem['error']}

修复说明：
{solution.get('explanation', '无说明')}

修复代码：
```typescript
{solution.get('solution_code', '// 代码将在这里')}
```

---
⏰ 下一步：
1. 前端开发人员应用上述代码
2. 测试API调用
3. 验证问题是否解决

回复命令：
• /resolve {problem_id} - 问题已解决
• /continue {problem_id} - 需要继续修复

💬 如需讨论，回复 @后端
"""
    
    # 通知后端Agent
    backend_message = f"""
🟡【前端应用修复方案】

问题ID: {problem_id}
前端Session: {session_key}
已应用修复方案

---
请验证：
1. 检查代码实现
2. 测试API调用
3. 确认问题是否解决

回复：/resolve {problem_id} 或 /continue {problem_id}
"""
    
    print(f"[→ 后端Agent] {backend_message}")
    
    return user_message

async def resolve_problem(session_key, message):
    """标记问题为已解决"""
    parts = message.split()
    
    if len(parts) < 2 or not parts[0].startswith('/resolve'):
        return "❌ 格式错误，请使用: /resolve <问题ID>"
    
    problem_id = parts[1]
    
    state = load_state()
    if problem_id not in state['problems']:
        return f"❌ 问题不存在: {problem_id}"
    
    problem = state['problems'][problem_id]
    
    # 添加解决时间线节点
    problem['timeline'].append(
        create_timeline_node(
            'complete',
            session_key,
            f"✅ 前端确认问题已解决"
            {
                'resolved_by': session_key,
                'attempts': problem.get('current_attempt', 1)
            }
        )
    )
    
    # 更新状态
    problem['status'] = 'completed'
    problem['completed_at'] = datetime.now().isoformat()
    problem['resolved_by'] = session_key
    state['problems'][problem_id] = problem
    
    # 从审核队列移除
    if problem_id in state['review_queue']:
        state['review_queue'].remove(problem_id)
    
    save_state(state)
    
    user_message = f"""
🎉【问题已解决】

问题ID: {problem_id}
接口: {problem['endpoint']}
方法: {problem['method']}
错误: {problem['error']}
状态: 已完成

修复尝试次数: {problem.get('current_attempt', 1)}
解决时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
解决人: {session_key}

---
👍 感谢使用前端协作助手！
"""
    
    # 通知后端Agent和管理员
    backend_message = f"""
🎉【问题已解决】

问题ID: {problem_id}
接口: {problem['endpoint']}
前端已确认问题解决

修复尝试次数: {problem.get('current_attempt', 1)}
"""
    
    print(f"[→ 后端Agent] {backend_message}")
    print(f"[→ 管理员Agent] {backend_message}")
    
    return user_message

async def show_history(session_key, message):
    """显示历史问题"""
    state = load_state()
    
    if not state['problems']:
        return "📭 暂无历史问题"
    
    # 按时间排序（最近的在前）
    problems_sorted = sorted(
        state['problems'].items(),
        key=lambda x: x[1].get('created_at', ''),
        reverse=True
    )
    
    history_message = "📊【历史问题列表】\n\n"
    
    for i, (pid, problem) in enumerate(problems_sorted[:20], 1):
        status_emoji = {
            'pending': '⏳',
            'reviewing': '👀',
            'approved': '✅',
            'fixing': '🔧',
            'ready': '📦',
            'applied': '🚀',
            'completed': '🎉',
            'rejected': '❌'
        }.get(problem['status'], '❓')
        
        history_message += f"{i}. {status_emoji} [{pid}] {problem['endpoint']}\n"
        history_message += f"   {problem['error']}\n"
        history_message += f"   状态: {problem['status']}\n"
        history_message += f"   创建: {problem['created_at'][:16]}\n"
    
    if len(state['problems']) > 20:
        history_message += f"\n... 还有 {len(state['problems']) - 20} 个问题\n"
    
    history_message += f"\n总计: {len(state['problems'])} 个问题"
    
    return history_message

async def show_status(session_key, message):
    """显示问题状态"""
    parts = message.split()
    
    if len(parts) < 2 or not parts[0].startswith('/status'):
        return "❌ 格式错误，请使用: /status <问题ID>"
    
    problem_id = parts[1]
    
    state = load_state()
    if problem_id not in state['problems']:
        return f"❌ 问题不存在: {problem_id}"
    
    problem = state['problems'][problem_id]
    
    status_message = f"""
📋【问题详情】

问题ID: {problem_id}

基本信息：
• 接口: {problem['endpoint']}
• 方法: {problem['method']}
• 错误: {problem['error']}
• 状态: {problem['status']}
• 优先级: {problem['priority']}

时间线：
{' - '.join([f"{node['type']}: {node['content'][:30]}" for node in problem['timeline'][-5]])}

---
查看完整时间线: /timeline {problem_id}

状态说明：
• pending: 待审核
• reviewing: 审核中
• approved: 已批准
• fixing: 修复中
• ready: 修复就绪
• applied: 已应用
• completed: 已完成
• rejected: 已拒绝
"""
    
    return status_message

async def show_timeline(session_key, message):
    """显示完整时间线"""
    parts = message.split()
    
    if len(parts) < 2 or not parts[0].startswith('/timeline'):
        return "❌ 格式错误，请使用: /timeline <问题ID>"
    
    problem_id = parts[1]
    
    state = load_state()
    if problem_id not in state['problems']:
        return f"❌ 问题不存在: {problem_id}"
    
    problem = state['problems'][problem_id]
    
    timeline_message = f"📊【{problem['endpoint']} - 时间线】\n\n"
    
    # 节点类型图标
    node_icons = {
        'problem': '🔴',
        'review': '👀',
        'reject': '❌',
        'approve': '✅',
        'fix_attempt': '🔧',
        'fix_ready': '📦',
        'apply': '🚀',
        'confirm_resolve': '✨',
        'complete': '🎉'
    }
    
    for node in problem['timeline']:
        icon = node_icons.get(node['type'], '📌')
        timestamp = node['created_at'][:16]
        actor = node['actor']
        actor_type = {
            'frontend': '前端',
            'backend': '后端',
            'admin': '管理员',
            'system': '系统'
        }.get(node['actor_type'], '未知')
        
        timeline_message += f"[{timestamp}] {icon} {actor_type}: {node['content']}\n"
    
    timeline_message += f"\n---\n问题ID: {problem_id}\n状态: {problem['status']}"
    
    return timeline_message

# 主入口
async def main():
    """主函数"""
    command = sys.argv[1] if len(sys.argv) > 1 else 'help'
    
    # 模拟session_key（实际从event中获取）
    session_key = "agent:frontend:dev"
    user_info = "frontend-dev"
    
    if command == 'report_problem':
        message = ' '.join(sys.argv[2:])
        result = await report_problem(session_key, message, user_info)
        print(result)
    
    elif command == 'apply_fix':
        message = ' '.join(sys.argv[2:])
        result = await apply_fix(session_key, message)
        print(result)
    
    elif command == 'resolve_problem':
        message = ' '.join(sys.argv[2:])
        result = await resolve_problem(session_key, message)
        print(result)
    
    elif command == 'show_history':
        result = await show_history(session_key, message)
        print(result)
    
    elif command == 'show_status':
        result = await show_status(session_key, message)
        print(result)
    
    elif command == 'show_timeline':
        result = await show_timeline(session_key, message)
        print(result)
    
    else:
        help_text = """
🔧 前端协作助手命令：

问题报告：
• /report <endpoint>:<方法> error:<错误说明> [params:<JSON>]
  示例: /report endpoint:POST /api/user error:缺少userId params:{"name":"张三"}

修复操作：
• /apply <问题ID>        - 应用修复方案
• /resolve <问题ID>      - 标记问题已解决

查看命令：
• /history                 - 查看历史问题
• /status <问题ID>        - 查看问题状态
• /timeline <问题ID>      - 查看时间线

使用示例：
/report endpoint:POST /api/user error:缺少userId
/apply prob-abc123
/resolve prob-abc123
/status prob-abc123
/timeline prob-abc123
"""
        print(help_text)

if __name__ == '__main__':
    asyncio.run(main())
