# 发布到ClawdHub指南

## 准备工作
在发布到ClawdHub之前，请确保已完成以下步骤：

1. **测试技能**：确保技能在本地环境中正常工作
2. **版本号**：确认package.json中的版本号正确
3. **许可证**：确认项目包含合适的开源许可证

## 发布步骤

### 1. 注册ClawdHub账户
如果您还没有ClawdHub账户，请先注册一个账户。

### 2. 安装ClawdHub CLI
```bash
npm install -g @clawdhub/cli
```

### 3. 登录ClawdHub
```bash
clawdhub login
```

### 4. 验证技能
在发布前验证技能格式：
```bash
clawdhub validate .
```

### 5. 发布技能
```bash
clawdhub publish
```

## 发布注意事项

1. **版本控制**：遵循语义化版本控制（Semantic Versioning）
2. **描述清晰**：提供清晰的技能描述和使用说明
3. **标签分类**：使用合适的标签便于用户搜索
4. **许可证**：明确指定许可证类型

## 技能维护

发布后，请注意：
- 及时响应用户反馈
- 定期更新技能以修复问题
- 保持向后兼容性
- 提供清晰的更新日志

## 技能元数据要求

确保package.json包含以下字段：
- name: 技能名称
- version: 版本号
- description: 技能描述（中英文）
- keywords: 相关关键词
- author: 作者信息
- license: 许可证类型
- clawdbot.skill: Clawdbot特定配置

## 故障排除

如果发布失败，请检查：
- 网络连接是否正常
- ClawdHub账户是否有发布权限
- package.json格式是否正确
- 所有必需文件是否存在