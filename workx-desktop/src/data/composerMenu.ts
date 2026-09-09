import {
  Activity,
  AlignLeft,
  AppWindow,
  Archive,
  AtSign,
  BarChart3,
  Brain,
  Bug,
  CheckCircle2,
  Code,
  Copy,
  Cpu,
  Download,
  Eraser,
  Eye,
  FileText,
  FlaskConical,
  FolderInput,
  FolderOpen,
  GitBranch,
  GitCompare,
  Heading,
  History,
  Keyboard,
  LayoutGrid,
  List,
  ListChecks,
  LogOut,
  MessageCircle,
  MessageSquare,
  Package,
  Palette,
  Pencil,
  Plug,
  Puzzle,
  ScrollText,
  Server,
  Share,
  Shield,
  ShieldAlert,
  Shrink,
  Smile,
  Sparkles,
  Square,
  SquarePen,
  Target,
  Terminal,
  Trash2,
  Users,
  Webhook,
  type LucideIcon,
} from 'lucide-react';

import type { Language } from '../lib/i18n';

export interface ComposerMenuBinding {
  type: 'skill' | 'mention';
  name: string;
  path: string;
}

/** Wire shape returned by the app-server `slashCommands/list` method. */
export interface SlashCommandInfo {
  name: string;
  aliases: string[];
  description: string;
  supportsInlineArgs: boolean;
  availableDuringTask: boolean;
}

const COMMAND_ICONS: Record<string, LucideIcon> = {
  model: Cpu,
  provider: Server,
  ide: Code,
  permissions: ShieldAlert,
  keymap: Keyboard,
  vim: Keyboard,
  'setup-default-sandbox': Shield,
  experimental: FlaskConical,
  approve: CheckCircle2,
  memories: Brain,
  skills: Sparkles,
  import: Download,
  hooks: Webhook,
  review: Eye,
  rename: Pencil,
  new: SquarePen,
  archive: Archive,
  delete: Trash2,
  resume: History,
  fork: GitBranch,
  app: AppWindow,
  init: FileText,
  compact: Shrink,
  recap: ScrollText,
  plan: ListChecks,
  goal: Target,
  agents: Users,
  side: MessageCircle,
  btw: MessageCircle,
  copy: Copy,
  export: Share,
  raw: Terminal,
  diff: GitCompare,
  mention: AtSign,
  status: Activity,
  cd: FolderInput,
  pwd: FolderOpen,
  usage: BarChart3,
  'debug-config': Bug,
  title: Heading,
  statusline: AlignLeft,
  theme: Palette,
  pets: Smile,
  mcp: Plug,
  apps: LayoutGrid,
  plugins: Puzzle,
  logout: LogOut,
  quit: LogOut,
  exit: LogOut,
  feedback: MessageSquare,
  ps: List,
  stop: Square,
  clear: Eraser,
  personality: Smile,
  subagents: Users,
  codex: Package,
};

interface CommandText {
  title: string;
  description: string;
}

const EN_COMMAND_TITLES: Record<string, string> = {
  mcp: 'MCP',
  ide: 'IDE',
  pwd: 'PWD',
  cd: 'CD',
  vim: 'Vim',
  approve: 'Approve retry',
  new: 'New chat',
  app: 'Desktop app',
  raw: 'Raw scrollback',
  statusline: 'Status line',
  'debug-config': 'Debug config',
  'setup-default-sandbox': 'Setup default sandbox',
  subagents: 'Subagents',
  ps: 'Background terminals',
  codex: 'Import from Codex',
};

