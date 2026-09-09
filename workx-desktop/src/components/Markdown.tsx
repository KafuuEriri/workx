import { Check, Copy } from 'lucide-react';
import { isValidElement, useState, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '../lib/cn';
import { useI18n } from '../lib/i18n';

function extractText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join('');
  }
  if (isValidElement(node)) {
    return extractText((node.props as { children?: ReactNode }).children);
  }
  return '';
}

function CodeBlock({ language, code }: { language?: string; code: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-line-subtle bg-code">
      <div className="flex h-8 items-center border-b border-line-subtle px-3 text-[12px] text-fg-tertiary">
        <span>{language ?? 'text'}</span>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? t('common.copied') : t('common.copyCode')}
          className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-hover"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-[1.6]">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

const components: Components = {
  p({ children }) {
    return <p className="my-3 text-[16px] leading-[1.625]">{children}</p>;
  },
  strong({ children }) {
    return <strong className="font-semibold">{children}</strong>;
  },
  h1({ children }) {
    return <h1 className="mb-3 mt-6 text-[22px] font-semibold leading-tight">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="mb-2 mt-5 text-[18px] font-semibold leading-tight">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="mb-2 mt-4 text-[16px] font-semibold leading-tight">{children}</h3>;
  },
  ul({ children }) {
    return <ul className="my-3 list-disc space-y-1.5 pl-5">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="my-3 list-decimal space-y-1.5 pl-5">{children}</ol>;
  },
  li({ children }) {
    return <li className="text-[16px] leading-[1.625]">{children}</li>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="my-3 border-l-2 border-line-strong pl-4 text-fg-secondary">
        {children}
      </blockquote>
    );
  },
  hr() {
    return <hr className="my-5 border-0 border-t border-line-subtle" />;
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        onClick={(event) => {
          event.preventDefault();
          if (href) {
            void window.workx?.openExternal(href);
          }
        }}
        className="text-info underline underline-offset-2"
      >
        {children}
      </a>
    );
  },
  pre({ children }) {
    const first = Array.isArray(children) ? children[0] : children;
    const className = isValidElement(first)
      ? (first.props as { className?: string }).className
      : undefined;
    const language = /language-([\w-]+)/.exec(className ?? '')?.[1];
    return <CodeBlock language={language} code={extractText(first).replace(/\n$/, '')} />;
  },
  code({ children }) {
    return (
      <code className="rounded-[5px] bg-hover px-1.5 py-0.5 font-mono text-[0.875em]">
        {children}
      </code>
    );
  },
  table({ children }) {
    return (
      <div className="my-4 w-full overflow-x-auto">
        <table className="w-full border-collapse text-[15px]">{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return <thead>{children}</thead>;
  },
  tbody({ children }) {
    return <tbody>{children}</tbody>;
  },
  tr({ children }) {
    return <tr className="border-b border-line-subtle last:border-0">{children}</tr>;
  },
  th({ children, style }) {
    return (
      <th
        style={style}
        className={cn(
          'border-b border-line py-2 pr-4 text-left align-top font-medium first:w-[40%]',
        )}
      >
        {children}
      </th>
    );
  },
  td({ children, style }) {
    return (
      <td style={style} className="py-2 pr-4 align-top first:w-[40%]">
        {children}
      </td>
    );
  },
};

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
