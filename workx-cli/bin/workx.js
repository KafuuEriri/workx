#!/usr/bin/env node
// Unified entry point for the Workx CLI.

import { spawn } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "fs";
import { createRequire } from "node:module";
import path from "path";
import { fileURLToPath } from "url";

// __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const workxPackageRoot = realpathSync(path.join(__dirname, ".."));

const PLATFORM_PACKAGE_BY_TARGET = {
  "x86_64-unknown-linux-musl": "@ronanxiao/workx-linux-x64",
  "aarch64-unknown-linux-musl": "@ronanxiao/workx-linux-arm64",
  "x86_64-apple-darwin": "@ronanxiao/workx-darwin-x64",
  "aarch64-apple-darwin": "@ronanxiao/workx-darwin-arm64",
  "x86_64-pc-windows-msvc": "@ronanxiao/workx-win32-x64",
  "aarch64-pc-windows-msvc": "@ronanxiao/workx-win32-arm64",
};

const { platform, arch } = process;

let targetTriple = null;
switch (platform) {
  case "linux":
  case "android":
    switch (arch) {
      case "x64":
        targetTriple = "x86_64-unknown-linux-musl";
        break;
      case "arm64":
        targetTriple = "aarch64-unknown-linux-musl";
        break;
      default:
        break;
    }
    break;
  case "darwin":
    switch (arch) {
      case "x64":
        targetTriple = "x86_64-apple-darwin";
        break;
      case "arm64":
        targetTriple = "aarch64-apple-darwin";
        break;
      default:
        break;
    }
    break;
  case "win32":
    switch (arch) {
      case "x64":
        targetTriple = "x86_64-pc-windows-msvc";
        break;
      case "arm64":
        targetTriple = "aarch64-pc-windows-msvc";
        break;
      default:
        break;
    }
    break;
  default:
    break;
}

if (!targetTriple) {
  throw new Error(`Unsupported platform: ${platform} (${arch})`);
}

const platformPackage = PLATFORM_PACKAGE_BY_TARGET[targetTriple];
if (!platformPackage) {
  throw new Error(`Unsupported target triple: ${targetTriple}`);
}

function findWorkxExecutable() {
  let vendorRoot;
  try {
    const packageJsonPath = require.resolve(`${platformPackage}/package.json`);
    vendorRoot = path.join(path.dirname(packageJsonPath), "vendor");
  } catch {
    vendorRoot = path.join(__dirname, "..", "vendor");
  }

  const workxExecutable = path.join(
    vendorRoot,
    targetTriple,
    "bin",
    process.platform === "win32" ? "workx.exe" : "workx",
  );
  if (existsSync(workxExecutable)) {
    return workxExecutable;
  }

  const packageManager = detectPackageManager();
  const updateCommand =
    packageManager === "bun"
      ? "bun install -g @ronanxiao/workx@latest"
      : packageManager === "pnpm"
        ? "pnpm add -g @ronanxiao/workx@latest"
        : packageManager === "vite-plus"
          ? "vp install -g @ronanxiao/workx@latest"
          : "npm install -g @ronanxiao/workx@latest";
  throw new Error(
    `Missing optional dependency ${platformPackage}. Reinstall Workx: ${updateCommand}`,
  );
}

const binaryPath = findWorkxExecutable();

// Use an asynchronous spawn instead of spawnSync so that Node is able to
// respond to signals (e.g. Ctrl-C / SIGINT) while the native binary is
// executing. This allows us to forward those signals to the child process
// and guarantees that when either the child terminates or the parent
// receives a fatal signal, both processes exit in a predictable manner.

function isPnpmOwnedWorkxInstall(nodeModulesDir) {
  if (!existsSync(path.join(nodeModulesDir, ".modules.yaml"))) {
    return false;
  }

  try {
    return (
      realpathSync(path.join(nodeModulesDir, "@openai", "workx")) ===
      workxPackageRoot
    );
  } catch {
    return false;
  }
}

