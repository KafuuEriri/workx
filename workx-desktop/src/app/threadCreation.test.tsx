import { act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { project, setupWorkx, thread } from '../test/workx';

describe('thread creation integration', () => {
  it('opens a draft before startup completes and reuses startup when sending', async () => {
    const { result, request, defaultRequest: original } = await setupWorkx();
    await act(() => result.current.openThread('saved'));
    const pending = Promise.withResolvers<unknown>();
    request.mockImplementation((method, params) => method === 'thread/start'
      ? pending.promise : original(method, params));
    const oldKey = result.current.composerKey;
    let creating: Promise<void>;
    act(() => { creating = result.current.newThreadInProject(project.id); });
    expect(result.current.activeThread).toBeNull();
    expect(result.current.draft).toEqual({ projectId: project.id });
    expect(result.current.transcript).toEqual([]);
    expect(result.current.cwd).toBe('/workspace/frontend');
    expect(result.current.composerKey).not.toBe(oldKey);
    const draftKey = result.current.composerKey;
    let sending: Promise<void>;
    act(() => { sending = result.current.sendMessage('First message'); });
    expect(request.mock.calls.filter(([method]) => method === 'thread/start')).toHaveLength(1);
    expect(request.mock.calls.filter(([method]) => method === 'turn/start')).toHaveLength(0);
    await act(async () => {
      pending.resolve({ thread: thread('created') });
      await Promise.all([creating, sending]);
    });
    expect(result.current.activeThread).toEqual(thread('created'));
    expect(result.current.draft).toBeNull();
    expect(result.current.composerKey).toBe(draftKey);
    expect(request).toHaveBeenLastCalledWith('turn/start', {
      threadId: 'created', input: [{ type: 'text', text: 'First message', text_elements: [] }],
      runtimeWorkspaceRoots: ['/workspace/frontend', '/workspace/backend'], effort: undefined,
    });
  });

  it('keeps the newest selection when starts finish out of order', async () => {
    const { result, request, defaultRequest: original } = await setupWorkx();
    const first = Promise.withResolvers<unknown>();
    const second = Promise.withResolvers<unknown>();
    let count = 0;
    request.mockImplementation((method, params) => method === 'thread/start'
      ? (++count === 1 ? first.promise : second.promise) : original(method, params));
    let creatingFirst: Promise<void>;
    let creatingSecond: Promise<void>;
    act(() => { creatingFirst = result.current.newThreadInProject(project.id); });
    act(() => { creatingSecond = result.current.newThreadInProject(project.id); });
    await act(async () => { second.resolve({ thread: thread('second') }); await creatingSecond; });
    await act(async () => { first.resolve({ thread: thread('first') }); await creatingFirst; });
    expect(result.current.activeThread).toEqual(thread('second'));
    expect(result.current.projects[0].threads.map(({ id }) => id).sort()).toEqual(['first', 'saved', 'second']);
  });

  it('does not send to an abandoned draft or show its notifications after opening another chat', async () => {
    const { result, request, notify, defaultRequest: original } = await setupWorkx();
    const pending = Promise.withResolvers<unknown>();
    request.mockImplementation((method, params) => method === 'thread/start'
      ? pending.promise : original(method, params));
    let creating: Promise<void>;
    let sending: Promise<void>;
    act(() => { creating = result.current.newThreadInProject(project.id); });
    act(() => { sending = result.current.sendMessage('Abandoned message'); });
    await act(() => result.current.openThread('saved'));
    await act(async () => {
      pending.resolve({ thread: thread('abandoned') });
      await Promise.all([creating, sending]);
    });
    notify('item/agentMessage/delta', { threadId: 'abandoned', turnId: 'old', itemId: 'item', delta: 'Old output' });
    notify('turn/started', { threadId: 'abandoned', turn: { id: 'old' } });
    expect(result.current.activeThread).toEqual(thread('saved'));
    expect(result.current.transcript).toEqual([]);
    expect(result.current.running).toBe(false);
    expect(request.mock.calls.filter(([method]) => method === 'turn/start')).toEqual([]);
  });

  it('surfaces startup failures and can retry in the same project', async () => {
    const { result, request, defaultRequest: original } = await setupWorkx();
    request.mockImplementation((method, params) => method === 'thread/start'
      ? Promise.reject(new Error('Startup failed')) : original(method, params));
    await act(() => result.current.newThreadInProject(project.id));
    expect(result.current.activeThread).toBeNull();
    expect(result.current.error).toBe('Startup failed');
    request.mockImplementation(original);
    await act(() => result.current.sendMessage('Retry'));
    expect(result.current.activeThread).toEqual(thread('new'));
    expect(result.current.error).toBeNull();
  });
});
