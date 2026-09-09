import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PERMISSION_MODES } from '../data/workspace';
import { I18nProvider } from '../lib/i18n';
import { Composer } from './Composer';

function setup() {
  const onSubmit = vi.fn();
  const onCommand = vi.fn();
  render(
    <I18nProvider>
      <Composer
        models={[]} selectedModelId={null} onModelChange={vi.fn()}
        providers={[]} providerId={null} providerBusy={false} onProviderChange={vi.fn()}
        permission={PERMISSION_MODES[0]} onPermissionChange={vi.fn()}
        skills={[]} plugins={[]} mcpServers={[]}
        searchFiles={vi.fn().mockResolvedValue([])} searchChats={vi.fn().mockResolvedValue([])}
        running={false} disabled={false} onSubmit={onSubmit}
        onCommand={onCommand} onInterrupt={vi.fn()}
      />
    </I18nProvider>,
  );
  const input = screen.getByRole('textbox') as HTMLTextAreaElement;
  return { input, onSubmit, onCommand };
}

describe('composer IME input', () => {
  it('keeps the confirmed Chinese text until a subsequent Enter sends it', async () => {
    const { input, onSubmit } = setup();
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '你好' } });
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input.value).toBe('你好');
    fireEvent.compositionEnd(input);
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('你好', []);
    expect(input.value).toBe('');
  });

  it.each([{ isComposing: true }, { keyCode: 229 }])(
    'honors native IME flags after compositionend: %j', (flags) => {
      const { input, onSubmit } = setup();
      fireEvent.change(input, { target: { value: '中文' } });
      fireEvent.compositionEnd(input);
      expect(fireEvent.keyDown(input, { key: 'Enter', ...flags })).toBe(true);
      expect(onSubmit).not.toHaveBeenCalled();
      expect(input.value).toBe('中文');
    },
  );

  it('leaves candidate navigation and confirmation to the IME with the command menu open', () => {
    const { input, onCommand, onSubmit } = setup();
    fireEvent.change(input, { target: { value: '/new' } });
    fireEvent.compositionStart(input);
    for (const key of ['ArrowDown', 'ArrowUp', 'Tab', 'Escape', 'Enter']) {
      expect(fireEvent.keyDown(input, { key })).toBe(true);
    }
    expect(onCommand).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input.value).toBe('/new');
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommand).toHaveBeenCalledExactlyOnceWith('new', '');
  });

  it('preserves Shift+Enter and allows the send button after composition', async () => {
    const { input, onSubmit } = setup();
    fireEvent.change(input, { target: { value: '中文\n下一行' } });
    expect(fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })).toBe(true);
    fireEvent.compositionStart(input);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send' })); });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('中文\n下一行', []);
  });

  it('keeps the draft on failure and prevents duplicate sends while initialization is pending', async () => {
    const { input, onSubmit } = setup();
    const pending = Promise.withResolvers<void>();
    onSubmit.mockReturnValueOnce(pending.promise);
    fireEvent.change(input, { target: { value: '保留草稿' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(input.outerHTML).toMatchSnapshot('pending message');
    await act(async () => { pending.reject(new Error('Initialization failed')); });
    expect(input.value).toBe('保留草稿');
    expect(input.readOnly).toBe(false);
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(input.value).toBe('');
  });
});
