import type { WorkxBridge } from '../preload';

declare global {
  interface Window {
    workx: WorkxBridge;
  }
}

export {};
