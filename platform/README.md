# Platform

`platform/` 是本仓库的 JS/TS workspace，承载 Monitor Service、Workbench Web 和 TypeScript 共享层。Workbench 是 UI 产品名；workspace 名称为 platform。

## Layout

```text
platform/
  docs/                         架构、Workbench 产品与 API 文档
  services/monitor-service/     NestJS Monitor Service（3700）
  web/                          Workbench UI（4700）
  shared/                       TypeScript wire mirror
  .data/                        本地 SQLite（gitignore）
```

## Quick Start

```sh
bash scripts/platform.sh install
bash scripts/platform.sh dev-stable   # USB 真机联调推荐（service 无 watch）
bash scripts/platform.sh dev          # 改 service 代码时用 watch
```

默认端口：

- Workbench Web: `http://localhost:4700`
- Monitor Service: `http://localhost:3700`
- Swagger: `http://localhost:3700/docs`

## Commands

```sh
bash scripts/platform.sh install
bash scripts/platform.sh dev-stable
bash scripts/platform.sh dev
bash scripts/platform.sh service
bash scripts/platform.sh web
bash scripts/platform.sh build
bash scripts/platform.sh typecheck
bash scripts/platform.sh status
bash scripts/platform.sh stop
```

或直接使用 pnpm：

```sh
pnpm --dir platform install
pnpm --dir platform dev
pnpm --dir platform typecheck
pnpm --dir platform build
pnpm --dir platform run smoke
```

安装依赖后本地验证：

```sh
cd platform && pnpm install
pnpm run typecheck
pnpm run smoke
```

## Docs

- [Platform 文档索引](docs/README.md)
- [Platform 架构与计划](docs/workbench_plan.md)
- [Workbench 产品计划](docs/product_plan.md)
- [Monitor Service 数据边界](services/monitor-service/docs/boundaries.md)
