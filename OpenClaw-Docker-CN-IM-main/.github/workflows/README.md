# Docker 构建和推送工作流

## 概述

此 GitHub Actions 工作流会在 `version.txt` 文件更新时自动构建 Docker 镜像并推送到 Docker Hub 和 GitHub Container Registry (ghcr.io)。

## 触发条件

工作流在以下情况下触发：

1. **自动触发**：当 `version.txt` 文件被修改并推送到 `main` 或 `master` 分支时
2. **手动触发**：通过 GitHub Actions 页面手动运行工作流

## 配置步骤

### 1. 设置 GitHub Secrets

在你的 GitHub 仓库中，需要配置以下 Secrets：

**Settings → Secrets and variables → Actions → New repository secret**

| Secret 名称 | 说明 | 示例 |
|------------|------|------|
| `DOCKERHUB_USERNAME` | Docker Hub 用户名 | `myusername` |
| `DOCKERHUB_TOKEN` | Docker Hub 访问令牌 | 在 Docker Hub 生成 |
| `DOCKERHUB_REPO` | Docker Hub 仓库名称 | `aiclient2api` |

**注意**：`GITHUB_TOKEN` 是自动提供的，无需手动配置。

### 2. 生成 Docker Hub 访问令牌

1. 登录 [Docker Hub](https://hub.docker.com/)
2. 点击右上角头像 → **Account Settings**
3. 选择 **Security** → **New Access Token**
4. 输入描述（如 "GitHub Actions"）并生成令牌
5. 复制令牌并保存到 GitHub Secrets 中

### 3. 创建 Docker Hub 仓库

1. 登录 Docker Hub
2. 点击 **Create Repository**
3. 输入仓库名称（如 `aiclient2api`）
4. 选择公开或私有
5. 创建仓库

## 使用方法

### 方法 1：更新版本号文件（推荐）

1. 编辑 `version.txt` 文件，更新版本号：
   ```bash
   echo "1.0.1" > version.txt
   ```

2. 提交并推送更改：
   ```bash
   git add version.txt
   git commit -m "chore: bump version to 1.0.1"
   git push origin main
   ```

3. GitHub Actions 会自动触发构建流程

### 方法 2：手动触发

1. 进入 GitHub 仓库页面
2. 点击 **Actions** 标签
3. 选择 **Build and Push Docker Image** 工作流
4. 点击 **Run workflow** 按钮
5. 选择分支并运行

## 构建产物

工作流会生成以下 Docker 镜像标签：

### Docker Hub
- `<username>/<repo>:<version>` - 版本号标签（如 `1.0.0`）
- `<username>/<repo>:latest` - 最新版本标签
- `<username>/<repo>:<branch>-<sha>` - 分支和提交 SHA 标签

### GitHub Container Registry
- `ghcr.io/<owner>/<repo>:<version>` - 版本号标签
- `ghcr.io/<owner>/<repo>:latest` - 最新版本标签
- `ghcr.io/<owner>/<repo>:<branch>-<sha>` - 分支和提交 SHA 标签

## 拉取镜像

### 从 Docker Hub 拉取
```bash
docker pull <username>/<repo>:1.0.0
docker pull <username>/<repo>:latest
```

### 从 GHCR 拉取
```bash
docker pull ghcr.io/<owner>/<repo>:1.0.0
docker pull ghcr.io/<owner>/<repo>:latest
```

## 多架构支持

工作流支持构建以下架构的镜像：
- `linux/amd64` - x86_64 架构
- `linux/arm64` - ARM64 架构（如 Apple Silicon、树莓派等）

Docker 会自动为你的平台选择正确的镜像。

## 版本号规范

建议使用语义化版本号（Semantic Versioning）：

- **主版本号**：不兼容的 API 修改（如 `2.0.0`）
- **次版本号**：向下兼容的功能性新增（如 `1.1.0`）
- **修订号**：向下兼容的问题修正（如 `1.0.1`）

示例：
```
1.0.0  # 初始版本
1.0.1  # 修复 bug
1.1.0  # 新增功能
2.0.0  # 重大更新
```

## 工作流特性

- ✅ 自动读取 `version.txt` 文件中的版本号
- ✅ 同时推送到 Docker Hub 和 GHCR
- ✅ 支持多架构构建（amd64 和 arm64）
- ✅ 使用 GitHub Actions 缓存加速构建
- ✅ 自动生成多个标签（版本号、latest、SHA）
- ✅ 详细的构建日志输出

## 故障排查

### 问题 1：Docker Hub 登录失败
- 检查 `DOCKERHUB_USERNAME` 和 `DOCKERHUB_TOKEN` 是否正确配置
- 确认 Docker Hub 访问令牌未过期
- 验证令牌具有推送权限

### 问题 2：GHCR 推送失败
- 确保仓库的 Actions 权限设置正确
- 检查 `GITHUB_TOKEN` 是否有 `packages: write` 权限
- 验证仓库可见性设置

### 问题 3：构建超时
- 检查 Dockerfile 是否有优化空间
- 考虑使用更小的基础镜像
- 利用 Docker 层缓存

## 高级配置

### 自定义触发分支

编辑 [`.github/workflows/docker-build-push.yml`](.github/workflows/docker-build-push.yml:8)：

```yaml
on:
  push:
    paths:
      - 'version.txt'
    branches:
      - main
      - develop  # 添加其他分支
```

### 添加更多镜像标签

编辑 [`.github/workflows/docker-build-push.yml`](.github/workflows/docker-build-push.yml:52)：

```yaml
tags: |
  type=raw,value=${{ steps.version.outputs.version }}
  type=raw,value=latest
  type=semver,pattern={{version}}
  type=semver,pattern={{major}}.{{minor}}
```

### 修改构建平台

编辑 [`.github/workflows/docker-build-push.yml`](.github/workflows/docker-build-push.yml:62)：

```yaml
platforms: linux/amd64,linux/arm64,linux/arm/v7
```

## 相关文件

- [`version.txt`](../../version.txt) - 版本号文件
- [`Dockerfile`](../../Dockerfile) - Docker 镜像构建文件
- [`.github/workflows/docker-build-push.yml`](.github/workflows/docker-build-push.yml) - GitHub Actions 工作流配置

## 参考资料

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Docker Hub 文档](https://docs.docker.com/docker-hub/)
- [GitHub Container Registry 文档](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [语义化版本规范](https://semver.org/lang/zh-CN/)
