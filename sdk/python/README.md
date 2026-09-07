# Workx Python SDK

Build Python applications that start Workx threads, run turns, stream progress,
and control workspace access.

## Install

Install the SDK:

```bash
pip install workx
```

## Quickstart

The SDK reuses your existing Workx authentication when one is already
available:

```python
from workx import Workx

with Workx() as workx:
    thread = workx.thread_start()
    result = thread.run("Explain this repository in three bullets.")
    print(result.final_response)
```

`thread.run(...)` returns a `TurnResult` containing the final response,
collected items, and token usage.

## Authentication

Existing Workx authentication is reused automatically. To start ChatGPT
browser login explicitly:

```python
from workx import Workx

with Workx() as workx:
    login = workx.login_chatgpt()
    print(login.auth_url)
    print(login.wait().success)
```

For device-code login:

```python
with Workx() as workx:
    login = workx.login_chatgpt_device_code()
    print(login.verification_url, login.user_code)
    login.wait()
```

For API-key login:

```python
with Workx() as workx:
    workx.login_api_key("sk-...")
```

## Built-In Help

Use Python's standard `help(workx)`, `help(Workx)`, or
`python -m pydoc workx` documentation tools.

## Documentation

- [Getting started](https://github.com/RonanXiao/workx/blob/main/sdk/python/docs/getting-started.md)
- [API reference](https://github.com/RonanXiao/workx/blob/main/sdk/python/docs/api-reference.md)
- [FAQ](https://github.com/RonanXiao/workx/blob/main/sdk/python/docs/faq.md)
- [Examples](https://github.com/RonanXiao/workx/blob/main/sdk/python/examples/README.md)

The package is licensed under the
[repository Apache License 2.0](https://github.com/RonanXiao/workx/blob/main/LICENSE).
