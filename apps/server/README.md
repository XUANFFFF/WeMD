# WeMD Server

`apps/server` 是 WeMD 的 NestJS 图片上传服务，主要承接本地或私有化部署场景下的上传能力。目前包含上传模块与腾讯 COS 服务封装。

## 目录结构

```
apps/server/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── services/        # 腾讯 COS 等服务封装
│   └── upload/          # 上传控制器、服务、DTO 与实体
├── test/                # e2e 测试
└── package.json
```

## 常用命令

```bash
pnpm --filter @wemd/server dev
pnpm --filter @wemd/server build
pnpm --filter @wemd/server test
pnpm --filter @wemd/server test:e2e
```

## 开发注意

- 上传能力涉及云服务密钥，示例、测试和文档中不要提交真实密钥。
- Server 不承载文章草稿存储；WeMD 的写作数据仍以本地优先为核心原则。
