# Changelog

## Unreleased

### Changed

- 基于 OpenAI Codex `rust-v0.153.4`（`3d2ee51ca2d5db578f328aa75e20aa22c0197c9a`）建立独立的 workx 项目；原始源码保留为首个提交。
- 将 CLI、Rust crate、源码目录、内部类型、npm/Python SDK、配置 schema、测试快照、构建与发布产物统一更名为 workx。
- 将本地配置、认证和状态目录改为 `~/.workx`，项目目录改为 `.workx`，环境变量前缀改为 `WORKX_`，macOS 标识改为 `com.ronanxiao.workx`。
- 安装器默认从 `RonanXiao/workx` 的 GitHub Releases 下载；Python SDK 使用本地 workx runtime 源。
- 保留 OpenAI 服务、模型和协议兼容值，以及固定依赖下载与原始许可证、版权声明。

### Added

- 新增基础 smoke test，验证 workspace 路径、打包逻辑以及安装器下载、校验、失败处理和安装布局。
