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
  // `lintedText` is the exact plain-text snapshot Harper processed to produce
  // these results. Callers use it to detect staleness: if the editor's current
  // text doesn't match, lint-result-derived decorations would be mispositioned
  // and should be suppressed until the next lint run catches up.
  onResults?: (results: HarperLintResult[], lintedText: string) => void;
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
                if (isReady) return; // Prevent multiple ready logs/triggers
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
                  // `lastText` is the snapshot that was posted to the worker
                  // for this version; the version check above guarantees it
                  // is still the text these results describe.
                  onResults(results, lastText);
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
              if (worker) {
                worker.postMessage({ type: 'dispose' });
                // Give the worker a moment to dispose before terminating
                const w = worker;
                setTimeout(() => w.terminate(), 100);
                worker = null;
              }
            },
          };
        },
      }),
    ];
  },
});
