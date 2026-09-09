import type { FileUpdateChange } from '@protocol/v2/FileUpdateChange';

export type DiffLineKind = 'add' | 'remove' | 'context' | 'hunk' | 'meta';

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
}

export interface DiffStats {
  additions: number;
  deletions: number;
}

function splitLines(content: string): string[] {
  if (content.length === 0) {
    return [];
  }
  const lines = content.split('\n');
  if (lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

export function diffLines(change: FileUpdateChange): DiffLine[] {
  if (change.kind.type === 'add') {
    return splitLines(change.diff).map((text) => ({ kind: 'add', text }));
  }
  if (change.kind.type === 'delete') {
    return splitLines(change.diff).map((text) => ({ kind: 'remove', text }));
  }
  return splitLines(change.diff).map((line) => {
    if (line.startsWith('@@')) {
      return { kind: 'hunk', text: line };
    }
    if (line.startsWith('***')) {
      return { kind: 'meta', text: line };
    }
    if (line.startsWith('+')) {
      return { kind: 'add', text: line.slice(1) };
    }
    if (line.startsWith('-')) {
      return { kind: 'remove', text: line.slice(1) };
    }
    return { kind: 'context', text: line };
  });
}

export function diffStats(change: FileUpdateChange): DiffStats {
  const lines = diffLines(change);
  let additions = 0;
  let deletions = 0;
  for (const line of lines) {
    if (line.kind === 'add') {
      additions += 1;
    } else if (line.kind === 'remove') {
      deletions += 1;
    }
  }
  return { additions, deletions };
}

export function basename(target: string): string {
  const parts = target.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? target;
}

export function relativeTo(cwd: string, target: string): string {
  if (!target.startsWith('/') || !cwd) {
    return target;
  }
  const root = cwd.endsWith('/') ? cwd : `${cwd}/`;
  return target.startsWith(root) ? target.slice(root.length) : target;
}

interface Hunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  oldLines: string[];
  newLines: string[];
}

function parseHunks(diff: string): Hunk[] | null {
  const lines = diff.split('\n');
  if (lines[lines.length - 1] === '') {
    lines.pop();
  }
  const hunks: Hunk[] = [];
  let current: Hunk | null = null;
  for (const line of lines) {
    const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (header) {
      current = {
        oldStart: Number(header[1]),
        oldCount: header[2] === undefined ? 1 : Number(header[2]),
        newStart: Number(header[3]),
        newCount: header[4] === undefined ? 1 : Number(header[4]),
        oldLines: [],
        newLines: [],
      };
      hunks.push(current);
      continue;
    }
    if (!current) {
      return null;
    }
    if (line.startsWith('***')) {
      continue;
    }
    if (line.startsWith('+')) {
      current.newLines.push(line.slice(1));
    } else if (line.startsWith('-')) {
      current.oldLines.push(line.slice(1));
    } else if (line.startsWith(' ')) {
      current.oldLines.push(line.slice(1));
      current.newLines.push(line.slice(1));
    } else if (line.length > 0) {
      return null;
    }
  }
  return hunks;
}

/**
 * Reverse a unified diff against the current file content, restoring the
 * pre-edit lines. Returns null when the diff does not match the file.
 */
export function reverseApplyUnifiedDiff(content: string, diff: string): string | null {
  const hunks = parseHunks(diff);
  if (!hunks || hunks.length === 0) {
    return null;
  }
  const trailingNewline = content.endsWith('\n');
  const lines = content.split('\n');
  if (trailingNewline) {
    lines.pop();
  }
  for (const hunk of hunks.reverse()) {
    if (hunk.newCount !== hunk.newLines.length || hunk.oldCount !== hunk.oldLines.length) {
      return null;
    }
    const start = hunk.newStart - 1;
    const slice = lines.slice(start, start + hunk.newCount);
    if (slice.length !== hunk.newLines.length) {
      return null;
    }
    for (let index = 0; index < slice.length; index += 1) {
      if (slice[index] !== hunk.newLines[index]) {
        return null;
      }
    }
    lines.splice(start, hunk.newCount, ...hunk.oldLines);
  }
  const result = lines.join('\n');
  return trailingNewline ? `${result}\n` : result;
}

/** Parse a full `git diff` output into renderable lines. */
export function gitDiffLines(diff: string): DiffLine[] {
  const raw = diff.split('\n');
  if (raw[raw.length - 1] === '') {
    raw.pop();
  }
  return raw.map((line) => {
    if (
      line.startsWith('diff --git') ||
      line.startsWith('index ') ||
      line.startsWith('--- ') ||
      line.startsWith('+++ ') ||
      line.startsWith('new file') ||
      line.startsWith('deleted file') ||
      line.startsWith('similarity index') ||
      line.startsWith('rename ') ||
      line.startsWith('\\ No newline')
    ) {
      return { kind: 'meta', text: line };
    }
    if (line.startsWith('@@')) {
      return { kind: 'hunk', text: line };
    }
    if (line.startsWith('+')) {
      return { kind: 'add', text: line.slice(1) };
    }
    if (line.startsWith('-')) {
      return { kind: 'remove', text: line.slice(1) };
    }
    return { kind: 'context', text: line.startsWith(' ') ? line.slice(1) : line };
  });
}

export function gitDiffStats(diff: string): DiffStats {
  let additions = 0;
  let deletions = 0;
  for (const line of gitDiffLines(diff)) {
    if (line.kind === 'add') {
      additions += 1;
    } else if (line.kind === 'remove') {
      deletions += 1;
    }
  }
  return { additions, deletions };
}
