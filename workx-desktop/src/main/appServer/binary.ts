import { accessSync, constants, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

/** Resolve a CLI path before spawning, without the OS's implicit application-directory search. */
export function resolveWorkxBinary(binaryOverride?: string): string {
  const windows = process.platform === 'win32';
  const paths = windows ? path.win32 : path.posix;
  const executable = windows ? 'workx.exe' : 'workx';
  const override = binaryOverride?.trim() || process.env.WORKX_BIN?.trim();
  const canonical = (value: string) => {
    let resolved = paths.resolve(value);
    try {
      resolved = realpathSync(resolved);
    } catch {
      // Keep the normalized path when an executable has been moved during an update.
    }
    return windows ? resolved.toLowerCase() : resolved;
  };
  const desktopExecutable = canonical(process.execPath);
  const candidates: string[] = [];

  if (override && (paths.isAbsolute(override) || /[/\\]/.test(override))) {
    candidates.push(paths.resolve(override));
  } else {
    if (!override) {
      if (process.resourcesPath) {
        candidates.push(paths.join(process.resourcesPath, 'bin', executable));
      }
      if (process.platform === 'darwin') {
        candidates.push('/opt/homebrew/bin/workx', '/usr/local/bin/workx');
      }
      if (windows) {
        if (process.env.WORKX_INSTALL_DIR) {
          candidates.push(paths.join(process.env.WORKX_INSTALL_DIR, executable));
        }
        if (process.env.LOCALAPPDATA) {
          candidates.push(
            paths.join(process.env.LOCALAPPDATA, 'Programs', 'OpenAI', 'Workx', 'bin', executable),
            paths.join(process.env.LOCALAPPDATA, 'Workx', 'bin', executable),
          );
        }
      }
      candidates.push(paths.join(homedir(), '.local', 'bin', executable));
    }

    const searchPath = process.env.PATH ?? process.env.Path ?? '';
    for (const entry of searchPath.split(paths.delimiter)) {
      const directory = entry.replace(/^"|"$/g, '');
      if (directory) {
        candidates.push(paths.resolve(directory, override ?? executable));
      }
    }
  }

  for (let candidate of candidates) {
    if (windows && !paths.extname(candidate)) {
      candidate += '.exe';
    }
    try {
      if (!statSync(candidate).isFile()) {
        continue;
      }
      accessSync(candidate, windows ? constants.F_OK : constants.X_OK);
    } catch {
      continue;
    }
    if (canonical(candidate) === desktopExecutable) {
      if (override) {
        throw new Error('WORKX_BIN points to Workx Desktop. Set it to the Workx CLI executable instead.');
      }
      continue;
    }
    return candidate;
  }

  throw new Error(
    `${override ? `Workx CLI not found at ${override}.` : 'Workx CLI not found.'} ` +
      'Install the Workx CLI or set WORKX_BIN to its executable, not the Workx Desktop application.',
  );
}
