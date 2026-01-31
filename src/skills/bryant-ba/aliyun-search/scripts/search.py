#!/usr/bin/env python3
"""
使用阿里云 UnifiedSearch API 进行网页搜索

调用阿里云开放搜索 UnifiedSearch API 执行搜索并返回格式化结果
"""

import sys
import json
from typing import Dict, Optional, List

def aliyun_unified_search(
    query: str,
    time_range: str = "NoLimit",
    category: Optional[str] = None,
    engine_type: str = "Generic",
    city: Optional[str] = None,
    ip: Optional[str] = None
) -> str:
    """
    调用阿里云 UnifiedSearch API 执行搜索
    
    Args:
        query: 搜索查询字符串（必填）
        time_range: 查询时间范围，可选值：OneDay、OneWeek、OneMonth、OneYear、NoLimit
        category: 查询分类，多个分类用逗号分隔
        engine_type: 搜索引擎类型，可选值：Generic、GenericAdvanced、LiteAdvanced
        city: 城市名称（仅对 Generic 引擎生效）
        ip: 位置IP（仅对 Generic 引擎生效）
        
    Returns:
        格式化的搜索结果字符串
    """
    # 构建请求参数
    request_params: Dict[str, str] = {
        "query": query,
        "timeRange": time_range,
        "engineType": engine_type
    }
    
    if category:
        request_params["category"] = category
    if city:
        request_params["city"] = city
    if ip:
        request_params["ip"] = ip
    
    try:
        # 这里需要替换为实际的 API 调用逻辑
        # 注意：需要配置阿里云 AccessKey 和 Secret
        import requests
        from aliyunsdkcore.client import AcsClient
        from aliyunsdkcore.request import CommonRequest
        
        # 从环境变量读取阿里云凭证
        import os
        access_key_id = os.getenv('ALIBABA_CLOUD_ACCESS_KEY_ID')
        access_key_secret = os.getenv('ALIBABA_CLOUD_ACCESS_KEY_SECRET')
        
        if not access_key_id or not access_key_secret:
            raise ValueError("请设置环境变量 ALIBABA_CLOUD_ACCESS_KEY_ID 和 ALIBABA_CLOUD_ACCESS_KEY_SECRET")
        
        # 初始化阿里云客户端
        client = AcsClient(
            access_key_id,
            access_key_secret,
            "cn-hangzhou"
        )
        
        # 创建请求
        request = CommonRequest()
        request.set_method("POST")
        request.set_domain("opensearch.cn-hangzhou.aliyuncs.com")
        request.set_version("2017-12-25")
        request.set_action_name("UnifiedSearch")
        
        # 设置请求参数
        for key, value in request_params.items():
            request.add_query_param(key, value)
        
        # 发送请求
        response = client.do_action_with_exception(request)
        response_data = json.loads(response.decode('utf-8'))
        
        # 处理和格式化结果
        output = []
        
        if "pageItems" in response_data and response_data["pageItems"]:
            output.append("搜索结果：")
            output.append("--------")
            
            for item in response_data["pageItems"]:
                output.append(f"标题: {item.get('title', '无标题')}")
                output.append(f"链接: {item.get('link', '无链接')}")
                output.append(f"摘要: {item.get('snippet', '无摘要')}")
                if item.get('publishedTime'):
                    output.append(f"发布时间: {item['publishedTime']}")
                output.append("--------")
        else:
            output.append("未找到搜索结果")
        
        return '\n'.join(output)
        
    except Exception as e:
        return f"搜索失败: {str(e)}"

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python aliyun-search.py <query> [options]")
        print("Options:")
        print("  --time-range <range>    查询时间范围")
        print("  --category <category>   查询分类")
        print("  --engine-type <type>    搜索引擎类型")
        print("  --city <city>           城市名称")
        print("  --ip <ip>               位置IP")
        sys.exit(1)
    
    # 解析命令行参数
    query = sys.argv[1]
    time_range = "NoLimit"
    category = None
    engine_type = "Generic"
    city = None
    ip = None
    
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == "--time-range" and i + 1 < len(sys.argv):
            time_range = sys.argv[i+1]
            i += 2
        elif sys.argv[i] == "--category" and i + 1 < len(sys.argv):
            category = sys.argv[i+1]
            i += 2
        elif sys.argv[i] == "--engine-type" and i + 1 < len(sys.argv):
            engine_type = sys.argv[i+1]
            i += 2
        elif sys.argv[i] == "--city" and i + 1 < len(sys.argv):
            city = sys.argv[i+1]
            i += 2
        elif sys.argv[i] == "--ip" and i + 1 < len(sys.argv):
            ip = sys.argv[i+1]
            i += 2
        else:
            i += 1
    
    result = aliyun_unified_search(query, time_range, category, engine_type, city, ip)
    print(result)