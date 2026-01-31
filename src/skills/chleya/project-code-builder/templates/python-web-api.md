# Python Web API 项目模板

## 项目结构
```
project-name/
├── src/
│   ├── __init__.py
│   ├── main.py          # 应用入口
│   ├── api/             # API模块
│   │   ├── __init__.py
│   │   ├── routes.py    # 路由定义
│   │   └── endpoints/   # 端点实现
│   ├── models/          # 数据模型
│   │   ├── __init__.py
│   │   └── user.py
│   ├── services/        # 业务逻辑
│   │   ├── __init__.py
│   │   └── auth.py
│   └── utils/           # 工具函数
│       ├── __init__.py
│       └── validators.py
├── tests/               # 测试文件
│   ├── __init__.py
│   ├── test_api.py
│   └── test_models.py
├── config/              # 配置文件
│   ├── __init__.py
│   ├── settings.py
│   └── database.py
├── requirements.txt     # Python依赖
├── requirements-dev.txt # 开发依赖
├── .env.example         # 环境变量示例
├── .gitignore          # Git忽略文件
├── Dockerfile          # Docker配置
├── docker-compose.yml  # Docker Compose
├── README.md           # 项目说明
└── Makefile            # 构建脚本
```

## 核心文件模板

### main.py
```python
#!/usr/bin/env python3
"""
项目主入口 - Flask Web API
"""

from flask import Flask
from flask_cors import CORS
import os

def create_app():
    """创建Flask应用"""
    app = Flask(__name__)
    
    # 配置
    app.config.from_object('config.settings')
    
    # 跨域支持
    CORS(app)
    
    # 注册蓝图
    from src.api.routes import api_blueprint
    app.register_blueprint(api_blueprint)
    
    # 健康检查端点
    @app.route('/health')
    def health():
        return {'status': 'healthy', 'service': 'web-api'}
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(
        host=os.getenv('HOST', '0.0.0.0'),
        port=int(os.getenv('PORT', 5000)),
        debug=os.getenv('DEBUG', 'false').lower() == 'true'
    )
```

### requirements.txt
```
# Web框架
flask>=2.0.0
flask-cors>=3.0.0

# 数据库
sqlalchemy>=1.4.0
alembic>=1.7.0
psycopg2-binary>=2.9.0

# 认证
pyjwt>=2.3.0
python-dotenv>=0.19.0

# 工具
requests>=2.26.0
python-dateutil>=2.8.0
```

### Dockerfile
```dockerfile
FROM python:3.9-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 环境变量
ENV PYTHONPATH=/app
ENV FLASK_APP=src/main.py

# 暴露端口
EXPOSE 5000

# 启动命令
CMD ["python", "src/main.py"]
```

## 配置说明

### 环境变量 (.env.example)
```bash
# 应用配置
DEBUG=false
HOST=0.0.0.0
PORT=5000
SECRET_KEY=your-secret-key-here

# 数据库配置
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# JWT配置
JWT_SECRET=your-jwt-secret
JWT_EXPIRE_HOURS=24

# 其他服务
REDIS_URL=redis://localhost:6379
```

### 设置文件 (config/settings.py)
```python
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """基础配置"""
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')
    DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'
    
    # 数据库配置
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # JWT配置
    JWT_SECRET_KEY = os.getenv('JWT_SECRET', 'jwt-secret-key')
    JWT_ACCESS_TOKEN_EXPIRES = int(os.getenv('JWT_EXPIRE_HOURS', 24)) * 3600
    
    # API配置
    API_TITLE = 'Web API'
    API_VERSION = '1.0.0'
    OPENAPI_VERSION = '3.0.2'
```

## 使用说明

### 1. 创建项目
```bash
# 使用项目代码编制skill创建
/project-init python-web-api "Python Web API项目"
```

### 2. 安装依赖
```bash
pip install -r requirements.txt
```

### 3. 配置环境
```bash
cp .env.example .env
# 编辑.env文件设置配置
```

### 4. 运行开发服务器
```bash
python src/main.py
# 或使用Makefile
make run
```

### 5. 运行测试
```bash
pytest
# 或使用Makefile
make test
```

## Makefile 命令
```makefile
.PHONY: help run test lint format clean

help:
	@echo "可用命令:"
	@echo "  make run     - 启动开发服务器"
	@echo "  make test    - 运行测试"
	@echo "  make lint    - 代码检查"
	@echo "  make format  - 代码格式化"
	@echo "  make clean   - 清理临时文件"

run:
	FLASK_APP=src/main.py flask run --host=0.0.0.0 --port=5000

test:
	pytest -v --cov=src --cov-report=html

lint:
	flake8 src/
	black --check src/

format:
	black src/
	isort src/

clean:
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	rm -rf .coverage htmlcov
```

## 最佳实践

### 代码组织
1. **单一职责** - 每个文件/函数只做一件事
2. **依赖注入** - 避免硬编码依赖
3. **错误处理** - 统一的错误处理机制
4. **日志记录** - 详细的日志记录

### 安全考虑
1. **输入验证** - 所有输入都要验证
2. **SQL注入防护** - 使用参数化查询
3. **XSS防护** - 输出转义
4. **认证授权** - JWT + RBAC

### 性能优化
1. **数据库索引** - 为查询字段添加索引
2. **缓存策略** - 使用Redis缓存
3. **连接池** - 数据库连接池
4. **异步处理** - 耗时操作异步化

## 扩展建议

### 添加的功能
1. **用户管理** - 注册、登录、权限管理
2. **文件上传** - 支持多种文件格式
3. **消息队列** - Celery + RabbitMQ
4. **监控告警** - Prometheus + Grafana

### 部署选项
1. **Docker** - 容器化部署
2. **Kubernetes** - 容器编排
3. **云平台** - AWS, GCP, Azure
4. **Serverless** - AWS Lambda

---

**模板版本**: 1.0.0  
**最后更新**: 2026-01-30  
**适用场景**: 中小型Web API项目  
**技术栈**: Python + Flask + PostgreSQL + Docker