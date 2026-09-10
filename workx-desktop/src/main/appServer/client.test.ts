import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppServerClient } from './client';

const spawn = vi.hoisted(() => vi.fn());
const resolveBinary = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ spawn }));
vi.mock('./binary', () => ({ resolveWorkxBinary: resolveBinary }));

function backend() {
  return Object.assign(new EventEmitter(), {
    stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
    kill: vi.fn(),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  spawn.mockReset();
  resolveBinary.mockReset().mockReturnValue('/cli/workx');
});
afterEach(() => vi.useRealTimers());

describe('app-server startup', () => {
  it('never spawns if the configured executable is the desktop', () => {
    resolveBinary.mockImplementation(() => { throw new Error('WORKX_BIN points to Workx Desktop'); });
    expect(() => new AppServerClient().start({ bin: '/desktop/Workx' })).toThrow('Workx Desktop');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('starts the resolved CLI with the stdio protocol and initializes normally', async () => {
    const child = backend();
    spawn.mockReturnValue(child);
    const client = new AppServerClient();
    client.start();
    expect(spawn).toHaveBeenCalledWith('/cli/workx', ['app-server', '--stdio'], {
      cwd: undefined, env: process.env, stdio: ['pipe', 'pipe', 'pipe'],
    });
    const promise = client.initialize({ name: 'test', version: '1', title: null });
    const sent = JSON.parse(child.stdin.read().toString());
    child.stdout.write(JSON.stringify({ id: sent.id, result: { userAgent: 'workx-test' } }) + '\n');
    await expect(promise).resolves.toEqual({ userAgent: 'workx-test' });
    expect(JSON.parse(child.stdin.read().toString())).toEqual({ method: 'initialized' });
    client.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['error', 'stdin error'])('rejects immediately on %s instead of a 120-second timeout', async (event) => {
    const child = backend();
    spawn.mockReturnValue(child);
    const client = new AppServerClient();
    const exits = vi.fn();
    client.on('exit', exits);
    client.start();
    const pending = client.request('initialize');
    if (event === 'error') {
      child.emit('error', new Error('ENOENT or EPIPE'));
    } else {
      child.stdin.emit('error', new Error('ENOENT or EPIPE'));
    }
    await expect(pending).rejects.toThrow('Failed to run Workx CLI at /cli/workx: ENOENT or EPIPE');
    await expect(client.request('initialize')).rejects.toThrow('ENOENT or EPIPE');
    expect(exits).toHaveBeenCalledExactlyOnceWith({ code: null, signal: null });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports an early zero exit with the selected executable and stderr', async () => {
    const child = backend();
    spawn.mockReturnValue(child);
    const client = new AppServerClient();
    client.start();
    const pending = client.request('initialize');
    child.stderr.write('This is a desktop launcher\n');
    child.emit('exit', 0, null);
    await expect(pending).rejects.toThrow('app-server exited (code=0) at /cli/workx\nThis is a desktop launcher');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores a stopped process exiting after its replacement has started', async () => {
    const previous = backend();
    const replacement = backend();
    spawn.mockReturnValueOnce(previous).mockReturnValueOnce(replacement);
    const client = new AppServerClient();
    client.start();
    client.stop();
    client.start();
    const pending = client.request('initialize');
    const sent = JSON.parse(replacement.stdin.read().toString());
    previous.emit('exit', 0, null);
    replacement.stdout.write(JSON.stringify({ id: sent.id, result: 'ready' }) + '\n');
    await expect(pending).resolves.toBe('ready');
    client.stop();
  });
});
