import { execFile } from 'node:child_process';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 32 * 1024 * 1024;

export interface GitFileStatus {
  path: string;
  /** Raw two-character porcelain status, for example `M ` or `??`. */
  code: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
  deleted: boolean;
}

export interface GitStatusResult {
  isRepo: boolean;
  root: string | null;
  branch: string | null;
  files: GitFileStatus[];
}

export interface GitDiffResult {
  diff: string;
  error: string | null;
}

export interface GitCommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

export type GitScope = 'unstaged' | 'staged';

async function runGit(
  cwd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync('git', ['-C', cwd, ...args], {
      maxBuffer: MAX_BUFFER,
      encoding: 'utf8',
    });
    return { stdout, stderr, code: 0 };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; code?: number | string };
    return {
      stdout: failure.stdout ?? '',
      stderr: failure.stderr ?? String(error),
      code: typeof failure.code === 'number' ? failure.code : 1,
    };
  }
}

function parsePorcelain(output: string): GitFileStatus[] {
  const entries = output.split('\0');
  const files: GitFileStatus[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry || entry.length < 4) {
      continue;
    }
    const code = entry.slice(0, 2);
    let target = entry.slice(3);
    if (code[0] === 'R' || code[0] === 'C') {
      // Renames/copies carry the original path as the next NUL-delimited field.
      index += 1;
    }
    target = target.replace(/\/+$/, '');
    files.push({
      path: target,
      code,
      staged: code[0] !== ' ' && code[0] !== '?',
      unstaged: code[1] !== ' ' && code[1] !== '?',
      untracked: code === '??',
      deleted: code.includes('D'),
    });
  }
  return files;
}

export async function gitStatus(cwd: string): Promise<GitStatusResult> {
  const inside = await runGit(cwd, ['rev-parse', '--is-inside-work-tree']);
  if (inside.code !== 0 || inside.stdout.trim() !== 'true') {
    return { isRepo: false, root: null, branch: null, files: [] };
  }
  const [root, branch, status] = await Promise.all([
    runGit(cwd, ['rev-parse', '--show-toplevel']),
    runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']),
    runGit(cwd, ['status', '--porcelain=v1', '-z', '--untracked-files=all']),
  ]);
  return {
    isRepo: true,
    root: root.stdout.trim() || null,
    branch: branch.code === 0 ? branch.stdout.trim() || null : null,
    files: parsePorcelain(status.stdout),
  };
}

export async function gitDiff(
  cwd: string,
  scope: GitScope,
  filePath: string,
): Promise<GitDiffResult> {
  const args = scope === 'staged' ? ['diff', '--cached', '--no-color'] : ['diff', '--no-color'];
  const result = await runGit(cwd, [...args, '--', filePath]);
  if (result.code !== 0) {
    return { diff: '', error: result.stderr.trim() || 'git diff failed' };
  }
  return { diff: result.stdout, error: null };
}

export async function gitStage(cwd: string, filePath: string): Promise<GitCommandResult> {
  const result = await runGit(cwd, ['add', '--', filePath]);
  return { ok: result.code === 0, stdout: result.stdout, stderr: result.stderr };
}

export async function gitUnstage(cwd: string, filePath: string): Promise<GitCommandResult> {
  const result = await runGit(cwd, ['restore', '--staged', '--', filePath]);
  return { ok: result.code === 0, stdout: result.stdout, stderr: result.stderr };
}

export async function gitRevertFile(
  cwd: string,
  filePath: string,
  untracked: boolean,
): Promise<GitCommandResult> {
  if (untracked) {
    // New files may already be staged; drop the index entry before deleting so
    // the working tree ends up clean either way.
    await runGit(cwd, ['rm', '--cached', '--force', '--quiet', '--', filePath]);
    try {
      await unlink(path.join(cwd, filePath));
      return { ok: true, stdout: '', stderr: '' };
    } catch (error) {
      return { ok: false, stdout: '', stderr: String(error) };
    }
  }
  const result = await runGit(cwd, ['restore', '--source=HEAD', '--staged', '--worktree', '--', filePath]);
  return { ok: result.code === 0, stdout: result.stdout, stderr: result.stderr };
}

export async function gitCommit(cwd: string, message: string): Promise<GitCommandResult> {
  const result = await runGit(cwd, ['commit', '-m', message]);
  return { ok: result.code === 0, stdout: result.stdout, stderr: result.stderr };
}

export async function gitPush(cwd: string): Promise<GitCommandResult> {
  const result = await runGit(cwd, ['push']);
  return { ok: result.code === 0, stdout: result.stdout, stderr: result.stderr };
}

export interface GitNumstat {
  path: string;
  additions: number;
  deletions: number;
}

export async function gitNumstat(cwd: string, scope: GitScope): Promise<GitNumstat[]> {
  const args = scope === 'staged' ? ['diff', '--cached', '--numstat'] : ['diff', '--numstat'];
  const result = await runGit(cwd, args);
  if (result.code !== 0) {
    return [];
  }
  const stats: GitNumstat[] = [];
  for (const line of result.stdout.split('\n')) {
    if (!line) {
      continue;
    }
    const [added, removed, ...rest] = line.split('\t');
    if (rest.length === 0) {
      continue;
    }
    stats.push({
      path: rest.join('\t'),
      additions: added === '-' ? 0 : Number(added),
      deletions: removed === '-' ? 0 : Number(removed),
    });
  }
  return stats;
}
