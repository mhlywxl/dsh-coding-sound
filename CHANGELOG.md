# Changelog

本文件记录 `dsh-coding-sound` 的公开版本变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

This file records public releases of `dsh-coding-sound`; each version ends with a one-line English summary.

## [0.2.0] - 2026-11-20

### Changed

- **工程结构对齐 DSH bundle 规范（纯重构，运行行为不变）。** 包根现在只放 loaders 需要的入口：`index.js`（Host）与 `client.js`（客户端构建产物）；客户端源码统一到 `src/client/`，构建脚本放到 `scripts/build-client.mjs`，不再把源码散在包根。
- **客户端源码拆成 13 个语义化模块。** `entry.js`、`constants.js`、`styles.js`、`locale.js`、`icons.js`、`presets.js`、`settings.js`、`chimes.js`、`engine.js`、`observer.js`、`sessions.js`、`section.js`、`apply.js`；构建顺序由 `scripts/build-client.mjs` 的 `MODULES` 清单决定，`entry.js` 必须第一、`apply.js` 必须最后，模块之间仍共享同一个 module-loader 闭包，因此不引入打包器、运行时依赖不变。
- **`scripts/build-client.mjs` 统一负责组装。** `npm run build` 重新生成 `client.js`，`npm run dev` 监听源码，`npm run build:check` 校验产物与源码是否一致；构建会拒绝「源码目录里有文件但未列入 `MODULES`」「清单指向不存在的文件」「清单重复项」「首尾顺序错误」以及跨模块重名的顶层函数，生成物带 `//#region src/client/<模块>` 标记。
- **补齐插件详情页。** `locale/en.json` / `locale/zh.json` 增加 `meta.detail`，分别指向 `docs/DETAIL.md` 与 `docs/DETAIL.zh.md`，配一张无文字特性图 `docs/preview.svg`；详情文档与图片随 npm 包发布。
- **npm 包只发布运行时文件。** 发布内容为 `index.js`、`client.js`、`cordis.patch.yml`、`locale/*.json`、`icon.svg`、`README.md`、`LICENSE`、`CHANGELOG.md`、`docs/DETAIL.md`、`docs/DETAIL.zh.md`、`docs/preview.svg`；`src/`、`scripts/` 与 `test.mjs` 只存在于仓库。
- 版本升到 0.2.0。

**English summary:** Structure-only refactor to match the DSH bundle convention: the client sources move to `src/client/` as 13 responsibility-named modules that share one module-loader closure and are ordered by an explicit `MODULES` manifest in `scripts/build-client.mjs` (build / watch / check, with manifest validation), the package root keeps only the `index.js` and `client.js` entries, the plugin detail page ships with localized `meta.detail` documents plus one text-free feature image, and the npm package now publishes runtime files only. Version 0.2.0; runtime behavior is unchanged.

更早的版本（0.1.0–0.1.4）记录在 git tag `v0.1.0`–`v0.1.4`；本文件从 0.2.0 起记录。
