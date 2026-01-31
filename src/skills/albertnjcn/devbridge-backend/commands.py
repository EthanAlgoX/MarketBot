#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Backend Fixer Agent - 后端修复助手
后端开发人员通过Clawdbot分析问题并生成修复方案
"""

import os
import sys
import json
import asyncio
import uuid
from datetime import datetime, timedelta
from pathlib import Path

# 配置
BACKEND_AGENT_NAME = "backend-dev"
BACKEND_SESSION_KEY = "agent:backend:dev"
FRONTEND_SESSION_KEY = "agent:frontend:dev"
ADMIN_SESSION_KEY = "agent:admin:dev"

# 状态存储路径（从环境变量读取，避免硬编码本地路径）
STATE_FILE = os.getenv("PROBLEMS_STATE_FILE", os.path.join(
    os.getenv("CLAWDBOT_STATE_DIR", "/data/clawdbot"), 
    "PROBLEMS_STATE.json"
))

# 问题ID前缀
PROBLEM_PREFIX = "prob-"

# 模拟的GPT响应（实际使用时替换为真实API调用）
MOCK_GPT_RESPONSES = {
    'param_validation': {
        'summary': '参数验证错误：缺少必填参数或格式不正确',
        'error_type': 'parameter_error',
        'suggested_fix': '检查请求参数格式，添加必填参数验证中间件'
    },
    'permission_denied': {
        'summary': '权限不足：用户没有访问此资源的权限',
        'error_type': 'permission_denied',
        'suggested_fix': '检查用户的角色和权限配置，添加RBAC中间件'
    },
    'api_not_found': {
        'summary': 'API路由不存在：404错误',
        'error_type': 'routing_error',
        'suggested_fix': '检查路由配置，确认API路径正确'
    },
    'internal_error': {
        'summary': '内部服务器错误：500错误',
        'error_type': 'server_error',
        'suggested_fix': '检查服务器日志，优化错误处理和异常捕获'
    }
}

# 代码模板
FIX_CODE_TEMPLATES = {
    'param_validation': """// 参数验证中间件
const validateParams = (req, res, next) => {
  const { endpoint } = req.body;
  
  // 常见参数验证规则
  const validationRules = {
    '/api/user': ['userId', 'name'],
    '/api/order': ['orderId', 'items'],
    '/api/product': ['productId']
  };
  
  const rules = validationRules[endpoint] || [];
  
  for (const field of rules) {
    if (!req.body[field]) {
      return res.status(400).json({
        error: `Missing required parameter: ${field}`,
        field: field
      });
    }
  }
  
  next();
};
""",

    'permission_check': """// 权限检查中间件
const checkPermission = (permission) => {
  return async (req, res, next) => {
    const { user } = req;
    
    if (!user || !user.permissions) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: '请先登录'
      });
    }
    
    if (!user.permissions.includes(permission)) {
      return res.status(403).json({
        error: 'Permission denied',
        permission: permission
      });
    }
    
    next();
  };
};
""",

    'error_handler': """// 错误处理中间件
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Invalid token',
      message: err.message
    });
  }
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      message: err.message
    });
  }
  
  // 服务器错误
  return res.status(500).json({
    error: 'Internal server error',
    message: '服务器错误，请稍后重试'
  });
};
"""
}

def load_state():
    """加载状态"""
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {
        "problems": {},
        "fix_attempts": {},
        "system_stats": {
            "total_problems": 0,
            "total_fixes": 0,
            "successful_resolves": 0
        }
    }

def save_state(state):
    """保存状态"""
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

def analyze_problem_with_mock_gpt(problem):
    """使用模拟GPT分析问题"""
    # 模拟分析：基于endpoint和error类型匹配
    endpoint = problem['endpoint']
    error_msg = problem['error'].lower()
    
    # 简单的关键词匹配
    if 'param' in error_msg or 'missing' in error_msg:
        return MOCK_GPT_RESPONSES['param_validation']
    elif 'permission' in error_msg or 'auth' in error_msg or 'unauthorized' in error_msg:
        return MOCK_GPT_RESPONSES['permission_denied']
    elif 'not found' in error_msg or '404' in error_msg:
        return MOCK_GPT_RESPONSES['api_not_found']
    else:
        return MOCK_GPT_RESPONSES['internal_error']

async def analyze_problem_with_ai(problem):
    """使用真实AI分析问题（实际使用时）"""
    # 这里会调用真实的AI API（OpenAI/Claude）
    # prompt = f"""
    # 分析以下API错误并生成修复方案：
    
    # 接口: {problem['endpoint']}
    # 方法: {problem['method']}
    # 错误: {problem['error']}
    # 请求参数: {json.dumps(problem.get('request_body', {}), indent=2)}
    # 响应内容: {json.dumps(problem.get('response_body', {}), indent=2)}
    
    # 请提供：
    # 1. 错误原因分析
    # 2. 可能的修复方案（按优先级排序）
    # 3. 需要修改的代码位置
    # 4. 测试建议
    # """
    
    # response = await openai.ChatCompletion.acreate(...)
    # return json.loads(response.choices[0].message.content)
    
    # 模拟返回
    return analyze_problem_with_mock_gpt(problem)

