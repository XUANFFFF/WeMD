<p align="center">
  <img src="apps/web/public/favicon-dark.svg" width="80" height="80" alt="WeMD Logo" />
</p>

<h1 align="center">WeMD</h1>

<p align="center">
  <strong>更优雅的 Markdown 公众号排版工具</strong>
</p>

<p align="center">
  告别复杂工具。Markdown 写作，一键复制到公众号。<br>
  专为公众号创作者设计的<b>本地优先</b>编辑器。
</p>

<p align="center">
  <a href="https://wemd.app">🌐 官网</a> •
  <a href="https://edit.wemd.app">✏️ 在线使用</a> •
  <a href="https://wemd.app/docs">📖 文档</a> •
  <a href="https://github.com/tenngoxars/WeMD/releases">📦 下载桌面版</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-4CAF50?style=for-the-badge" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/Electron-28-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/pnpm-9-F69220?style=for-the-badge&logo=pnpm&logoColor=white" alt="pnpm" />
</p>

---

## ✨ 特性

|     | 功能              | 说明                                                   |
| --- | ----------------- | ------------------------------------------------------ |
| 📝  | **Markdown 语法** | 支持 GFM、表格、代码高亮、数学公式                     |
| 🎨  | **主题切换**      | 内置多款文章主题，支持可视化设计器或自定义 CSS         |
| 📋  | **一键复制**      | 针对微信公众号粘贴适配，尽量保持预览效果               |
| 📄  | **复制 HTML**     | 支持复制排版后的 HTML 内容，适配更多编辑场景           |
| 🖼️  | **多图床支持**    | 官方图床 / 七牛云 / 阿里云 / 腾讯云 / S3 兼容          |
| 💾  | **本地优先**      | 数据存储在本地，无需登录，隐私安全                     |
| 📱  | **跨平台**        | Web 端 + 桌面端（macOS / Windows / Linux）             |
| 🌙  | **界面风格**      | 亮色 / 深色 双模式可选                                 |
| 👁️  | **深色模式预览**  | 预览微信深色模式效果，还原度达 98%+                    |
| 🔍  | **高级搜索**      | 支持正则匹配、全词匹配、批量替换                       |
| 🎞️  | **滑动图组**      | 支持水平滑动的多图展示组件，丰富视觉体验               |
| 📊  | **Mermaid 图表**  | 内置流程图、时序图、甘特图等多种图表，自动适配主题配色 |

---

## 💡 技术亮点

### 微信深色模式预览算法

WeMD 内置了一套**色彩语义保全算法**，可在编辑器中预览微信公众号深色模式下的实际效果，还原度达 **98% 以上**。

