---
name: official_verifier
description: 判断网站或项目仓库是否为官方项目，通过多种验证手段并以概率形式返回可信度评估。Judges whether a website or project repository is official, evaluating authenticity through multiple verification methods and returning a probability-based assessment.
---

# 官方项目验证器技能 (Official Project Verifier Skill)

## 中文描述
此技能用于判断网站或项目仓库是否为官方项目，通过多种验证手段并以概率形式返回可信度评估。

## English Description
This skill is used to determine whether a website or project repository is an official project, assessing authenticity through multiple verification methods and returning a probability-based credibility evaluation.

## 使用方法 (Usage)
当用户询问某个项目或网站是否为官方项目时，使用此技能进行分析。技能将通过以下维度评估项目真实性：
- GitHub Star数量 (GitHub Star Count)
- 开发者认证 (Developer Verification) 
- 信息一致性 (Information Consistency)
- 第三方引用 (Third-party References)
- 项目活跃度 (Project Activity)
- 安全指标 (Security Indicators)

## 输出格式 (Output Format)
返回JSON格式的结果，包含以下字段：
- probability: 数值型，0-100，表示官方项目的可能性百分比 (Numeric value, 0-100, indicating percentage probability of being official)
- confidence: 字符串，"very_high", "high", "medium", "low", "very_low" (String, "very_high", "high", "medium", "low", "very_low")
- reasons: 数组，列出支持判断的具体理由 (Array, listing specific reasons supporting the judgment)
- warnings: 数组，列出潜在风险点 (Array, listing potential risk points)
- score_breakdown: 对象，包含各维度得分详情 (Object, containing detailed scores for each dimension)

## 工具使用 (Tool Usage)
使用内置的verify.js脚本执行验证逻辑，该脚本实现了多维度评分系统。
Uses the built-in verify.js script to execute verification logic, implementing a multi-dimensional scoring system.