def generate_fix_code(problem, analysis):
    """生成修复代码"""
    error_type = analysis['error_type']
    
    # 根据错误类型选择代码模板
    if error_type == 'parameter_error':
        fix_code = FIX_CODE_TEMPLATES['param_validation']
        explanation = f"需要在 {problem['endpoint']} 路由中添加参数验证中间件"
    elif error_type == 'permission_denied':
        fix_code = FIX_CODE_TEMPLATES['permission_check']
        explanation = f"需要检查用户权限配置，在 {problem['endpoint']} 路由中添加权限检查"
    else:
        fix_code = FIX_CODE_TEMPLATES['error_handler']
        explanation = f"需要优化 {problem['endpoint']} 的错误处理逻辑"
    
    return {
        'code': fix_code,
        'explanation': explanation,
        'language': 'javascript',
        'framework': 'express'
    }

def add_timeline_node(problem_id, node_type, actor, content, metadata=None):
    """添加时间线节点"""
    state = load_state()
    
    if problem_id not in state['problems']:
        return
    
    problem = state['problems'][problem_id]
    problem['timeline'].append({
        'type': node_type,
        'actor': actor,
        'actor_type': 'backend',
        'content': content,
        'metadata': metadata or {},
        'created_at': datetime.now().isoformat()
    })
    
    save_state(state)

async def handle_fix_request(event):
    """处理修复请求"""
    try:
        # 解析问题信息
        message = event.get('message', '')
        problem_data = {}
        
        # 尝试解析JSON格式
        if '{' in message and '}' in message:
            try:
                problem_data = json.loads(message)
            except:
                pass
        
        if not problem_data:
            # 简单格式解析
            parts = message.split('|')
            for part in parts:
                if '=' in part:
                    key, value = part.split('=', 1)
                    problem_data[key.strip()] = value.strip()
        
        problem_id = problem_data.get('id', '')
        
        if not problem_id:
            return "❌ 缺少问题ID"
        
        # 加载问题
        state = load_state()
        if problem_id not in state['problems']:
            return f"❌ 问题不存在: {problem_id}"
        
        problem = state['problems'][problem_id]
        
        # 检查是否已经有fix_attempt
        attempt_count = problem.get('fix_attempts', 0) + 1
        problem['fix_attempts'] = attempt_count
        state['system_stats']['total_fixes'] += 1
        save_state(state)
        
        # 添加开始分析节点
        add_timeline_node(
            problem_id,
            'review',
            BACKEND_AGENT_NAME,
            f"开始第{attempt_count}次修复分析",
            {
                'attempt_number': attempt_count
            }
        )
        
        # AI分析问题
        print(f"[后端Agent] 正在分析问题 {problem_id}...")
        analysis = await analyze_problem_with_ai(problem)
        
        # 添加分析结果节点
        add_timeline_node(
            problem_id,
            'fix_attempt',
            BACKEND_AGENT_NAME,
            f"AI分析：{analysis['summary']}",
            analysis
        )
        
        # 生成修复代码
        print(f"[后端Agent] 正在生成修复代码...")
        fix = generate_fix_code(problem, analysis)
        
        # 标记问题状态为ready
        problem['status'] = 'ready'
        save_state(state)
        
        # 添加fix_ready节点
        add_timeline_node(
            problem_id,
            'fix_ready',
            BACKEND_AGENT_NAME,
            f"修复代码已就绪",
            fix
        )
        
        # 通知前端Agent
        await send_to_frontend(problem_id, fix)
        
        return f"✓ 修复方案已生成并发送给前端"
        
    except Exception as e:
        print(f"[后端Agent] 处理失败: {str(e)}")
        return f"✗ 处理失败: {str(e)}"

