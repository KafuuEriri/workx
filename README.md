# workx

workx 是基于 OpenAI Codex `rust-v0.153.4` 的独立项目。

- 上游源码提交：`3d2ee51ca2d5db578f328aa75e20aa22c0197c9a`
- 项目仓库：<https://github.com/RonanXiao/workx>
- CLI 命令：`workx`
- Rust workspace：`workx-rs/`，crate 前缀：`workx-`
- 默认配置与数据目录：`~/.workx`，覆盖变量：`WORKX_HOME`
- 项目配置目录：`.workx/`；其他本地环境变量使用 `WORKX_` 前缀。
- npm 包名：`@ronanxiao/workx`、`@ronanxiao/workx-sdk`
- Python 包名：`workx`、`workx-cli-bin`；SDK 导入：`import workx`
- macOS 配置及应用标识：`com.ronanxiao.workx`

## 从源码运行和打包

使用仓库指定的 Rust toolchain，以及 Node.js、pnpm、Python 和 just：

```sh
cd workx-rs
cargo build --release --bin workx
./target/release/workx --help
```

在仓库根目录查看完整分发包的参数：

```sh
just assemble-workx-package --help
```

打包脚本、安装脚本及发布文件使用 workx 名称，安装器默认从本仓库的 GitHub Releases 下载。
当前仅完成源码导入和更名，尚未发布 npm/PyPI 包、GitHub Release 或桌面应用。
上游发布流程仍包含签名、发布凭据和运行环境要求，后续需配置后才能正式发布。

## 兼容性与来源

OpenAI 模型 ID、服务地址、OAuth 参数及服务端协议字段保留上游拼写。
固定版本的 V8、zsh 等依赖继续使用原始下载地址与校验信息。
这些值不属于 workx 的本地产品命名空间。workx 不自动迁移或读取 `~/.codex` 的配置。

本项目独立维护，不是 OpenAI 官方发行版。原始代码和第三方版权声明保留于
[LICENSE](LICENSE) 和 [NOTICE](NOTICE)。首个提交是未经修改的上游 tag 源码，第二个提交包含更名。

## 基础验证

```sh
scripts/smoke-test.sh
```

基础验证覆盖 Cargo workspace 路径解析、打包及安装器回归测试；不替代完整编译和全平台测试。
