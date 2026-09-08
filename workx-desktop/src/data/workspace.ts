export type ToolCallIcon = 'wrench' | 'globe' | 'folder' | 'terminal';

export interface ToolCall {
  id: string;
  icon: ToolCallIcon;
  label: string;
  dimmed?: boolean;
}

export interface UserMessage {
  id: string;
  role: 'user';
  text: string;
}

export interface AssistantMessage {
  id: string;
  role: 'assistant';
  workedFor: string;
  activitySummary: string;
  toolCalls: ToolCall[];
  markdown: string;
  timestamp: string;
}

export type Message = UserMessage | AssistantMessage;

export interface ThreadSummary {
  id: string;
  title: string;
  muted?: boolean;
}

export interface ProjectEntry {
  id: string;
  name: string;
  remoteUrl?: string;
  active?: boolean;
  threads: ThreadSummary[];
}

export type NavKey =
  | 'new-chat'
  | 'pull-requests'
  | 'scheduled'
  | 'plugins'
  | 'explore';

export interface NavItem {
  key: NavKey;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'new-chat', label: 'New chat' },
  { key: 'pull-requests', label: 'Pull requests' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'plugins', label: 'Plugins' },
  { key: 'explore', label: 'Explore' },
];

export const PROJECTS: ProjectEntry[] = [
  {
    id: 'workx',
    name: 'workx',
    remoteUrl: 'https://github.com/RonanXiao/workx',
    active: true,
    threads: [
      { id: 'ipatool', title: '解决 ipatool 双重认证登录' },
      { id: 'spicetify', title: '我通过官网的curl命令安装的spicet...' },
    ],
  },
  { id: 'leetcode', name: 'leetcode', threads: [] },
  { id: 'sglang', name: 'sglang', threads: [] },
  { id: 'airdlna', name: 'airdlna', threads: [] },
  { id: 'local-llm-test', name: 'local-llm-test', threads: [] },
];

export const RECENTS: ThreadSummary[] = [
  { id: 'apple-chips', title: '了解苹果芯片训练大模型能力' },
  { id: 'imagefree', title: '查找 imagefree 模型', muted: true },
];

export const CONVERSATION: Message[] = [
  { id: 'm1', role: 'user', text: 'Codex app用的什么前端技术？' },
  {
    id: 'm2',
    role: 'assistant',
    workedFor: '1m 8s',
    activitySummary: 'Loaded a tool, read files, ran commands, searched the web',
    toolCalls: [
      { id: 't1', icon: 'wrench', label: 'Read OpenAI Docs skill' },
      { id: 't2', icon: 'globe', label: 'Searched the web for Codex app Electron React' },
      { id: 't3', icon: 'folder', label: 'Listed files in Frameworks' },
      { id: 't4', icon: 'folder', label: 'Listed files in Resources' },
      {
        id: 't5',
        icon: 'terminal',
        label: 'Ran mdfind \'kMDItemFSName == "*Codex*.app"c\' | head -12',
      },
      {
        id: 't6',
        icon: 'globe',
        label: 'Searched the web for https://developers.openai.com/codex/app',
      },
      {
        id: 't7',
        icon: 'terminal',
        label: "Ran ps -axo comm | rg -i 'codex|electron' | head -15; ls /Applications | head -20",
      },
      { id: 't8', icon: 'folder', label: 'Listed files in Resources' },
      { id: 't9', icon: 'folder', label: 'Listed files in Resources', dimmed: true },
    ],
    timestamp: '9:11 PM',
    markdown: [
      'Codex 桌面 App 用的是 **Electron + React + TypeScript**。',
      '',
      '我直接检查了你本机应用包，确认：',
      '',
      '| 层次 | 技术 |',
      '| --- | --- |',
      '| 桌面容器 | Electron 42.3 |',
      '| 界面框架 | React 19.2 |',
      '| 开发语言 | TypeScript |',
      '| 样式 | 包内包含 Tailwind CSS 4 |',
      '| 构建、打包 | Vite + Electron Forge |',
      '',
      '也就是用 Web 技术构建界面，通过 Electron 提供桌面窗口和系统能力。上述信息来自本机安装包的依赖清单和编译产物。',
    ].join('\n'),
  },
];

export interface PermissionMode {
  id: string;
  label: string;
  description: string;
  warning?: boolean;
}

export const PERMISSION_MODES: PermissionMode[] = [
  {
    id: 'read-only',
    label: 'Read only',
    description: 'Workx can read files but cannot make changes.',
  },
  {
    id: 'auto',
    label: 'Auto',
    description: 'Workx can read and edit files in the workspace.',
  },
  {
    id: 'workspace-write',
    label: 'Workspace write',
    description: 'Workx can edit files inside the workspace and run commands.',
  },
  {
    id: 'full-access',
    label: 'Full access',
    description:
      'Workx can run commands and edit files anywhere on your computer without asking.',
    warning: true,
  },
];

export interface ModelOption {
  id: string;
  label: string;
  description: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'deepseek-v4.1-flash-expires-on-0910',
    label: 'DeepSeek V4.1 Flash',
    description: 'Fast default model configured for this Workx install.',
  },
  {
    id: 'deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    description: 'Higher quality, slower responses.',
  },
];

export const REASONING_EFFORTS = ['Default', 'Low', 'Medium', 'High'] as const;
