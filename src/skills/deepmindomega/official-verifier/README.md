# 官方项目验证器技能 (Official Verifier Skill)

## 概述
此技能用于判断网站或项目仓库是否为官方项目，通过多种验证手段并以概率形式返回可信度评估。

## 文件结构
- `SKILL.md` - 技能规范和说明文档
- `verify.js` - 核心验证逻辑实现
- `README.md` - 使用说明文档

## 安装与使用

### 作为独立脚本运行
```bash
node verify.js
```
这将运行示例验证流程。

### 在代码中引入使用
```javascript
const OfficialVerifier = require('./verify.js');
const verifier = new OfficialVerifier();

const inputData = {
  starCount: 113470,
  hasOfficialBlog: true,
  // ... 其他参数
};

const result = verifier.verify(inputData);
console.log(result);
```

## 输入参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| starCount | Number | 0 | GitHub star数量 |
| hasOfficialBlog | Boolean | false | 是否有官方博客 |
| hasDevInfo | Boolean | false | 是否有明确的开发者信息 |
| devActivityLevel | String | 'low' | 开发者活跃度 ('high', 'medium', 'low') |
| hasClearHistory | Boolean | false | 项目历史是否清晰 |
| hasReasonableChanges | Boolean | false | 名称变更是否合理 |
| isWellDocumented | Boolean | false | 文档是否完善 |
| hasHNPosts | Boolean | false | 是否有Hacker News报道 |
| hasTechMediaCoverage | Boolean | false | 是否有技术媒体报道 |
| hasCommunityDiscussions | Boolean | false | 社区讨论是否活跃 |
| recentCommits | String | 'low' | 最近提交频率 ('high', 'medium', 'low') |
| issueResponse | String | 'low' | Issue响应速度 ('high', 'medium', 'low') |
| versionUpdates | String | 'low' | 版本更新频率 ('high', 'medium', 'low') |
| noSecurityWarnings | Boolean | false | 是否无安全警告 |
| hasCodeReviews | Boolean | false | 是否有代码审查 |
| responsiveToSecurityIssues | Boolean | false | 是否对安全问题响应及时 |

## 输出说明

验证结果以JSON格式返回：

- `probability`: 数值型，0-100，表示官方项目的可能性百分比
- `confidence`: 字符串，置信度等级 ("very_high", "high", "medium", "low", "very_low")
- `reasons`: 数组，列出支持判断的具体理由
- `warnings`: 数组，列出潜在风险点
- `score_breakdown`: 对象，包含各维度得分详情

## 权重分配

- GitHub Star数量: 25%
- 开发者认证: 20%
- 信息一致性: 20%
- 第三方引用: 15%
- 项目活跃度: 10%
- 安全指标: 10%

## 示例

```json
{
  "probability": 92,
  "confidence": "very_high",
  "reasons": [
    "GitHub仓库有113,470个stars",
    "有官方博客详细说明",
    "开发者信息明确",
    "项目历史清晰可追溯",
    "在技术社区有广泛讨论",
    "开发者活跃度高",
    "项目更新频繁"
  ],
  "warnings": [],
  "score_breakdown": {
    "github_stars": 100,
    "developer_verification": 95,
    "information_consistency": 90,
    "third_party_references": 85,
    "project_activity": 90,
    "security_indicators": 95
  }
}
```

## 注意事项

1. 结果仅供参考，不能保证100%准确
2. 需要结合人工判断
3. 某些新兴但高质量的项目可能star数不高，需特别注意
4. 验证结果会随着项目发展而变化