const ZH_COMMANDS: Record<string, CommandText> = {
  model: { title: '模型', description: '选择使用的模型和推理强度' },
  provider: { title: '提供方', description: '添加、编辑或切换模型提供方' },
  ide: { title: 'IDE', description: '包含来自 IDE 的当前选中内容、打开的文件和其他上下文' },
  permissions: { title: '权限', description: '选择 Workx 可以做什么' },
  keymap: { title: '快捷键', description: '重新映射 TUI 快捷键' },
  vim: { title: 'Vim 模式', description: '切换输入框的 Vim 模式' },
  'setup-default-sandbox': { title: '沙箱设置', description: '设置提权的 agent 沙箱' },
  experimental: { title: '实验性功能', description: '切换实验性功能' },
  approve: { title: '批准重试', description: '批准一次最近被自动审查拒绝的操作重试' },
  memories: { title: '记忆', description: '配置记忆的使用和生成' },
  skills: { title: '技能', description: '使用技能来提升 Workx 完成特定任务的效果' },
  import: { title: '导入', description: '从 Claude Code 导入设置、当前项目和最近的对话' },
  hooks: { title: '钩子', description: '查看和管理生命周期钩子' },
  review: { title: '审查', description: '审查当前改动并找出问题' },
  rename: { title: '重命名', description: '重命名当前对话' },
  new: { title: '新对话', description: '在对话过程中开始一个新对话' },
  archive: { title: '归档', description: '归档此会话并退出' },
  delete: { title: '删除', description: '永久删除此会话并退出' },
  resume: { title: '恢复', description: '恢复已保存的对话' },
  fork: { title: '分支', description: '复制当前对话' },
  app: { title: '桌面应用', description: '在桌面应用中继续此会话' },
  init: { title: '初始化', description: '创建带有 Workx 指令的 AGENTS.md 文件' },
  compact: { title: '压缩', description: '压缩对话以避免触及上下文上限' },
  recap: { title: '回顾', description: '立即总结当前对话' },
  plan: { title: '计划模式', description: '切换到计划模式' },
  goal: { title: '目标', description: '设置或查看长任务的目标' },
  agents: { title: '会话', description: '查看并切换所有活跃的 agent 会话' },
  side: { title: '侧边对话', description: '在临时分支中开始侧边对话' },
  btw: { title: '侧边对话', description: '在临时分支中开始侧边对话' },
  copy: { title: '复制', description: '复制上一条回复、代码块或引用' },
  export: { title: '导出', description: '将对话导出为 Markdown' },
  raw: { title: '原始模式', description: '切换原始回滚模式，便于在终端中选择复制' },
  diff: { title: '差异', description: '显示 git diff（包括未跟踪文件）' },
  mention: { title: '提及', description: '提及一个文件' },
  status: { title: '状态', description: '显示当前会话配置和 token 用量' },
  cd: { title: '切换目录', description: '更改当前工作目录' },
  pwd: { title: '当前目录', description: '显示当前工作目录' },
  usage: { title: '用量', description: '查看账户用量或使用用量限制重置' },
  'debug-config': { title: '调试配置', description: '显示配置层级和来源，便于调试' },
  title: { title: '标题', description: '配置终端标题中显示的项目' },
  statusline: { title: '状态栏', description: '配置状态栏中显示的项目' },
  theme: { title: '主题', description: '选择语法高亮主题' },
  pets: { title: '宠物', description: '选择或隐藏终端宠物' },
  mcp: { title: 'MCP', description: '列出已配置的 MCP 工具；使用 /mcp verbose 查看详情' },
  apps: { title: '应用', description: '管理应用' },
  plugins: { title: '插件', description: '浏览插件' },
  logout: { title: '退出登录', description: '退出 Workx 登录' },
  quit: { title: '退出', description: '退出 Workx' },
  exit: { title: '退出', description: '退出 Workx' },
  feedback: { title: '反馈', description: '向维护者发送日志' },
  ps: { title: '后台终端', description: '列出后台终端' },
  stop: { title: '停止', description: '停止所有后台终端' },
  clear: { title: '清空', description: '清空终端并开始新对话' },
  personality: { title: '个性', description: '选择 Workx 的沟通风格' },
  subagents: { title: '子 agent', description: '在此会话的子 agent 之间切换' },
  codex: { title: '从 Codex 导入', description: '复制 Codex 的对话并在此恢复' },
};

function humanizeCommandName(name: string): string {
  return name
    .split(/[-_]/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

export function commandTitle(command: SlashCommandInfo, language: Language): string {
  if (language === 'zh') {
    return ZH_COMMANDS[command.name]?.title ?? humanizeCommandName(command.name);
  }
  return EN_COMMAND_TITLES[command.name] ?? humanizeCommandName(command.name);
}

export function commandDescription(command: SlashCommandInfo, language: Language): string {
  if (language === 'zh') {
    return ZH_COMMANDS[command.name]?.description ?? command.description;
  }
  return command.description;
}

export function commandIcon(name: string): LucideIcon {
  return COMMAND_ICONS[name] ?? Terminal;
}

/**
 * Match the TUI popup: hide debug-only commands, `apps`, and the alias entries
 * `quit` (alias of `exit`) and `btw` (alias of `side`).
 */
export function isVisibleInComposerMenu(command: SlashCommandInfo): boolean {
  if (command.name.startsWith('debug')) {
    return false;
  }
  return !['apps', 'quit', 'btw'].includes(command.name);
}

export function findCommand(
  commands: SlashCommandInfo[],
  name: string,
): SlashCommandInfo | undefined {
  const normalized = name.toLowerCase();
  return commands.find(
    (command) => command.name === normalized || command.aliases.includes(normalized),
  );
}

export const INIT_AGENTS_PROMPT = [
  'Generate a file named AGENTS.md that serves as a contributor guide for this repository.',
  'Before writing, check whether AGENTS.md already exists in the current working directory.',
  'If it does, do not overwrite or modify it.',
  'Keep the document concise (200-400 words) with descriptive Markdown headings.',
  'Cover project structure, build/test/run commands, coding style, testing guidelines, and commit/PR conventions.',
].join(' ');
