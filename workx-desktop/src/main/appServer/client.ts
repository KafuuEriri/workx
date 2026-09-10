import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { createInterface } from 'node:readline';

import type { ClientInfo } from '@protocol/ClientInfo';
import type { InitializeResponse } from '@protocol/InitializeResponse';
import { resolveWorkxBinary } from './binary';

export type JsonRpcId = string | number;

export interface JsonRpcErrorShape {
  code: number;
  message: string;
  data?: unknown;
}

export class AppServerError extends Error {
  readonly code: number;

  constructor(message: string, code: number) {
    super(message);
    this.name = 'AppServerError';
    this.code = code;
  }
}

export interface AppServerNotification {
  method: string;
  params: unknown;
}

export interface AppServerServerRequest {
  id: JsonRpcId;
  method: string;
  params: unknown;
}

export interface AppServerExit {
  code: number | null;
  signal: NodeJS.Signals | null;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface WireMessage {
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: JsonRpcErrorShape;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const STDERR_TAIL_LINES = 40;

export interface AppServerClientEvents {
  notification: [AppServerNotification];
  serverRequest: [AppServerServerRequest];
  exit: [AppServerExit];
  log: [string];
}

export class AppServerClient extends EventEmitter<AppServerClientEvents> {
  private child: ChildProcessWithoutNullStreams | null = null;
  private readonly pending = new Map<JsonRpcId, PendingRequest>();
  private readonly stderrTail: string[] = [];
  private nextId = 1;
  private stopped = false;
  private lastError: Error | null = null;

  start(options: { bin?: string; args?: string[]; cwd?: string } = {}): void {
    if (this.child) {
      return;
    }
    this.stopped = false;
    this.lastError = null;
    this.stderrTail.length = 0;
    const bin = resolveWorkxBinary(options.bin);
    const args = options.args ?? ['app-server', '--stdio'];
    const child = spawn(bin, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child = child;

    const fail = (error: Error) => {
      if (this.child !== child) {
        return;
      }
      this.child = null;
      this.lastError = new Error(`Failed to run Workx CLI at ${bin}: ${error.message}`);
      this.rejectAll(this.lastError);
      this.emit('log', this.lastError.message);
      this.emit('exit', { code: null, signal: null });
      child.kill();
    };
    child.once('error', fail);
    child.stdin.on('error', fail);

    child.once('exit', (code, signal) => {
      if (this.child !== child) {
        return;
      }
      this.child = null;
      const detail = this.stderr();
      this.lastError = new Error(
        `app-server exited (code=${code ?? 'null'}) at ${bin}${detail ? `\n${detail}` : ''}`,
      );
      this.rejectAll(this.lastError);
      this.emit('exit', { code, signal });
    });

    const lines = createInterface({ input: child.stdout });
    lines.on('line', (line) => this.handleLine(line));

    const errors = createInterface({ input: child.stderr });
    errors.on('line', (line) => {
      this.stderrTail.push(line);
      if (this.stderrTail.length > STDERR_TAIL_LINES) {
        this.stderrTail.shift();
      }
      this.emit('log', line);
    });
  }

  async initialize(clientInfo: ClientInfo): Promise<InitializeResponse> {
    const response = await this.request<InitializeResponse>('initialize', {
      clientInfo,
      capabilities: {
        experimentalApi: true,
        requestAttestation: false,
      },
    });
    this.notify('initialized');
    return response;
  }

  request<T>(method: string, params?: unknown, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
    const child = this.child;
    if (!child) {
      return Promise.reject(this.lastError ?? new Error('app-server is not running'));
    }
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });
      this.write({ id, method, params });
    });
  }

  notify(method: string, params?: unknown): void {
    this.write({ method, params });
  }

  respond(id: JsonRpcId, result: unknown): void {
    this.write({ id, result });
  }

  respondError(id: JsonRpcId, code: number, message: string): void {
    this.write({ id, error: { code, message } });
  }

  stderr(): string {
    return this.stderrTail.join('\n');
  }

  stop(): void {
    this.stopped = true;
    this.rejectAll(new Error('app-server stopped'));
    const child = this.child;
    this.child = null;
    child?.kill();
  }

  private write(message: WireMessage): void {
    const child = this.child;
    if (!child || this.stopped) {
      return;
    }
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private handleLine(line: string): void {
    if (!line.trim()) {
      return;
    }
    let message: WireMessage;
    try {
      message = JSON.parse(line) as WireMessage;
    } catch {
      this.emit('log', `unparsable message: ${line.slice(0, 200)}`);
      return;
    }

    if (message.id !== undefined && message.method === undefined) {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) {
        pending.reject(new AppServerError(message.error.message, message.error.code));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.method !== undefined && message.id !== undefined) {
      this.emit('serverRequest', {
        id: message.id,
        method: message.method,
        params: message.params,
      });
      return;
    }

    if (message.method !== undefined) {
      this.emit('notification', { method: message.method, params: message.params });
    }
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
