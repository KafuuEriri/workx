import type { AskForApproval } from '@protocol/v2/AskForApproval';
import type { SandboxMode } from '@protocol/v2/SandboxMode';

import type { MessageKey } from '../lib/i18n';

export type NavKey =
  | 'new-chat'
  | 'plugins'
  | 'skills'
  | 'mcp';

export interface NavItem {
  key: NavKey;
  labelKey: MessageKey;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'new-chat', labelKey: 'nav.newChat' },
  { key: 'plugins', labelKey: 'nav.plugins' },
  { key: 'skills', labelKey: 'nav.skills' },
  { key: 'mcp', labelKey: 'nav.mcp' },
];

export interface PermissionMode {
  id: string;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  warning?: boolean;
  sandbox: SandboxMode;
  approvalPolicy: AskForApproval;
}

export const PERMISSION_MODES: PermissionMode[] = [
  {
    id: 'read-only',
    labelKey: 'permission.readOnly.label',
    descriptionKey: 'permission.readOnly.description',
    sandbox: 'read-only',
    approvalPolicy: 'never',
  },
  {
    id: 'auto',
    labelKey: 'permission.auto.label',
    descriptionKey: 'permission.auto.description',
    sandbox: 'workspace-write',
    approvalPolicy: 'on-request',
  },
  {
    id: 'workspace-write',
    labelKey: 'permission.workspaceWrite.label',
    descriptionKey: 'permission.workspaceWrite.description',
    sandbox: 'workspace-write',
    approvalPolicy: 'never',
  },
  {
    id: 'full-access',
    labelKey: 'permission.fullAccess.label',
    descriptionKey: 'permission.fullAccess.description',
    warning: true,
    sandbox: 'danger-full-access',
    approvalPolicy: 'never',
  },
];