> 该算法基于微信官方开源的 [wechatjs/mp-darkmode](https://github.com/wechatjs/mp-darkmode) 核心算法迁移并优化，旨在保证高性能 CSS 转换的同时提供最接近官方的渲染效果。

- 智能识别不同元素类型，分别优化
- HSL 色彩空间计算，确保视觉一致性

这（可能）是目前市面上除官方外唯一针对微信公众号深色模式预览的开源解决方案。

👉 **[查看算法详细原理解析](https://wemd.app/docs/reference/dark-mode-algorithm.html)** | **[查看算法源码](packages/core/src/wechatDarkMode.ts)**

---

## 🚀 快速开始

### 在线使用

直接访问 **[edit.wemd.app](https://edit.wemd.app)** 即可开始写作，无需安装，同样支持纯本地存储。

### 桌面版下载

前往 [Releases](https://github.com/tenngoxars/WeMD/releases) 下载对应平台安装包：

- **macOS**：`WeMD-<版本号>-arm64-mac.zip`（Apple Silicon）
- **Windows**：`WeMD.Setup.<版本号>.exe`
- **Linux**：`WeMD-<版本号>.AppImage`

> 当前自动发布的 macOS 安装包为 Apple Silicon 版本；Intel Mac 可优先使用在线版或自行从源码构建。

> ⚠️ **macOS 用户注意**：首次打开时如提示"应用已损坏"，请在终端执行：
>
> ```bash
> xattr -cr /Applications/WeMD.app
> ```
>
> ⚠️ **Windows 用户注意**：如 SmartScreen 提示"未知发布者"，点击「更多信息」→「仍要运行」
>
> ⚠️ **Linux 用户注意**：运行前需设置可执行权限：`chmod +x WeMD.AppImage`

### Docker 部署

```bash
docker compose pull
docker compose up -d
```

访问 `http://localhost:8080` 即可使用。

默认会拉取 `ghcr.io/tenngoxars/wemd-web:latest`。  
如需指定版本镜像，可覆盖环境变量：

```bash
WEMD_IMAGE=ghcr.io/tenngoxars/wemd-web:<版本号> docker compose up -d
```

---

## 🛠️ 本地开发

### 环境要求

- Node.js ≥ 18
- pnpm ≥ 9（推荐 `corepack enable pnpm`）

### 安装与运行

```bash
# 安装依赖
pnpm install

# 启动 Web 开发服务器
pnpm dev:web

# 启动桌面端（会先启动 Web，再启动 Electron）
pnpm dev:desktop
```

### 构建

```bash
# 构建 Web
pnpm --filter @wemd/web build

# 构建桌面应用
pnpm --filter wemd-electron run build:mac  # macOS
pnpm --filter wemd-electron run build:win  # Windows
```

---

## 📁 项目结构

```
WeMD/
├── apps/
│   ├── web/        # React + Vite 前端
│   ├── electron/   # Electron 桌面端
│   └── server/     # NestJS 图片上传服务
├── packages/
│   ├── core/       # Markdown 解析 / 主题 / 工具
│   └── cli/        # CLI 命令行工具 (agent 可调用)
├── templates/      # 主题 CSS 模板
├── scripts/        # 开发与构建辅助脚本
├── .github/        # CI、Docker 镜像与发布工作流
└── turbo.json      # Turborepo 配置
```

---

## 🤖 Agent / CLI 自动化

WeMD 提供了命令行接口，可供 agent 或自动化流程调用，将 Markdown 转换为微信公众号兼容的 HTML。

### 用法

```bash
# 基本转换
pnpm wemd convert article.md --out article.wechat.html

# 指定主题
pnpm wemd convert article.md --theme bauhaus --out output.html

# 转换后写入系统剪贴板
pnpm wemd convert article.md --theme cyberpunk-neon --copy

# 使用自有 Cloudflare R2 存储桶自动上传本地图片
pnpm wemd convert article.md --image-provider r2 --out article.wechat.html

# 查看可用主题
pnpm wemd convert --list-themes
```

### 参数

| 参数                    | 说明                                     |
| ----------------------- | ---------------------------------------- |
| `<input.md>`            | 输入 Markdown 文件路径                   |
| `--out <file>`          | 输出 HTML 文件路径（缺省输出到 stdout）  |
| `--theme <id>`          | 主题 ID，缺省为 `default`                |
| `--copy`                | 将 HTML 写入系统剪贴板                   |
| `--show-mac-bar`        | 在代码块顶部显示 macOS 风格窗口控制点    |
| `--image-provider <id>` | 图片上传 provider："noop"（默认）或 "r2" |
| `--list-themes`         | 列出所有可用主题 ID                      |
| `-h, --help`            | 显示帮助信息                             |

### 使用自有 Cloudflare R2 存储桶

CLI 支持将 Markdown 中的本地图片自动上传到 Cloudflare R2，并在输出 HTML 中替换为公网 URL。

#### 配置

通过环境变量配置（推荐，避免密钥写入仓库）：

```bash
# 启用 R2 图片上传
export WEMD_IMAGE_PROVIDER=r2
export CLOUDFLARE_R2_ACCOUNT_ID=<你的 Account ID>
export CLOUDFLARE_R2_ACCESS_KEY_ID=<R2 API Token Access Key ID>
export CLOUDFLARE_R2_SECRET_ACCESS_KEY=<R2 API Token Secret Access Key>
export CLOUDFLARE_R2_BUCKET=<Bucket 名称>
export CLOUDFLARE_R2_PUBLIC_BASE_URL=<公网访问域名，如 https://img.example.com>
# 可选：上传路径前缀
export CLOUDFLARE_R2_PREFIX=wemd
```

也可参考 `.env.example` 文件。

#### 快速开始

1. 在 [Cloudflare Dashboard](https://dash.cloudflare.com/) → R2 → 创建 Bucket。
2. 在 R2 → 管理 API 令牌 → 创建 API 令牌（权限：`Admin Read & Write`）。
3. 在 Bucket 设置中绑定自定义域名（或使用 Cloudflare 提供的 `r2.dev` 子域名）。
4. 配置上述环境变量后运行：

```bash
pnpm wemd convert article.md --image-provider r2 --out article.wechat.html
```

CLI 会自动识别 Markdown 中的本地图片（`![](./images/a.png)` 或 `<img src="./images/a.png">`），上传到 R2，并将输出中的图片地址替换为公网 URL。已经是 `http://` / `https://` / `data:` 的图片不会重复上传。

#### 文件命名规则

上传的文件存储在 `{prefix}/{年份}/{月份}/{hash}-{安全文件名}.{ext}` 路径下，避免重名覆盖。

#### 安全说明

- 密钥仅通过环境变量读取，不会出现在日志、错误堆栈或输出文件中。
- 仅允许上传 `image/jpeg`、`image/png`、`image/webp`、`image/gif` 格式。
- 单文件大小上限为 20MB。

### 在 agent 中调用

```bash
# agent 生成 markdown 后，一行命令完成公众号排版
pnpm wemd convert /tmp/draft.md --theme academic-paper --image-provider r2 --out ./dist/article.html
```

> **clipboard 说明**：`--copy` 在 Windows 下使用 CF_HTML 格式写入剪贴板，
> 粘贴到公众号可保留排版样式。macOS/Linux 在桌面环境下通常可用，
> 部分无头服务器环境可能不支持剪贴板。

---

## 📸 截图

![screenshot](.github/assets/screenshot.png)

---

## 💬 反馈与贡献

如有问题或建议，欢迎提交 [Issue](https://github.com/tenngoxars/WeMD/issues)。

WeMD 已开放外部贡献。准备提交代码前，请先阅读 [贡献指南](CONTRIBUTING.md)，确认本地开发环境、改动边界和必要检查项。

---

## 🤝 致谢

本项目的微信深色模式预览算法深度参考了微信官方开源的 [wechatjs/mp-darkmode](https://github.com/wechatjs/mp-darkmode) 核心逻辑。感谢微信团队为开发者提供的优秀解决方案！

---

## 📄 License

[MIT](LICENSE) © WeMD Team
