#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Review Coordinator Agent - 审核协调器
管理员通过Clawdbot审核和分配修复任务
"""

import os
import sys
import json
import asyncio
from datetime import datetime, timedelta
from pathlib import Path

# 配置
ADMIN_AGENT_NAME = "admin:dev"
FRONTEND_AGENT_SESSION = "agent:frontend:dev"
BACKEND_AGENT_SESSION = "agent:backend:dev"

# 状态存储路径
STATE_FILE = "/Users/albot/clawd/state/PROBLEMS_STATE.json"

# 审核原因模板
REJECT_REASONS = {
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

def load_state():
    """加载状态"""
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {
        "problems": {},
        "review_queue": [],
        "completed_queue": [],
        "statistics": {
            "total_problems": 0,
            "approved_count": 0,
            "rejected_count": 0,
            "completed_count": 0,
            "avg_review_time": 0
        }
    }

def save_state(state):
    """保存状态"""
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

def create_timeline_node(node_type, actor, content, metadata=None):
    """创建时间线节点"""
    return {
        'type': node_type,
        'actor': actor,
        'actor_type': 'admin',
        'content': content,
        'metadata': metadata or {},
        'created_at': datetime.now().isoformat()
    }

async def add_to_review_queue(problem_id):
    """添加到审核队列"""
    state = load_state()
    
    if problem_id not in state['problems']:
        return f"❌ 问题不存在: {problem_id}"
    
    if problem_id in state['review_queue']:
        return f"⚠️ 问题已在审核队列中: {problem_id}"
    
    state['review_queue'].append(problem_id)
    state['problems'][problem_id]['status'] = 'reviewing'
    
    # 添加时间线节点
    state['problems'][problem_id]['timeline'].append(
        create_timeline_node(
            'review',
            ADMIN_AGENT_NAME,
            f"管理员将问题加入审核队列"
        )
    )
    
    save_state(state)
    return f"✅ 已加入审核队列: {problem_id}"

async def list_pending():
    """列出自审核问题"""
    state = load_state()
    
    if not state['review_queue']:
        return "📭 当前没有待审核的问题"
    
    message = "🔴【待审核问题列表】\n\n"
    
    for i, problem_id in enumerate(state['review_queue'][:10], 1):
        problem = state['problems'][problem_id]
        status_emoji = "⏳"
        
        message += f"{i}. {status_emoji} [{problem_id}]\n"
        message += f"   接口: {problem['endpoint']}\n"
        message += f"   错误: {problem['error'][:50]}\n"
        message += f"   优先级: {problem.get('priority', 'medium')}\n"
        message += f"   时间: {problem['created_at'][:16]}\n\n"
    
    if len(state['review_queue']) > 10:
        message += f"... 还有 {len(state['review_queue']) - 10} 个问题\n"
    
    message += f"\n总计: {len(state['review_queue'])} 个待审核问题"
    message += f"\n操作:\n"
    message += f"• /approve <id> - 批准修复任务\n"
    message += f"• /reject <id> <reason> - 拒绝（必填原因）\n"
    message += f"• /stats - 查看统计\n"
    
    return message

async def approve_problem(problem_id, note="", priority="medium"):
    """批准问题"""
    state = load_state()
    
    if problem_id not in state['review_queue']:
        return f"❌ 问题不在审核队列中: {problem_id}"
    
    problem = state['problems'][problem_id]
    
    # 从队列移除
    state['review_queue'].remove(problem_id)
    state['statistics']['approved_count'] += 1
    
    # 添加批准时间线节点
    problem['timeline'].append(
        create_timeline_node(
            'approve',
            ADMIN_AGENT_NAME,
            f"管理员批准修复任务，优先级: {priority}",
            {"note": note}
        )
    )
    
    # 更新状态
    problem['status'] = 'approved'
    problem['priority'] = priority
    save_state(state)
    
    # 更新平均审核时间
    now = datetime.now()
    created_time = datetime.fromisoformat(problem['created_at'])
    review_time = (now - created_time).total_seconds() / 60
    total_reviews = state['statistics']['approved_count']
    current_avg = state['statistics']['avg_review_time']
    new_avg = ((current_avg * (total_reviews - 1)) + review_time) / total_reviews
    state['statistics']['avg_review_time'] = new_avg
    
    save_state(state)
    
    # 通知后端Agent
    backend_message = f"""
