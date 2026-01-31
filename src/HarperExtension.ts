/**
 * This file is part of Vestby Prøve.
 * It integrates Harper (https://github.com/elijah-potter/harper), 
 * which is licensed under the Apache License 2.0.
 */

import { Extension } from '@tiptap/core';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface HarperLintResult {
  message: string;
  span: {
    start: number;
    end: number;
  };
  suggestions: string[];
  category: string;
}

export interface HarperOptions {
  onResults?: (results: HarperLintResult[]) => void;
  onStatusChange?: (status: 'loading' | 'ready' | 'error') => void;
}

export const harperKey = new PluginKey('harper');

export const HarperExtension = Extension.create<HarperOptions>({
  name: 'harper',

  addOptions() {
    return {
      onResults: undefined,
      onStatusChange: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { onResults, onStatusChange } = this.options;
    let worker: Worker | null = null;
    let lastText = '';
    let version = 0;
    let isReady = false;

    return [
      new Plugin({
        key: harperKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, oldState) {
            const meta = tr.getMeta(harperKey);
            if (meta && meta.type === 'set-decorations') {
              return meta.decorations;
            }
            return oldState.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
        view(editorView) {
          let debounceTimeout: any = null;
          let initTimeout: any = null;

          const initWorker = () => {
            if (worker) return;
            console.log("Lazy loading Harper worker...");
            worker = new Worker(new URL('./harper.worker.ts', import.meta.url), {
              type: 'module',
            });
            if (onStatusChange) onStatusChange('loading');

            worker.onmessage = (e) => {
              const { type, results, error, version: resultVersion } = e.data;
              
              if (type === 'ready') {
                console.log("Harper worker ready.");
                isReady = true;
                if (onStatusChange) onStatusChange('ready');
                // Trigger initial lint once ready
                const text = editorView.state.doc.textContent;
                worker?.postMessage({ type: 'lint', text, version });
                return;
              }

              if (type === 'error') {
                console.error('Harper Worker Error:', error);
                if (onStatusChange) onStatusChange('error');
                return;
              }

              // Only process results if they match the current document version
              if (resultVersion !== version) {
                return;
              }

              if (type === 'results') {
                if (onResults) {
                  onResults(results);
                }
              }
            };

            // Explicitly trigger initialization
            worker.postMessage({ type: 'init' });
          };

          // Set a 3-second delay before starting the worker
          initTimeout = setTimeout(initWorker, 3000);

          return {
            update(view, prevState) {
              if (!worker || !isReady) return;

              const { state } = view;
              const text = state.doc.textContent;

              if (text !== lastText) {
                lastText = text;
                version++;
                const currentVersion = version;
                
                if (debounceTimeout) clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(() => {
                  worker?.postMessage({ type: 'lint', text, version: currentVersion });
                }, 500);
              }
            },
            destroy() {
              if (debounceTimeout) clearTimeout(debounceTimeout);
              if (initTimeout) clearTimeout(initTimeout);
              worker?.postMessage({ type: 'dispose' });
              // Give the worker a moment to dispose before terminating
              setTimeout(() => worker?.terminate(), 100);
            },
          };
        },
      }),
    ];
  },
});
