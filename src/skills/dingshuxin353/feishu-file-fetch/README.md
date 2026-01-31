# feishu_file_fetch

从飞书群聊消息中按 `message_id` 和 `file_key` 下载附件的skill，可作为 **ClawdBot** 的扩展使用。下载时流式写入磁盘、计算 sha256、支持大小限制与路径穿越防护。

---

## 使用前必读

### 1. 先完成 ClawdBot 与飞书的对接

本工具设计为 **ClawdBot 的扩展**，用于在 ClawdBot 与飞书打通后，根据消息中的文件信息拉取文件到本地。

**请务必先完成以下事项，再使用本工具：**

- 已在 ClawdBot 侧完成与飞书（企业自建应用或飞书开放平台应用）的对接与配置。
- ClawdBot 能正常接收飞书消息，且你能拿到需要下载文件对应的 **消息 ID（message_id）** 和 **文件 key（file_key）**。
- 用于调用飞书 API 的 **同一套应用凭证**（`FEISHU_APP_ID` / `FEISHU_APP_SECRET`）已准备好，并将在运行本脚本时通过环境变量传入。

若尚未完成 ClawdBot 与飞书的对接，请先参考 ClawdBot 与飞书集成的文档完成配置，再使用本工具下载文件。

---

### 2. 飞书应用所需权限

本工具通过飞书开放平台 API 拉取「消息中的资源」（群聊消息里的附件）。应用必须在飞书开发者后台具备相应权限，否则会报错（如无权限、403 等）。

请在 [飞书开放平台](https://open.feishu.cn/) 进入你的应用 → **权限管理**，确保已开通并启用以下能力：

| 权限用途           | 说明 |
|--------------------|------|
| **获取租户 access_token** | 用于调用飞书 API，一般创建企业自建应用并配置了 `app_id` / `app_secret` 即具备。 |
| **获取消息中的资源**       | 对应接口：`GET /open-apis/im/v1/messages/{message_id}/resources/{file_key}`。需在权限列表中勾选与「消息」「资源」相关的 scope（如 **接收与发送消息** 或 **获取用户发送的消息内容** 等，以飞书当前文档为准）。 |

**建议操作：**

1. 登录 [飞书开放平台](https://open.feishu.cn/) → 进入你的应用。
2. 打开 **权限管理**，在 **权限列表** 中搜索与 **即时消息（IM）**、**消息资源** 相关的权限项。
3. 勾选「获取消息中的资源」或文档中标注为该接口所需的具体 scope，并发布版本 / 让管理员同意权限申请。
4. 若机器人需要访问某类群聊消息，还需在 **事件订阅** / **机器人** 配置中，确保应用已被添加到对应群聊并可接收消息。

具体 scope 名称以飞书官方 [权限列表文档](https://open.feishu.cn/document/server-docs/application-scope/introduction) 为准；若接口返回无权限，请对照该文档补申请相应权限。

---

## 环境要求

- **Python 3.x**（仅使用标准库，无需额外安装依赖）
- 已设置环境变量：`FEISHU_APP_ID`、`FEISHU_APP_SECRET`

---

## 配置

### 环境变量

| 变量名               | 必填 | 说明 |
|----------------------|------|------|
| `FEISHU_APP_ID`      | 是   | 飞书应用的 App ID。 |
| `FEISHU_APP_SECRET`  | 是   | 飞书应用的 App Secret。 |

请勿在日志或脚本中打印、记录上述凭证。

---

## Skill 存放方法

### 目录结构

将本 skill 存放在 ClawdBot 的 skill 目录下，建议目录结构如下：

```
clawd/
└── skills/
    └── feishu_file_fetch/
        ├── SKILL.md              # Skill 元数据与说明
        ├── README.md             # 本文件
        ├── reference.md          # API 参考文档
        └── scripts/
            └── feishu_file_fetch.py  # 主执行脚本
```

### 安装步骤

1. **复制 skill 目录**：将整个 `feishu_file_fetch` 目录复制到 ClawdBot 的 skill 目录（如 `clawd/skills/`）。

2. **设置执行权限**（如需要）：
   ```bash
   chmod +x scripts/feishu_file_fetch.py
   ```

3. **配置环境变量**：确保 ClawdBot 运行环境中已设置：
   - `FEISHU_APP_ID`
   - `FEISHU_APP_SECRET`

4. **验证安装**：可通过以下命令测试 skill 是否正常工作：
   ```bash
   echo '{"message_id":"om_xxx","file_key":"file_xxx"}' | python scripts/feishu_file_fetch.py
   ```

### 调用方式

ClawdBot 可通过以下方式调用本 skill：

#### 输入参数（JSON）

| 参数         | 必填 | 默认值           | 说明 |
|--------------|------|------------------|------|
| `message_id` | 是   | -                | 飞书消息 ID。 |
| `file_key`   | 是   | -                | 消息中附件的 file_key。 |
| `type`       | 否   | `"file"`         | 资源类型，一般保持 `file`。 |
| `outdir`     | 否   | `"/root/clawd/uploads"` | 文件保存根目录，按日期建子目录 `yyyyMMdd`。 |
| `max_bytes`  | 否   | `104857600`（100MB） | 单文件最大字节数，超出则中止并删除临时文件。 |

输入示例：

```json
{
  "message_id": "om_xxxxxxxxxxxx",
  "file_key": "file_xxxxxxxxxxxx",
  "type": "file",
  "outdir": "/root/clawd/uploads",
  "max_bytes": 104857600
}
```

#### 输出说明

- **成功**：向标准输出打印一个 JSON 对象，例如：

```json
{
  "ok": true,
  "path": "/root/clawd/uploads/20260129/xxx.pdf",
  "filename": "xxx.pdf",
  "bytes": 12345,
  "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

- **失败**：同样打印一个 JSON 对象，并返回非 0 退出码：

```json
{
  "ok": false,
  "error": "human-readable error message"
}
```

---

## 安全与限制

- 严格遵守 `max_bytes`：若 `Content-Length` 或实际下载量超过该值，会中止下载并删除临时文件。
- 所有落盘路径均限制在 `outdir` 下，防止路径穿越。
- 脚本不会记录或输出 `tenant_access_token`、`FEISHU_APP_ID`、`FEISHU_APP_SECRET`。
- Token 会在过期前约 2 分钟自动刷新。

---

## 与 ClawdBot 的配合方式

在 ClawdBot 与飞书对接完成后，当收到带附件消息时，可从消息体中取出 `message_id` 和附件的 `file_key`，构造上述 JSON 调用本脚本；根据返回的 `path`、`filename`、`bytes`、`sha256` 做后续存储或入库。具体调用方式（如子进程、HTTP 封装等）请参考 ClawdBot 的扩展开发文档。

---

## 参考

- 飞书 API 与错误码说明见项目内 [reference.md](reference.md)。
- 飞书开放平台：[https://open.feishu.cn/](https://open.feishu.cn/)。