✅【确认修复任务】

问题ID: {problem_id}
接口: {problem['endpoint']}
方法: {problem['method']}
错误: {problem['error']}

管理员备注: {note}
优先级: {priority}
审批时间: {now.strftime('%Y-%m-%d %H:%M:%S')}

---
请分析API并生成修复方案。
完成后更新状态为 'ready'。

问题报告人: {problem.get('frontend_agent', 'unknown')}
"""
    
    print(f"[管理员Agent] → 后端Agent] 批准修复任务: {problem_id}")
    
    # 通知前端Agent（可选）
    frontend_message = f"""
✅【修复任务已批准】

问题ID: {problem_id}
接口: {problem['endpoint']}
已批准修复，后端Agent正在分析生成方案。

---
等待后端Agent准备修复方案...
"""
    
    print(f"[管理员Agent] → 前端Agent] 通知问题: {problem_id}")
    
    return f"✅ 已批准修复任务: {problem_id}"

async def reject_problem(problem_id, reason, reason_type="other", suggestion=""):
    """拒绝问题"""
    state = load_state()
    
    if problem_id not in state['review_queue']:
        return f"❌ 问题不在审核队列中: {problem_id}"
    
    if not reason or reason.strip() == "":
        return "❌ 拒绝原因为必填项"
    
    problem = state['problems'][problem_id]
    
    # 从队列移除
    state['review_queue'].remove(problem_id)
    state['statistics']['rejected_count'] += 1
    
    # 添加拒绝时间线节点
    problem['timeline'].append(
        create_timeline_node(
            'reject',
            ADMIN_AGENT_NAME,
            f"拒绝原因: {reason}",
            {
                "reason_type": reason_type,
                "suggestion": suggestion,
                "admin_note": f"管理员拒绝"
            }
        )
    )
    
    # 更新状态
    problem['status'] = 'rejected'
    problem['rejected_reason'] = reason
    problem['rejected_type'] = reason_type
    save_state(state)
    
    # 更新按原因统计
    if reason_type not in state['statistics'].get('reject_by_reason', {}):
        state['statistics']['reject_by_reason'][reason_type] = 0
    state['statistics']['reject_by_reason'][reason_type] += 1
    save_state(state)
    
    # 通知前端Agent
    frontend_message = f"""
❌【修复任务已拒绝】

问题ID: {problem_id}
接口: {problem['endpoint']}
错误: {problem['error']}

拒绝原因：{reason}
原因类型：{reason_type}

---
前端AI建议：
{reason}

请根据拒绝原因灵活调整前端代码。
如需讨论，回复 @后端

