import {
  Archive,
  Cpu,
  Eraser,
  Eye,
  FileText,
  History,
  Pencil,
  Plug,
  Puzzle,
  Server,
  ShieldAlert,
  Shrink,
  Sparkles,
  SquarePen,
  Trash2,
  type LucideIcon,
} from 'lucide-react';

export interface ComposerMenuBinding {
  type: 'skill' | 'mention';
  name: string;
  path: string;
}

export interface ComposerCommand {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  acceptsArgs?: boolean;
}

export const COMPOSER_COMMANDS: ComposerCommand[] = [
  {
    id: 'new',
    title: 'New chat',
    description: 'Start a blank chat in the same workspace',
    icon: SquarePen,
  },
  {
    id: 'model',
    title: 'Model',
    description: 'Choose what model and reasoning effort to use',
    icon: Cpu,
  },
  {
    id: 'provider',
    title: 'Provider',
    description: 'Switch the model provider',
    icon: Server,
  },
  {
    id: 'permissions',
    title: 'Permissions',
    description: 'Choose what Workx is allowed to do',
    icon: ShieldAlert,
  },
  {
    id: 'compact',
    title: 'Compact',
    description: "Compact this chat's context",
    icon: Shrink,
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Review my current changes and find issues',
    icon: Eye,
  },
  {
    id: 'init',
    title: 'Init',
    description: 'Create an AGENTS.md file with instructions for Workx',
    icon: FileText,
  },
  {
    id: 'rename',
    title: 'Rename',
    description: 'Rename the current chat',
    icon: Pencil,
    acceptsArgs: true,
  },
  {
    id: 'archive',
    title: 'Archive',
    description: 'Archive the current chat',
    icon: Archive,
  },
  {
    id: 'delete',
    title: 'Delete',
    description: 'Permanently delete the current chat',
    icon: Trash2,
  },
  {
    id: 'skills',
    title: 'Skills',
    description: 'Browse skills',
    icon: Sparkles,
  },
  {
    id: 'plugins',
    title: 'Plugins',
    description: 'Browse plugins',
    icon: Puzzle,
  },
  {
    id: 'mcp',
    title: 'MCP',
    description: 'Show MCP server status',
    icon: Plug,
  },
  {
    id: 'resume',
    title: 'Resume',
    description: 'Search your saved chats',
    icon: History,
  },
  {
    id: 'clear',
    title: 'Clear',
    description: 'Clear the composer and start a new chat',
    icon: Eraser,
  },
];

export const INIT_AGENTS_PROMPT = [
  'Generate a file named AGENTS.md that serves as a contributor guide for this repository.',
  'Before writing, check whether AGENTS.md already exists in the current working directory.',
  'If it does, do not overwrite or modify it.',
  'Keep the document concise (200-400 words) with descriptive Markdown headings.',
  'Cover project structure, build/test/run commands, coding style, testing guidelines, and commit/PR conventions.',
].join(' ');
