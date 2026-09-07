# Changelog

## Unreleased

- 项目版本从 `0.0.1` 开始，统一 Rust、npm CLI、SDK 和 Python runtime 的版本。

### Changed

- 首次启动先选择 provider，再进入 OpenAI 认证或自定义端点配置；保留三种 OpenAI 登录方式。
- 自定义 provider 隔离 ChatGPT 认证状态，按协议限制服务端专属能力；完整推理端点地址归一化，避免重复追加路径。
- 修复 OpenAI 限额响应头与本地别名映射、Realtime multipart 边界及 Bedrock 默认协议兼容性。

- 基于 OpenAI Codex `rust-v0.153.4`（`3d2ee51ca2d5db578f328aa75e20aa22c0197c9a`）建立独立的 workx 项目；原始源码保留为首个提交。
- 将 CLI、Rust crate、源码目录、内部类型、npm/Python SDK、配置 schema、测试快照、构建与发布产物统一更名为 workx。
- 将本地配置、认证和状态目录改为 `~/.workx`，项目目录改为 `.workx`，环境变量前缀改为 `WORKX_`，macOS 标识改为 `com.ronanxiao.workx`。
- 安装器默认从 `RonanXiao/workx` 的 GitHub Releases 下载；Python SDK 使用本地 workx runtime 源。
- 保留 OpenAI 服务、模型和协议兼容值，以及固定依赖下载与原始许可证、版权声明。

### Added

- `/provider` 管理来源和本地 API key；自定义模型目录支持可配置 URL、启动刷新及来源隔离。
- Chat Completions 保留并回传 reasoning_content，修复思考模式工具调用后的请求失败。

- 新增内置 `InferenceProtocol` SPI，支持 Responses、Chat Completions 和基于 URI 路径的协议自动选择。
- 新增 Chat Completions 请求及 SSE 适配，覆盖文本、图片输入、函数与自由格式工具、工具结果、用量和流失败处理。
- 新增协议回归、核心工具循环集成测试，以及 provider 界面快照、配置保存与失败恢复测试。

- 新增基础 smoke test，验证 workspace 路径、打包逻辑以及安装器下载、校验、失败处理和安装布局。
