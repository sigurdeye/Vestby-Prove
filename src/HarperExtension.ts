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
}

export const harperKey = new PluginKey('harper');

export const HarperExtension = Extension.create<HarperOptions>({
  name: 'harper',

  addOptions() {
    return {
      onResults: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { onResults } = this.options;
    let worker: Worker | null = null;
    let lastText = '';
    let version = 0;

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
          worker = new Worker(new URL('./harper.worker.ts', import.meta.url), {
            type: 'module',
          });

          let debounceTimeout: any = null;

          worker.onmessage = (e) => {
            const { type, results, error, version: resultVersion } = e.data;
            
            // Only process results if they match the current document version
            if (resultVersion !== version) {
              return;
            }

            if (type === 'error') {
              console.error('Harper Worker Error:', error);
              return;
            }
            if (type === 'results') {
              if (onResults) {
                onResults(results);
              }
            }
          };

          return {
            update(view, prevState) {
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
              worker?.terminate();
            },
          };
        },
      }),
    ];
  },
});