---
改进建议: {suggestion}
"""
    
    print(f"[管理员Agent] → 前端Agent] 拒绝修复任务: {problem_id}")
    
    return f"✅ 已拒绝修复任务: {problem_id}"

async def show_history(problem_id, days=7):
    """显示审核历史"""
    state = load_state()
    
    if problem_id and problem_id in state['problems']:
        problem = state['problems'][problem_id]
        timeline = problem.get('timeline', [])
        
        history_message = f"📊【问题历史】\n\n"
        history_message += f"问题ID: {problem_id}\n"
        history_message += f"接口: {problem['endpoint']}\n"
        history_message += f"状态: {problem['status']}\n\n"
        history_message += "时间线（最近10条）:\n"
        
        for i, node in enumerate(reversed(timeline[-10:]), 1):
            icon = {
                'problem': '🔴',
                'review': '👀',
                'reject': '❌',
                'approve': '✅',
                'fix_attempt': '🔧',
                'fix_ready': '📦',
                'apply': '🚀',
                'confirm_resolve': '✨',
                'complete': '🎉'
            }.get(node['type'], '📌')
            
            actor_emoji = {
                'frontend': '👨‍💻',
                'backend': '👨‍💼',
                'admin': '👨‍💼',
                'system': '🤖'
            }.get(node['actor_type'], '🤖')
            
            timestamp = node['created_at'][:16]
            
            history_message += f"{i}. [{timestamp}] {icon} {actor_emoji} {node['content'][:60]}\n"
        
        history_message += f"\n当前状态: {problem['status']}\n"
        return history_message
    else:
        # 显示所有问题历史（最近N天）
        cutoff_time = (datetime.now() - timedelta(days=days)).isoformat()
        
        all_problems = []
        for pid, problem in state['problems'].items():
            for node in problem.get('timeline', []):
                if node['type'] in ['approve', 'reject', 'complete']:
                    all_problems.append({
                        'pid': pid,
                        'problem': problem,
                        'node': node
                    })
        
        # 按时间排序
        all_problems.sort(key=lambda x: x['node']['created_at'], reverse=True)
        
        history_message = f"📊【审核历史 - 最近{days}天】\n\n"
        
        for i, item in enumerate(all_problems[:20], 1):
            problem = item['problem']
            node = item['node']
            
            icon = '✅' if node['type'] == 'approve' else '❌'
            status = node['type']
            
            history_message += f"{i}. {icon} {status}: [{problem['id'][:8]}]\n"
            history_message += f"   接口: {problem['endpoint']}\n"
            history_message += f"   操作: {node['content'][:50]}\n"
            history_message += f"   时间: {node['created_at'][:16]}\n\n"
        
        return history_message

async def show_statistics():
    """显示统计数据"""
    state = load_state()
    stats = state['statistics']
    
    stats_message = f"📊【审核统计】\n\n"
    
    # 基本统计
    stats_message += f"📈 总览\n"
    stats_message += f"• 总问题数: {stats['total_problems']}\n"
    stats_message += f"• 已批准: {stats['approved_count']}\n"
    stats_message += f"• 已拒绝: {stats['rejected_count']}\n"
    stats_message += f"• 已完成: {stats['completed_count']}\n"
    stats_message += f"• 待审核: {len(state['review_queue'])}\n\n"
    
    # 效率指标
    total_reviews = stats['approved_count'] + stats['rejected_count']
    if total_reviews > 0:
        approve_rate = (stats['approved_count'] / total_reviews) * 100
        stats_message += f"🎯 效率\n"
        stats_message += f"• 批准率: {approve_rate:.1f}%\n"
        stats_message += f"• 平均审核时间: {stats.get('avg_review_time', 0):.1f} 分钟\n\n"
    
    # 按原因统计（拒绝）
    stats_message += f"❌ 拒绝原因分布\n"
    reject_reasons = stats.get('reject_by_reason', {})
    
    if reject_reasons:
        # 按数量排序
        sorted_reasons = sorted(reject_reasons.items(), key=lambda x: x[1], reverse=True)
        
        for reason, count in sorted_reasons[:5]:
            reason_name = {
                "invalid_params": "参数错误",
                "permission_denied": "权限不足",
                "not_applicable": "不适用",
                "already_fixed": "已修复",
                "need_more_info": "信息不足",
                "duplicate": "重复",
                "spec_unclear": "规范不清",
                "out_of_scope": "超出范围",
                "needs_discussion": "需要讨论"
                "other": "其他"
            }.get(reason, reason)
            
            percentage = (count / stats['rejected_count']) * 100 if stats['rejected_count'] > 0 else 0
            stats_message += f"• {reason_name}: {count} ({percentage:.1f}%)\n"
    
    # 状态分布
    status_counts = {}
    for problem in state['problems'].values():
        status = problem.get('status', 'unknown')
        status_counts[status] = status_counts.get(status, 0) + 1
    
    stats_message += f"\n📊 问题状态分布\n"
    for status, count in sorted(status_counts.items(), key=lambda x: x[1], reverse=True):
        stats_message += f"• {status}: {count}\n"
    
    return stats_message

async def get_status(problem_id):
    """获取问题状态"""
    state = load_state()
    
    if problem_id not in state['problems']:
        return f"❌ 问题不存在: {problem_id}"
    
    problem = state['problems'][problem_id]
    
    status_message = f"""
