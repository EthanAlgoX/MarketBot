# 项目代码编制 Skill

## 概述

一个智能的自动化项目代码编制工具，实现从idea到PR的全流程自动化。类似于Copilot++，但更智能（工具调用+长期记忆），专门为2026年标准高效workflow设计。

## 核心特性

### 🚀 全流程自动化
- **从零到PR**: 完整的项目开发生命周期管理
- **智能规划**: 基于需求自动生成项目结构和代码
- **迭代开发**: 模块化、增量式的代码编写
- **自动化测试**: 单元测试生成和执行
- **一键部署**: GitHub仓库创建和PR生成

### 🧠 智能优化
- **低token消耗**: 优化的prompt设计和输出控制
- **长期记忆**: 跨session的项目上下文保持
- **工具集成**: 深度集成GitHub、Git、测试工具
- **错误恢复**: 智能调试和修复循环控制

### ⚡ 高效workflow
- **隔离session**: 避免上下文污染
- **增量提交**: 模块完成即commit
- **结果摘要**: 只显示关键信息，减少输出
- **资源监控**: 实时token使用监控和优化

## 安装要求

### 必备Skills
```bash
# 安装依赖skills
/install skill github    # GitHub API集成
/install skill git       # 本地git操作
/install skill code-analyzer  # 代码审查/生成
/install skill tester    # 单元测试运行

# 可选（根据项目类型）
/install skill compiler  # 编译支持（C++/Java等）
```

### 配置优化
编辑 `moltbot.json`:
```json
{
  "thinking": "minimal",
  "autoCompact": true,
  "model": "deepseek/deepseek-coder-v2",
  "maxTokensPerStep": 5000,
  "enableMemory": true
}
```

重启Moltbot:
```bash
moltbot restart
```

验证配置:
```bash
/status
```

## 使用指南

### 快速开始

#### 1. 初始化新项目
```bash
# 创建GitHub仓库并初始化本地项目
Create a new GitHub repo named "my-flask-api" with description "Simple Flask API for user management". Init with README.md.
```

**优化提示**: 使用隔离session避免上下文污染
```bash
/new init-repo
```

**预期token消耗**: 输入<5k，输出<2k

#### 2. 规划项目结构
```bash
# 生成项目结构规划
Plan the project structure for a Flask API: endpoints for /users (GET/POST), database with SQLite, auth with JWT. Output as JSON tree.
```

**优化提示**: 指定输出格式减少token
```bash
# 只输出JSON，不解释
Output only JSON structure, no explanations.
```

**预期token消耗**: 输入10k-20k，压缩后降到5k

#### 3. 生成骨架代码
```bash
# 基于规划生成代码
Generate skeleton code based on the plan. Save to files in local clone.
```

**优化提示**: 输出只包含代码diff
```bash
# 只显示文件变化
Show only file changes, no explanations.
```

### 核心开发流程

#### 模块化代码编写
```bash
# 分模块开发，每个模块独立session
/new code-module

# 实现特定功能
Implement /users GET endpoint in app.py: fetch from DB.
```

**优化策略**:
- 每个模块完成后立即 `git add/commit`
- 使用 `minimal thinking` 模式
- 限制每个模块的迭代次数

**预期token消耗**: 每模块输入<10k，输出<5k

#### 调试和修复
```bash
# 错误诊断
Debug error in app.py line 42: TypeError.

# 修复bug
Fix failing test case X.
```

**优化策略**:
- 限制修复迭代次数（max 3 steps）
- 使用工具输出摘要
- 隔离session执行

### 测试和验证

#### 单元测试
```bash
# 运行测试
Run unit tests for app.py using pytest. Generate tests if none.

# 优化输出
--summary  # 只看测试结果摘要
```

#### 编译检查（如需）
```bash
# 编译项目
Compile the C++ project with cmake and run.
```

**优化策略**:
- 隔离session执行测试/编译
- 截断工具输出日志
- 只关注关键错误信息

### 代码审查和PR

#### 代码审查
```bash
# 全面审查
Review all changes: style, bugs, optimizations. Suggest fixes.

# 优化输出格式
Output as bullet points, be concise.
```

