import { act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { project, setupWorkx } from '../test/workx';

describe('project workspace integration', () => {
  it('passes every source folder when starting and sending, and searches all roots', async () => {
    const { result, request } = await setupWorkx();
    await act(() => result.current.newThreadInProject(project.id));
    expect(request).toHaveBeenCalledWith('thread/start', {
      cwd: '/workspace/frontend', projectId: project.id,
      runtimeWorkspaceRoots: ['/workspace/frontend', '/workspace/backend'],
      model: undefined, approvalPolicy: 'never', sandbox: 'danger-full-access',
    });
    await act(() => result.current.sendMessage('Read both source folders'));
    expect(request).toHaveBeenCalledWith('turn/start', {
      threadId: 'new', input: [{ type: 'text', text: 'Read both source folders', text_elements: [] }],
      runtimeWorkspaceRoots: ['/workspace/frontend', '/workspace/backend'], effort: undefined,
    });
    await result.current.searchMentionFiles('handler');
    expect(request).toHaveBeenCalledWith('fuzzyFileSearch', {
      query: 'handler', roots: ['/workspace/frontend', '/workspace/backend'], cancellationToken: null,
    });
  });

  it('repairs saved project threads on resume and uses updated roots on the next turn', async () => {
    const { result, request } = await setupWorkx();
    await act(() => result.current.openThread('saved'));
    expect(request).toHaveBeenCalledWith('thread/resume', {
      threadId: 'saved', runtimeWorkspaceRoots: ['/workspace/frontend', '/workspace/backend'],
    });
    request.mockResolvedValueOnce({ data: [{ ...project, roots: [{ path: 'C:\\src\\shared' }] }] });
    await act(() => result.current.refreshProjects());
    await act(() => result.current.sendMessage('Read updated sources'));
    expect(request).toHaveBeenLastCalledWith('turn/start', {
      threadId: 'saved', input: [{ type: 'text', text: 'Read updated sources', text_elements: [] }],
      runtimeWorkspaceRoots: ['C:\\src\\shared'], effort: undefined,
    });
  });

  it('leaves non-project workspace configuration to the server', async () => {
    const { result, request } = await setupWorkx();
    await act(() => result.current.newThread());
    expect(request).toHaveBeenCalledWith('thread/start', {
      cwd: '/home/user', projectId: undefined, runtimeWorkspaceRoots: undefined,
      model: undefined, approvalPolicy: 'never', sandbox: 'danger-full-access',
    });
  });
});
