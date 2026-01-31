#!/usr/bin/env python3
"""
八字排盘 skill 实现
"""

import subprocess
import sys
import re
from datetime import datetime, timezone

API_URL = "https://yoebao.com/bazi/api/bazi.php"

# 天干映射
TIANGAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]

# 地支映射
DIZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]

# 向背映射（根据alias值）
XIANGBEI = ["比劫", "比劫", "食伤", "食伤", "财", "财", "官杀", "官杀", "印绶", "印绶"]

def call_bazi_api(birth_date, birth_time, sex):
    """
    调用八字排盘 API

    参数:
        birth_date: 出生日期 (YYYY-MM-DD)
        birth_time: 出生时间 (HH:mm)
        sex: 性别 (0=男, 1=女)

    返回:
        tuple: (八字, 大运列表, 向背, URL)
    """
    # 解析时间（假设北京时间 UTC+8）
    dt = datetime.strptime(f"{birth_date} {birth_time}", "%Y-%m-%d %H:%M")

    # 转换为时间戳（北京时间转换为 UTC）
    # 北京时间 = UTC+8，所以需要减去 8 小时
    from datetime import timedelta
    beijing_tz = timezone(timedelta(hours=8))
    dt = dt.replace(tzinfo=beijing_tz)
    timestamp = int(dt.timestamp())

    # 调用 API
    cmd = [
        "curl", "-s",
        f"{API_URL}?do=bytime&sex={sex}&timestamp={timestamp}"
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        return None, None, None, None, "API 调用失败"

    # 解析 JSON
    import json
    try:
        data = json.loads(result.stdout)

        if data.get('status') != 'ok':
            return None, None, None, None, "API 返回错误"

        bazi = data['data']['info']['bazi']
        sex_value = data['data']['info']['sex']

        # 获取大运数据
        yuns = data.get('data', {}).get('yuns', [])

        # 获取向背信息
        xiangbei_str = ""
        try:
            base = data.get('data', {}).get('base', [])
            if len(base) > 1:
                alias = base[1].get('zhi', {}).get('vector', {}).get('alias', 0)
                xiangbei_str = XIANGBEI[alias] + "地"
        except Exception:
            pass

        # 生成 URL（JavaScript 时间戳，毫秒级）
        url = f"https://yoebao.com/bazi/detail.html?sex={sex_value}&timestamp={timestamp * 1000}"

        return bazi, yuns, xiangbei_str, url, None
    except Exception as e:
        return None, None, None, None, f"解析失败: {str(e)}"

def parse_input(input_str):
    """
    解析用户输入
    
    格式: 排出八字 2020-01-01 12:00 男
    或: 排出八字 1990-06-15 08:30 女
    """
    # 移除"排出八字"前缀
    input_str = input_str.replace("排出八字", "").strip()
    
    # 分割参数
    parts = input_str.split()
    
    if len(parts) < 3:
        return None, None, None, "格式错误，请使用: 排出八字 2020-01-01 12:00 男"
    
    birth_date = parts[0]
    birth_time = parts[1]
    
    # 解析性别
    sex_str = parts[2]
    if sex_str in ['男', '男性', '0']:
        sex = 0
    elif sex_str in ['女', '女性', '1']:
        sex = 1
    else:
        return None, None, None, "性别参数错误，请使用男/女"
    
    return birth_date, birth_time, sex, None

def main():
    """
    主函数 - 从 stdin 读取输入，输出结果
    """
    # 读取输入
    input_str = sys.stdin.read().strip()
    
    if not input_str:
        print("请提供出生日期和时间")
        print("格式: 排出八字 2020-01-01 12:00 男")
        return
    
    # 解析输入
    birth_date, birth_time, sex, error = parse_input(input_str)
    
    if error:
        print(f"错误: {error}")
        return
    
    # 调用 API
    bazi, yuns, xiangbei, url, error = call_bazi_api(birth_date, birth_time, sex)
    
    if error:
        print(f"错误: {error}")
        return
    
    # 生成性别名称
    sex_name = "乾造" if sex == 0 else "坤造"
    
    # 生成大运字符串
    if yuns:
        dayun_list = []
        for yun in yuns:
            sn = yun.get('sn', 0)
            tiangan_idx = sn % 10
            dizhi_idx = sn % 12
            dayun_list.append(TIANGAN[tiangan_idx] + DIZHI[dizhi_idx])
        dayun_str = " ".join(dayun_list)
    else:
        dayun_str = ""
    
    # 输出结果（分两部分输出）
    sex_display = "男" if sex == 0 else "女"
    print(f"出生：{birth_date} {birth_time} {sex_display}")
    print(f"{sex_name}：{bazi}")
    if dayun_str:
        print(f"大运：{dayun_str}")
    if xiangbei:
        print(f"向背：{xiangbei}")
    print()
    print()
    print(f"[点击这里访问]({url})")

if __name__ == "__main__":
    main()
