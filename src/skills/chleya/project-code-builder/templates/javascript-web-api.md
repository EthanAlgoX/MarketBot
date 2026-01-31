# JavaScript Web API 项目模板

## 项目结构
```
project-name/
├── src/
│   ├── index.js          # 应用入口
│   ├── app.js            # Express应用
│   ├── routes/           # 路由定义
│   │   ├── index.js
│   │   ├── auth.js
│   │   └── api.js
│   ├── controllers/      # 控制器
│   │   ├── authController.js
│   │   └── userController.js
│   ├── models/           # 数据模型
│   │   ├── User.js
│   │   └── index.js
│   ├── services/         # 业务逻辑
│   │   ├── authService.js
│   │   └── userService.js
│   ├── middleware/       # 中间件
│   │   ├── auth.js
│   │   └── errorHandler.js
│   ├── utils/            # 工具函数
│   │   ├── validators.js
│   │   └── logger.js
│   └── config/           # 配置
│       ├── database.js
│       └── constants.js
├── tests/                # 测试文件
│   ├── unit/            # 单元测试
│   │   ├── controllers/
│   │   └── services/
│   └── integration/      # 集成测试
├── public/               # 静态文件
│   └── index.html
├── package.json          # 项目配置
├── package-lock.json     # 依赖锁文件
├── .env.example          # 环境变量示例
├── .gitignore           # Git忽略文件
├── .eslintrc.js         # ESLint配置
├── .prettierrc          # Prettier配置
├── Dockerfile           # Docker配置
├── docker-compose.yml   # Docker Compose
├── README.md            # 项目说明
└── Makefile             # 构建脚本
```

## 核心文件模板

### package.json
```json
{
  "name": "web-api",
  "version": "1.0.0",
  "description": "Express.js Web API",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --write src/",
    "docker:build": "docker build -t web-api .",
    "docker:run": "docker run -p 3000:3000 web-api"
  },
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "mongoose": "^6.0.0",
    "jsonwebtoken": "^8.5.1",
    "bcryptjs": "^2.4.3",
    "express-validator": "^6.14.0",
    "helmet": "^5.0.0",
    "morgan": "^1.10.0",
    "winston": "^3.3.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.0",
    "jest": "^27.0.0",
    "supertest": "^6.0.0",
    "eslint": "^8.0.0",
    "eslint-config-airbnb-base": "^15.0.0",
    "prettier": "^2.0.0",
    "@types/jest": "^27.0.0",
    "@types/node": "^16.0.0"
  },
  "engines": {
    "node": ">=14.0.0",
    "npm": ">=6.0.0"
  },
  "keywords": ["api", "express", "nodejs", "rest"],
  "author": "Your Name",
  "license": "MIT"
}
```

### src/index.js
```javascript
const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

// 启动服务器
const server = app.listen(PORT, () => {
  logger.info(`🚀 服务器运行在 http://localhost:${PORT}`);
  logger.info(`📊 环境: ${process.env.NODE_ENV || 'development'}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});

// 未捕获异常处理
process.on('uncaughtException', (error) => {
  logger.error('未捕获异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的Promise拒绝:', reason);
  process.exit(1);
});
```

### src/app.js
```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();

// 安全中间件
app.use(helmet());

// CORS配置
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// 请求日志
app.use(morgan('combined', { stream: logger.stream }));

// 解析请求体
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件
app.use(express.static('public'));

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'web-api'
  });
});

// API路由
app.use('/api', routes);

// 404处理
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `路径 ${req.path} 不存在`
  });
});

// 错误处理
app.use(errorHandler);

module.exports = app;
```

### Dockerfile
```dockerfile
FROM node:16-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 创建非root用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "src/index.js"]
```

## 配置说明

### 环境变量 (.env.example)
```bash
# 应用配置
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# 数据库配置
MONGODB_URI=mongodb://localhost:27017/webapi
REDIS_URL=redis://localhost:6379

# JWT配置
JWT_SECRET=your-jwt-secret-key-here
JWT_EXPIRE_DAYS=7

# 安全配置
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# 日志配置
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

### ESLint配置 (.eslintrc.js)
```javascript
module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: ['airbnb-base', 'prettier'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'no-console': 'off',
    'import/prefer-default-export': 'off',
    'class-methods-use-this': 'off',
    'no-underscore-dangle': 'off',
    'consistent-return': 'off',
    'no-param-reassign': ['error', { props: false }]
  }
};
```

## 使用说明

### 1. 创建项目
```bash
# 使用项目代码编制skill创建
/project-init javascript-web-api "JavaScript Web API项目"
```

### 2. 安装依赖
```bash
npm install
# 开发依赖
npm install --only=dev
```

### 3. 配置环境
```bash
cp .env.example .env
# 编辑.env文件设置配置
```

### 4. 运行开发服务器
```bash
npm run dev
# 或直接运行
node src/index.js
```

### 5. 运行测试
```bash
npm test
# 带覆盖率
npm run test:coverage
```

## Makefile 命令
```makefile
.PHONY: help install dev test lint format clean docker-build docker-run

help:
	@echo "可用命令:"
	@echo "  make install    - 安装依赖"
	@echo "  make dev        - 启动开发服务器"
	@echo "  make test       - 运行测试"
	@echo "  make lint       - 代码检查"
	@echo "  make format     - 代码格式化"
	@echo "  make clean      - 清理临时文件"
	@echo "  make docker-build - 构建Docker镜像"
	@echo "  make docker-run   - 运行Docker容器"

install:
	npm install

dev:
	npm run dev

test:
	npm test

lint:
	npm run lint

format:
	npm run format

clean:
	rm -rf node_modules coverage dist logs/*.log

docker-build:
	docker build -t web-api .

docker-run:
	docker run -p 3000:3000 --env-file .env web-api
```

## 最佳实践

### 代码组织
1. **模块化设计** - 按功能划分模块
2. **依赖注入** - 提高可测试性
3. **错误处理** - 统一的错误处理中间件
4. **日志记录** - 结构化日志记录

### 安全考虑
1. **输入验证** - 使用express-validator
2. **SQL注入防护** - 使用ORM参数化查询
3. **XSS防护** - 输出转义
4. **速率限制** - 防止暴力攻击

### 性能优化
1. **数据库索引** - 优化查询性能
2. **缓存策略** - Redis缓存
3. **连接池** - 数据库连接池
4. **压缩响应** - gzip压缩

## 扩展建议

### 添加的功能
1. **WebSocket** - 实时通信支持
2. **GraphQL** - GraphQL API
3. **文件上传** - 支持云存储
4. **消息队列** - RabbitMQ/Kafka集成

### 部署选项
1. **Docker** - 容器化部署
2. **Kubernetes** - 容器编排
3. **云平台** - AWS, GCP, Azure
4. **Serverless** - AWS Lambda

### 监控和日志
1. **应用监控** - New Relic, Datadog
2. **日志聚合** - ELK Stack
3. **性能追踪** - OpenTelemetry
4. **告警系统** - PagerDuty, OpsGenie

## 开发工作流

### 1. 代码规范
```bash
# 提交前检查
npm run lint
npm run format
npm test
```

### 2. Git工作流
```bash
# 功能分支
git checkout -b feature/new-feature
# 提交规范
git commit -m "feat: add new feature"
# 合并请求
git push origin feature/new-feature
```

### 3. CI/CD流水线
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm test
      - run: npm run lint
```

---

**模板版本**: 1.0.0  
**最后更新**: 2026-01-30  
**适用场景**: 现代Web API项目  
**技术栈**: Node.js + Express + MongoDB + Docker