#### 生成PR
```bash
# 创建Pull Request
Create PR from local branch to main: title "Add user endpoints", description with changelog.
```

**优化策略**:
- 使用缓存减少diff输出
- 简短描述，重点突出
- 自动生成changelog

### 完成和清理

#### 推送和创建PR
```bash
# 执行推送
git push && gh pr create
```

#### 清理上下文
```bash
# 清理内存
/reset

# 或完全压缩
/compact full
```

## 高级功能

### 大规模项目处理
```bash
# 只加载特定目录
gitload dir src/

# 分文件夹处理
Process only the models/ directory.
```

### 跨session记忆
```bash
# 保存项目规范
/remember project-plan "Use PEP8 style"

# 复用记忆
Recall project style guidelines.
```

### 成本优化
```bash
# 切换低成本模型
/config model ollama/qwen2.5-coder

# 监控token使用
/status  # 定期检查
/compact  # 如果token过高
```

## 最佳实践

### Token优化策略
1. **分阶段执行**: 每个阶段独立session
2. **输出控制**: 只显示必要信息
3. **工具摘要**: 使用--summary参数
4. **定期压缩**: 监控并压缩上下文

### 质量控制
1. **增量提交**: 每个功能点完成后commit
2. **测试驱动**: 先写测试，再实现功能
3. **代码审查**: 每个模块完成后审查
4. **错误恢复**: 设置最大迭代次数

### 项目管理
1. **文档化**: 保持README和文档更新
2. **版本控制**: 使用语义化版本
3. **分支策略**: feature分支开发，main分支稳定
4. **CI/CD**: 集成自动化流水线

## 故障排除

### 常见问题

#### Token消耗过高
```bash
# 解决方案
/compact  # 压缩上下文
/config maxTokensPerStep 3000  # 限制每步token
/new session-name  # 创建新session重新开始
```

#### 无限循环
```bash
# 预防措施
# 在prompt中指定最大步骤
"Complete in max 3 steps"
"Fix with maximum 2 iterations"
```

#### 工具执行失败
```bash
# 检查工具安装
/status skills  # 确认skills已安装

# 检查权限
/config github-token YOUR_TOKEN  # 确保GitHub token配置
```

#### 内存不足
```bash
# 清理策略
/reset  # 重置当前session
/compact full  # 完全压缩
```

### 性能监控
```bash
# 实时监控
/status  # 查看token使用和内存

# 历史记录
/logs  # 查看执行日志
```

## 示例工作流

### 完整示例：Flask API项目
```bash
# 阶段1: 初始化
/new init-project
Create repo "user-api", init with Python .gitignore

# 阶段2: 规划
Plan Flask API with users, auth, database

# 阶段3: 开发（分模块）
/new module-users
Implement user model and endpoints

/new module-auth  
Implement JWT authentication

# 阶段4: 测试
/new testing
Write and run unit tests

# 阶段5: 审查和PR
/new review
Code review and create PR
```

### 预期总token消耗
```
初始化: 5k
规划: 10k
开发: 30k (3个模块×10k)
测试: 15k
审查: 10k
总计: ~70k tokens ($3-5 with DeepSeek)
```

## 扩展和定制

### 添加新语言支持
1. 创建语言特定模板
2. 配置编译/测试工具
3. 添加代码风格规则

### 集成CI/CD
1. 添加GitHub Actions配置
2. 配置自动化测试
3. 设置部署流水线

### 团队协作
1. 共享项目配置
2. 统一代码规范
3. 协作审查流程

## 版本历史

### v1.0.0 (2026-01-30)
- 初始版本发布
- 支持Python项目全流程
- 优化token消耗策略
- 集成GitHub和Git工具

### 未来计划
- 多语言支持扩展
- 可视化项目仪表板
- AI辅助代码审查增强
- 团队协作功能

---

**Skill设计**: 基于2026年标准高效workflow
**优化重点**: 低token消耗 + 高质量输出
**核心价值**: 从idea到PR的全流程自动化
**适用场景**: 个人项目、团队协作、教育学习