import type { AskForApproval } from '@protocol/v2/AskForApproval';
import type { SandboxMode } from '@protocol/v2/SandboxMode';

export type NavKey =
  | 'new-chat'
  | 'plugins'
  | 'skills'
  | 'mcp';

export interface NavItem {
  key: NavKey;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'new-chat', label: 'New chat' },
  { key: 'plugins', label: 'Plugins' },
  { key: 'skills', label: 'Skills' },
  { key: 'mcp', label: 'MCP servers' },
];

export interface PermissionMode {
  id: string;
  label: string;
  description: string;
  warning?: boolean;
  sandbox: SandboxMode;
  approvalPolicy: AskForApproval;
}

export const PERMISSION_MODES: PermissionMode[] = [
  {
    id: 'read-only',
    label: 'Read only',
    description: 'Workx can read files but cannot make changes.',
    sandbox: 'read-only',
    approvalPolicy: 'never',
  },
  {
    id: 'auto',
    label: 'Auto',
    description: 'Workx can read and edit files in the workspace.',
    sandbox: 'workspace-write',
    approvalPolicy: 'on-request',
  },
  {
    id: 'workspace-write',
    label: 'Workspace write',
    description: 'Workx can edit files inside the workspace, without asking to leave it.',
    sandbox: 'workspace-write',
    approvalPolicy: 'never',
  },
  {
    id: 'full-access',
    label: 'Full access',
    description:
      'Workx can run commands and edit files anywhere on your computer without asking.',
    warning: true,
    sandbox: 'danger-full-access',
    approvalPolicy: 'never',
  },
];
