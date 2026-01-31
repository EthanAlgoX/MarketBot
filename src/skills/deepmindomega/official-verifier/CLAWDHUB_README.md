# 官方项目验证器 (Official Verifier)

## 描述
此技能用于判断网站或项目仓库是否为官方项目，通过多种验证手段并以概率形式返回可信度评估。

This skill is used to determine whether a website or project repository is an official project, assessing authenticity through multiple verification methods and returning a probability-based credibility evaluation.

## 功能特性
- 多维度验证：GitHub Star数量、开发者认证、信息一致性、第三方引用、项目活跃度、安全指标
- 概率评估：返回0-100的可信度评分
- 详细分析：提供具体的评估理由和潜在风险提示
- 双语支持：支持中英文界面

## 验证维度
- **GitHub Star数量**：评估项目的受欢迎程度
- **开发者认证**：验证开发者信息的明确性
- **信息一致性**：检查项目历史和文档的一致性
- **第三方引用**：确认在技术社区的引用情况
- **项目活跃度**：评估代码提交和更新频率
- **安全指标**：检查安全警告和漏洞处理情况

## 使用场景
- 验证开源项目的真实性
- 识别冒牌项目或钓鱼网站
- 评估软件项目的可信度
- 辅助安全决策

## 输出示例
```json
{
  "probability": 92,
  "confidence": "very_high",
  "reasons": [
    "GitHub仓库有113,470个stars",
    "有官方博客详细说明",
    "开发者信息明确"
  ],
  "warnings": [],
  "score_breakdown": {
    "github_stars": 100,
    "developer_verification": 95,
    "information_consistency": 90
  }
}
```

## 安装
```bash
npx clawdhub install official-verifier
```

## 许可证
MIT License