async def mark_fix_ready(problem_id, fix_code, explanation):
    """标记修复为就绪"""
    state = load_state()
    
    if problem_id not in state['problems']:
        return f"❌ 问题不存在: {problem_id}"
    
    problem = state['problems'][problem_id]
    
    # 添加fix_ready节点
    add_timeline_node(
        problem_id,
        'fix_ready',
        BACKEND_AGENT_NAME,
        f"修复代码已就绪",
        {
            'solution_code': fix_code,
            'explanation': explanation
        }
    )
    
    # 更新状态
    problem['status'] = 'ready'
    save_state(state)
    
    # 通知前端
    await send_to_frontend(problem_id, {
        'code': fix_code,
        'explanation': explanation
    })
    
    return f"✓ 已标记为就绪"

async def mark_fix_complete(problem_id):
    """标记修复完成"""
    state = load_state()
    
    if problem_id not in state['problems']:
        return f"❌ 问题不存在: {problem_id}"
    
    problem = state['problems'][problem_id]
    
    # 添加完成节点
    add_timeline_node(
        problem_id,
        'complete',
        problem.get('resolved_by', BACKEND_AGENT_NAME),
        f"✅ 修复已完成",
        {
            'final_status': 'completed'
        }
    )
    
    # 更新状态
    problem['status'] = 'completed'
    problem['completed_at'] = datetime.now().isoformat()
    state['system_stats']['successful_resolves'] += 1
    save_state(state)
    
    # 通知前端和管理员
    await send_to_frontend(problem_id, None)
    await send_to_admin(problem_id, "已完成")
    
    return f"✓ 已标记为完成"

async def send_to_frontend(problem_id, fix=None):
    """发送消息给前端Agent"""
    # 模拟sessions_send
    if fix:
        message = f"""
🟢【修复方案】

问题ID: {problem_id}

方案说明：
{fix.get('explanation', '无说明')}

修复代码：
```typescript
{fix.get('code', '// 代码将在这里')}
```

---
请：
1. 前端开发人员应用上述代码
2. 测试API调用
3. 回复：/resolve {problem_id} - 问题已解决
   或：/continue {problem_id} - 需要继续修复
"""
    else:
        message = f"""
❌【修复失败】

问题ID: {problem_id}

错误：{fix.get('error', '未知错误')}

---
请检查修复方案并重试。
"""
    
    print(f"[后端Agent] → 前端Agent] {message[:100]}...")

async def send_to_admin(problem_id, action):
    """发送消息给管理员Agent"""
    message = f"""
🔔【后端Agent通知】

问题ID: {problem_id}
操作: {action}
时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
    
    print(f"[后端Agent] → 管理员Agent] {message[:100]}...")

# 命令处理器
async def analyze_command(problem_id):
    """分析问题命令"""
    state = load_state()
    
    if problem_id not in state['problems']:
        return f"❌ 问题不存在: {problem_id}"
    
    problem = state['problems'][problem_id]
    
    # 添加分析节点
    add_timeline_node(
        problem_id,
        'fix_attempt',
        BACKEND_AGENT_NAME,
        f"手动触发分析",
        {}
    )
    
    # AI分析
    analysis = await analyze_problem_with_ai(problem)
    
    # 生成修复代码
    fix = generate_fix_code(problem, analysis)
    
    # 保存修复方案
    problem['fix_solution'] = fix
    save_state(state)
    
    return f"""
