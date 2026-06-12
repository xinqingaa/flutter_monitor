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
./scripts/platform.sh
```

默认端口：

- Workbench Web: `http://localhost:4700`
- Monitor Service: `http://localhost:3700`
- Swagger: `http://localhost:3700/docs`

## Commands

```sh
./scripts/platform.sh
./scripts/platform.sh service
./scripts/platform.sh build
./scripts/platform.sh typecheck
./scripts/platform.sh status
./scripts/platform.sh stop
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
