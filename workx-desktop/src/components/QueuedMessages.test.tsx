// @vitest-environment jsdom
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider, LANGUAGE_STORAGE_KEY } from '../lib/i18n';
import { QueuedMessages } from './QueuedMessages';

let root: Root;
let host: HTMLDivElement;
let props: ComponentProps<typeof QueuedMessages>;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  props = {
    messages: [{ id: 'queued-one', text: 'hhh', images: [], input: [{ type: 'text', text: 'hhh', text_elements: [] }], asGoal: false }],
    disabled: false, queueing: true, onQueueingChange: vi.fn(), onRemove: vi.fn(), onEdit: vi.fn(),
    onSend: vi.fn(), onEditingChange: vi.fn(),
  };
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function renderQueue() {
  await act(async () => root.render(<I18nProvider><QueuedMessages {...props} /></I18nProvider>));
}

async function clickButton(label: string) {
  const button = [...host.querySelectorAll('button')].find((candidate) =>
    candidate.getAttribute('aria-label') === label || candidate.textContent === label);
  if (!button) {
    throw new Error(`missing button: ${label}`);
  }
  await act(async () => button.click());
}

it('renders a compact queue row and the three reference menu actions', async () => {
  await renderQueue();
  expect(host.innerHTML).toMatchSnapshot('queue row');
  await clickButton('More message options');
  expect(host.innerHTML).toMatchSnapshot('queue menu');
  await clickButton('Open in side chat');
  expect(props.onSend).toHaveBeenCalledWith('queued-one', 'side');
});

it('steers and deletes the selected message', async () => {
  await renderQueue();
  await clickButton('Steer');
  expect(props.onSend).toHaveBeenCalledWith('queued-one', 'current');
  await clickButton('Delete queued message');
  expect(props.onRemove).toHaveBeenCalledWith('queued-one');
});

it('holds an edited message until save and keeps its attachments', async () => {
  props.messages[0].images = ['/test.png'];
  await renderQueue();
  await clickButton('More message options');
  await clickButton('Edit message');
  expect(props.onEditingChange).toHaveBeenCalledWith('queued-one');
  const textarea = host.querySelector('textarea');
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  if (!textarea || !setValue) {
    throw new Error('missing textarea');
  }
  await act(async () => {
    setValue.call(textarea, 'edited');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await clickButton('Save');
  expect(props.onEdit).toHaveBeenCalledWith('queued-one', 'edited');
  expect(props.onEditingChange).toHaveBeenLastCalledWith(null);
});

it('changes the queueing preference without sending or deleting queued messages', async () => {
  await renderQueue();
  await clickButton('More message options');
  await clickButton('Turn off queueing');
  expect(props.onQueueingChange).toHaveBeenCalledWith(false);
  expect(props.onSend).not.toHaveBeenCalled();
  expect(props.onRemove).not.toHaveBeenCalled();
});

it('disables all row actions while a request is pending and hides an empty queue', async () => {
  props.disabled = true;
  await renderQueue();
  expect([...host.querySelectorAll('button')].every((button) => button.disabled)).toBe(true);
  props.messages = [];
  await renderQueue();
  expect(host.innerHTML).toBe('');
});