🔍【分析结果】

问题ID: {problem_id}

错误分析：{analysis['summary']}
错误类型：{analysis['error_type']}

建议修复：{analysis['suggested_fix']}

---
已生成修复方案，查看: /status {problem_id}
"""

async def main():
    """主函数"""
    command = sys.argv[1] if len(sys.argv) > 1 else 'help'
    
    state = load_state()
    
    if command == 'help':
        print("""
🔧 后端修复助手命令：

问题修复：
• /fix <问题ID>          - 分析并生成修复方案
• /ready <问题ID> <代码> <说明>  - 手动标记为就绪
• /complete <问题ID>     - 标记修复完成

查看：
• /status <问题ID>         - 查看问题状态
• /analyze <问题ID>        - 手动触发分析

统计：
• /stats                    - 查看统计数据

问题示例：
• prob-abc12345
        """)
    
    elif command == '/fix':
        if len(sys.argv) < 3:
            print("❌ 请提供问题ID")
            return
        
        problem_id = sys.argv[2]
        result = await handle_fix_request({'id': problem_id})
        print(result)
    
    elif command == '/ready':
        if len(sys.argv) < 5:
            print("❌ 用法: /ready <问题ID> <代码> <说明>")
            return
        
        problem_id = sys.argv[2]
        fix_code = sys.argv[3]
        explanation = sys.argv[4]
        
        result = await mark_fix_ready(problem_id, fix_code, explanation)
        print(result)
    
    elif command == '/complete':
        if len(sys.argv) < 3:
            print("❌ 请提供问题ID")
            return
        
        problem_id = sys.argv[2]
        result = await mark_fix_complete(problem_id)
        print(result)
    
    elif command == '/status':
        if len(sys.argv) < 3:
            print("❌ 请提供问题ID")
            return
        
        problem_id = sys.argv[2]
        
        if problem_id not in state['problems']:
            print(f"❌ 问题不存在: {problem_id}")
            return
        
        problem = state['problems'][problem_id]
        
        # 统计时间线
        fix_attempts = len([n for n in problem['timeline'] if n['type'] == 'fix_attempt'])
        
        print(f"""
📋【问题状态】

问题ID: {problem_id}
接口: {problem['endpoint']}
方法: {problem['method']}
错误: {problem['error']}
状态: {problem['status']}

修复尝试次数: {fix_attempts}
最后更新: {problem.get('updated_at', 'N/A')}
解决时间: {problem.get('completed_at', '未解决'}

---
时间线（最近5个）：
{chr(10).join([f"  {n['type']}: {n['content'][:40]}" for n in problem['timeline'][-5:]])}
""")
    
    elif command == '/analyze':
        if len(sys.argv) < 3:
            print("❌ 请提供问题ID")
            return
        
        problem_id = sys.argv[2]
        result = await analyze_command(problem_id)
        print(result)
    
    elif command == '/stats':
        stats = state['system_stats']
        
        print(f"""
📊【系统统计】

总问题数: {len(state['problems'])}
总修复次数: {stats['total_fixes']}
成功解决数: {stats['successful_resolves']}
成功率: {f"{stats['successful_resolves'] / stats['total_fixes'] * 100:.1f}%" if stats['total_fixes'] > 0 else "N/A"}

---
各状态问题数：
""")
        
        status_counts = {}
        for pid, problem in state['problems'].items():
            status = problem['status']
            status_counts[status] = status_counts.get(status, 0) + 1
        
        for status, count in sorted(status_counts.items()):
            print(f"  {status}: {count} 个")
    
    else:
        print(f"❌ 未知命令: {command}")
        print("使用 /help 查看帮助")

if __name__ == '__main__':
    asyncio.run(main())
