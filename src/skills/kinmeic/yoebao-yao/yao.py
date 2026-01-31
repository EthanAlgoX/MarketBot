#!/usr/bin/env python3
"""
六爻排盘 skill 实现
"""

import subprocess
import sys
import random
import json
from datetime import datetime

API_URL = "https://yoebao.com/yao/api/yao.php"

def generate_ss():
    """生成6位随机数字，每位从6789中抽取"""
    return ''.join(str(random.choice([6, 7, 8, 9])) for _ in range(6))

def call_yao_api(ss):
    """
    调用六爻排盘 API
    
    参数:
        ss: 6位数字字符串
    
    返回:
        tuple: (时间, 占得, URL, 错误信息)
    """
    # 调用 API
    cmd = [
        "curl", "-s",
        f"{API_URL}?do=calc&shacks={ss}"
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        return None, None, None, "API 调用失败"
    
    # 过滤掉 PHP 警告，只保留 JSON 部分
    import re
    json_match = re.search(r'\{.+\}', result.stdout, re.DOTALL)
    
    if not json_match:
        return None, None, None, "API 返回数据格式错误"
    
    try:
        data = json.loads(json_match.group())
        
        if data.get('status') != 'ok':
            return None, None, None, "API 返回错误"
        
        # 获取排盘时间
        create_datetime = data.get('data', {}).get('info', {}).get('datetime', '')
        
        # 获取卦名
        trigrams_divine = data.get('data', {}).get('trigrams', {}).get('divine', {}).get('name', '')
        trigrams_change = data.get('data', {}).get('trigrams', {}).get('change', {}).get('name', '')
        
        # 如果变卦不同，拼接变卦
        if trigrams_change and trigrams_change != trigrams_divine:
            trigram_name = f"{trigrams_divine} 变 {trigrams_change}"
        else:
            trigram_name = trigrams_divine
        
        # 生成 URL
        url = f"https://yoebao.com/yao/detail.html?ss={ss}"
        
        return create_datetime, trigram_name, url, None
        
    except Exception as e:
        return None, None, None, f"解析失败: {str(e)}"

def parse_input(input_str):
    """
    解析用户输入
    
    格式: 六爻占卜 我的事业运如何
          排六爻 感情运势
          摇一卦 近期财运
    """
    # 移除"六爻"、"占卜"、"排"、"摇一卦"等前缀
    input_str = input_str.replace("六爻", "").replace("占卜", "").replace("排", "").replace("摇一卦", "").strip()
    
    if not input_str:
        return None, None, None, "请输入您想要求测的问题，例如：六爻占卜 我的事业运如何"
    
    # 第一部分是问题
    question = input_str
    
    return question, None, None, None

def main():
    """
    主函数 - 从 stdin 读取输入，输出结果
    """
    # 读取输入
    input_str = sys.stdin.read().strip()
    
    if not input_str:
        print("请输入您想要求测的问题")
        print("格式: 六爻占卜 我的事业运如何")
        print("       排六爻 感情运势")
        print("       摇一卦 近期财运")
        return
    
    # 解析输入
    question, _, _, error = parse_input(input_str)
    
    if error:
        print(f"错误: {error}")
        return
    
    # 生成随机 ss
    ss = generate_ss()
    
    # 调用 API
    create_datetime, trigram_name, url, error = call_yao_api(ss)
    
    if error:
        print(f"错误: {error}")
        return
    
    # 输出结果（分两部分输出）
    print(f"问题：{question}")
    print(f"时间：{create_datetime}")
    print(f"占得：{trigram_name}")
    print()
    print()
    print(f"[点击这里查看详情]({url})")

if __name__ == "__main__":
    main()