📋【问题状态】

问题ID: {problem_id}
接口: {problem['endpoint']}
方法: {problem['method']}
错误: {problem['error']}

当前状态: {problem['status']}
优先级: {problem.get('priority', 'medium')}

前端Agent: {problem.get('frontend_agent', 'N/A')}
后端Agent: {problem.get('backend_agent', 'N/A')}

时间线（最近5条）：
{' - '.join([f"{n['type']}: {n['content'][:40]}" for n in problem['timeline'][-5:]])}

---
状态说明：
• pending: 待审核
• reviewing: 审核中
• approved: 已批准
• rejected: 已拒绝
• fixing: 修复中
• ready: 修复就绪
• applied: 已应用
• completed: 已完成
"""
    
    return status_message

# 命令路由
async def handle_command(command, args):
    """路由命令到对应处理器"""
    
    if command == 'list':
        return await list_pending()
    
    elif command == 'approve':
        if len(args) < 1:
            return "❌ 用法: /approve <问题ID> [备注] [优先级]"
        
        problem_id = args[0]
        note = args[1] if len(args) > 1 else ""
        priority = args[2] if len(args) > 2 else "medium"
        
        return await approve_problem(problem_id, note, priority)
    
    elif command == 'reject':
        if len(args) < 2:
            return "❌ 用法: /reject <问题ID> <原因> [类型] [建议]"
        
        problem_id = args[0]
        reason = args[1]
        reason_type = args[2] if len(args) > 2 else "other"
        suggestion = args[3] if len(args) > 3 else ""
        
        return await reject_problem(problem_id, reason, reason_type, suggestion)
    
    elif command == 'history':
        problem_id = args[0] if len(args) > 0 else None
        days = int(args[1]) if len(args) > 1 else 7
        
        return await show_history(problem_id, days)
    
    elif command == 'stats':
        return await show_statistics()
    
    elif command == 'pending':
        return await list_pending()
    
    elif command == 'completed':
        return f"📊 已完成问题数: {len(load_state()['completed_queue'])}"
    
    elif command == 'status':
        if len(args) < 1:
            return "❌ 用法: /status <问题ID>"
        
        return await get_status(args[0])
    
    else:
        return f"❌ 未知命令: {command}\n\n可用命令:\n• /list - 列出待审核\n• /approve <id> - 批准\n• /reject <id> <原因> - 拒绝\n• /history [id] [days] - 历史\n• /stats - 统计\n• /status <id> - 状态"

async def main():
    """主函数"""
    if len(sys.argv) > 1:
        command = sys.argv[1]
        args = sys.argv[2:]
        
        result = await handle_command(command, args)
        print(result)
    else:
        print("""
👨‍💼 审核协调器 - 管理员通过Clawdbot审核修复任务

命令列表：
• /list          - 列出所有待审核问题
• /approve <id> [备注] [优先级] - 批准修复任务
• /reject <id> <原因> [类型] [建议] - 拒绝修复任务
• /history [id] [days] - 查看审核历史（默认7天）
• /stats         - 显示审核统计
• /status <id>   - 查看问题状态

快速操作：
• /pending       - 查看待审核（同 /list）
• /completed      - 查看已完成问题

审核原因类型：
• invalid_params    - 参数错误
• permission_denied - 权限不足
• not_applicable    - 不适用场景
• already_fixed      - 已在其他地方修复
• need_more_info    - 需要更多信息
• duplicate         - 重复问题
• spec_unclear       - API规范不清晰
• out_of_scope       - 超出当前范围
• will_not_fix       - 不修复，文档化
• needs_discussion - 需要团队讨论
• other             - 其他原因

示例：
/list
/approve prob-abc123 "同意，加急" high
/reject prob-abc123 "参数不正确" invalid_params "建议检查参数文档"
/history prob-abc123 3
/stats
/status prob-abc123
""")

if __name__ == '__main__':
    asyncio.run(main())
