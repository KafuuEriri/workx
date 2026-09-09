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

import type { MessageKey } from '../lib/i18n';

export interface ComposerMenuBinding {
  type: 'skill' | 'mention';
  name: string;
  path: string;
}

export interface ComposerCommand {
  id: string;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  icon: LucideIcon;
  acceptsArgs?: boolean;
}

export const COMPOSER_COMMANDS: ComposerCommand[] = [
  { id: 'new', titleKey: 'command.new.title', descriptionKey: 'command.new.description', icon: SquarePen },
  { id: 'model', titleKey: 'command.model.title', descriptionKey: 'command.model.description', icon: Cpu },
  {
    id: 'provider',
    titleKey: 'command.provider.title',
    descriptionKey: 'command.provider.description',
    icon: Server,
  },
  {
    id: 'permissions',
    titleKey: 'command.permissions.title',
    descriptionKey: 'command.permissions.description',
    icon: ShieldAlert,
  },
  {
    id: 'compact',
    titleKey: 'command.compact.title',
    descriptionKey: 'command.compact.description',
    icon: Shrink,
  },
  { id: 'review', titleKey: 'command.review.title', descriptionKey: 'command.review.description', icon: Eye },
  { id: 'init', titleKey: 'command.init.title', descriptionKey: 'command.init.description', icon: FileText },
  {
    id: 'rename',
    titleKey: 'command.rename.title',
    descriptionKey: 'command.rename.description',
    icon: Pencil,
    acceptsArgs: true,
  },
  {
    id: 'archive',
    titleKey: 'command.archive.title',
    descriptionKey: 'command.archive.description',
    icon: Archive,
  },
  {
    id: 'delete',
    titleKey: 'command.delete.title',
    descriptionKey: 'command.delete.description',
    icon: Trash2,
  },
  { id: 'skills', titleKey: 'command.skills.title', descriptionKey: 'command.skills.description', icon: Sparkles },
  { id: 'plugins', titleKey: 'command.plugins.title', descriptionKey: 'command.plugins.description', icon: Puzzle },
  { id: 'mcp', titleKey: 'command.mcp.title', descriptionKey: 'command.mcp.description', icon: Plug },
  { id: 'resume', titleKey: 'command.resume.title', descriptionKey: 'command.resume.description', icon: History },
  { id: 'clear', titleKey: 'command.clear.title', descriptionKey: 'command.clear.description', icon: Eraser },
];

export const INIT_AGENTS_PROMPT = [
  'Generate a file named AGENTS.md that serves as a contributor guide for this repository.',
  'Before writing, check whether AGENTS.md already exists in the current working directory.',
  'If it does, do not overwrite or modify it.',
  'Keep the document concise (200-400 words) with descriptive Markdown headings.',
  'Cover project structure, build/test/run commands, coding style, testing guidelines, and commit/PR conventions.',
].join(' ');
