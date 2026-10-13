# 金融助手产品介绍站

这是独立的 Astro 静态站，介绍当前已经实现的金融助手功能。页面没有订阅表单、统计脚本、公开下载、正式公司或未经确认的服务承诺。

```sh
pnpm --filter @marketbot/www dev
pnpm --filter @marketbot/www check
pnpm --filter @marketbot/www build
```

默认仅监听本机 `127.0.0.1:4321`，可用 `WWW_PORT` 更改端口。工作台本身需要按根目录 `LOCAL_DEVELOPMENT.md` 启动。

可选部署配置：

- `PUBLIC_APP_URL`：自己的工作台完整地址。未设置时，开始使用按钮进入本地使用说明。
- `PUBLIC_SITE_URL`：本站正式 HTTP 或 HTTPS 地址。未设置时不生成 canonical URL，并默认禁止索引。

没有默认发布域名、仓库、邮箱或公共在线服务。移动端真机推送、实际模型研究及长时间运行以根目录的验收记录为准。
