import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { expect, it, vi } from 'vitest';

import { I18nProvider } from '../lib/i18n';
import { thread } from '../test/workx';
import { Sidebar } from './Sidebar';

it('shows a new project draft immediately and replaces it with the persisted thread', () => {
  const props: ComponentProps<typeof Sidebar> = {
    activeNav: 'new-chat', activeThreadId: null, draft: null,
    projects: [{
      id: 'project', name: 'New project', roots: ['/workspace/frontend'],
      primaryRoot: '/workspace/frontend', recencyAt: null, threads: [],
    }],
    recents: [], searchTerm: '', searchResults: [], searching: false, searchRequest: 0,
    onSelectNav: vi.fn(), onOpenSettings: vi.fn(), onNewChat: vi.fn(),
    onSelectThread: vi.fn(), onSelectProject: vi.fn(), onNewChatInProject: vi.fn(),
    onAddProject: vi.fn(), onArchiveProjectChats: vi.fn(), onEditProject: vi.fn(),
    onRenameProject: vi.fn(), onRemoveProject: vi.fn(), onSearchTermChange: vi.fn(),
    onRenameThread: vi.fn(), onArchiveThread: vi.fn(), onDeleteThread: vi.fn(),
  };
  const view = render(<Sidebar {...props} />, { wrapper: I18nProvider });
  expect(screen.queryByRole('status')).toBeNull();
  view.rerender(<Sidebar {...props} draft={{ projectId: 'project' }} />);
  expect(screen.getByRole('status').outerHTML).toMatchSnapshot('project draft');
  const projectRow = screen.getByRole('status').parentElement as HTMLElement;
  expect(projectRow.textContent).toContain('New project');
  view.rerender(<Sidebar
    {...props}
    activeThreadId="created"
    projects={[{ ...props.projects[0], threads: [thread('created')] }]}
  />);
  expect(screen.queryByRole('status')).toBeNull();
  fireEvent.click(within(projectRow).getByRole('button', { name: 'New chat' }));
  expect(props.onSelectThread).toHaveBeenCalledExactlyOnceWith('created');
});