function isVitePlusOwnedWorkxInstall(packagesDir) {
  if (path.basename(packagesDir) !== "packages") {
    return false;
  }

  try {
    const metadata = JSON.parse(
      readFileSync(path.join(packagesDir, "@openai", "workx.json"), "utf8"),
    );
    if (metadata.name !== "@ronanxiao/workx") {
      return false;
    }

    // Vite+ records the active global installation in packages/@ronanxiao/workx.json.
    // Older installs have no ID or append a #-prefixed ID to the package name;
    // newer installs put the ID in a subdirectory of the package prefix.
    const installId = metadata.installId || "";
    const installDir = installId.startsWith("#")
      ? path.join(packagesDir, `@ronanxiao/workx${installId}`)
      : path.join(packagesDir, "@ronanxiao/workx", installId);
    for (const nodeModulesDir of [
      path.join(installDir, "lib", "node_modules"),
      path.join(installDir, "node_modules"),
    ]) {
      const packageRoot = path.join(nodeModulesDir, "@openai", "workx");
      if (
        existsSync(packageRoot) &&
        realpathSync(packageRoot) === workxPackageRoot
      ) {
        return true;
      }
    }
  } catch {
    // Missing or unreadable ownership metadata must not prevent Workx starting.
  }
  return false;
}

/**
 * Use heuristics to detect the package manager that was used to install Workx
 * in order to give the user a hint about how to update it.
 */
function detectPackageManager() {
  // Package-manager ownership metadata can be several parents above the package.
  // Search ancestors of both the canonical package root and lexical entrypoint
  // because the package manager may link either path.
  const entrypointDir = path.dirname(path.resolve(process.argv[1]));
  for (const startDir of new Set([workxPackageRoot, entrypointDir])) {
    const filesystemRoot = path.parse(startDir).root;
    for (
      let currentDir = startDir;
      currentDir !== filesystemRoot;
      currentDir = path.dirname(currentDir)
    ) {
      if (isVitePlusOwnedWorkxInstall(currentDir)) {
        return "vite-plus";
      }
      if (isPnpmOwnedWorkxInstall(path.join(currentDir, "node_modules"))) {
        return "pnpm";
      }
    }

    if (isPnpmOwnedWorkxInstall(path.join(filesystemRoot, "node_modules"))) {
      return "pnpm";
    }
  }

  const userAgent = process.env.npm_config_user_agent || "";
  if (/\bbun\//.test(userAgent)) {
    return "bun";
  }

  const execPath = process.env.npm_execpath || "";
  if (execPath.includes("bun")) {
    return "bun";
  }

  if (
    __dirname.includes(".bun/install/global") ||
    __dirname.includes(".bun\\install\\global")
  ) {
    return "bun";
  }

  return userAgent ? "npm" : null;
}

const packageManager = detectPackageManager();
const packageManagerEnvVar =
  packageManager === "bun"
    ? "WORKX_MANAGED_BY_BUN"
    : packageManager === "pnpm"
      ? "WORKX_MANAGED_BY_PNPM"
      : packageManager === "vite-plus"
        ? "WORKX_MANAGED_BY_VITE_PLUS"
        : "WORKX_MANAGED_BY_NPM";
const env = {
  ...process.env,
  WORKX_MANAGED_PACKAGE_ROOT: workxPackageRoot,
};
delete env.WORKX_MANAGED_BY_NPM;
delete env.WORKX_MANAGED_BY_BUN;
delete env.WORKX_MANAGED_BY_PNPM;
delete env.WORKX_MANAGED_BY_VITE_PLUS;
env[packageManagerEnvVar] = "1";

const child = spawn(binaryPath, process.argv.slice(2), {
  stdio: "inherit",
  env,
});

child.on("error", (err) => {
  // Typically triggered when the binary is missing or not executable.
  // Re-throwing here will terminate the parent with a non-zero exit code
  // while still printing a helpful stack trace.
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

// Forward common termination signals to the child so that it shuts down
// gracefully. In the handler we temporarily disable the default behavior of
// exiting immediately; once the child has been signaled we simply wait for
// its exit event which will in turn terminate the parent (see below).
const forwardSignal = (signal) => {
  if (child.killed) {
    return;
  }
  try {
    child.kill(signal);
  } catch {
    /* ignore */
  }
};

["SIGINT", "SIGTERM", "SIGHUP"].forEach((sig) => {
  process.on(sig, () => forwardSignal(sig));
});

// When the child exits, mirror its termination reason in the parent so that
// shell scripts and other tooling observe the correct exit status.
// Wrap the lifetime of the child process in a Promise so that we can await
// its termination in a structured way. The Promise resolves with an object
// describing how the child exited: either via exit code or due to a signal.
const childResult = await new Promise((resolve) => {
  child.on("exit", (code, signal) => {
    if (signal) {
      resolve({ type: "signal", signal });
    } else {
      resolve({ type: "code", exitCode: code ?? 1 });
    }
  });
});

if (childResult.type === "signal") {
  // Re-emit the same signal so that the parent terminates with the expected
  // semantics (this also sets the correct exit code of 128 + n).
  process.kill(process.pid, childResult.signal);
} else {
  process.exit(childResult.exitCode);
}
