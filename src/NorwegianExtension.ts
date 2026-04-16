/**
 * Norwegian spellchecker TipTap extension using Typo.js.
 * Mirrors HarperExtension interface for UI compatibility.
 */

import { Extension } from '@tiptap/core';
import { DecorationSet } from '@tiptap/pm/view';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface NorwegianLintResult {
    message: string;
    span: {
        start: number;
        end: number;
    };
    suggestions: string[];
    category: string;
}

export interface NorwegianOptions {
    // `lintedText` is the exact plain-text snapshot the worker processed to
    // produce these results. Callers use it to detect staleness: if the
    // editor's current text doesn't match, lint-result-derived decorations
    // would be mispositioned and should be suppressed until the next lint
    // run catches up.
    onResults?: (results: NorwegianLintResult[], lintedText: string) => void;
    onStatusChange?: (status: 'loading' | 'ready' | 'error') => void;
}

export const norwegianKey = new PluginKey('norwegian');

export const NorwegianExtension = Extension.create<NorwegianOptions>({
    name: 'norwegian',

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
                key: norwegianKey,
                state: {
                    init() {
                        return DecorationSet.empty;
                    },
                    apply(tr, oldState) {
                        const meta = tr.getMeta(norwegianKey);
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
                    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
                    let initTimeout: ReturnType<typeof setTimeout> | null = null;

                    const initWorker = () => {
                        if (worker) return;
                        console.log("Lazy loading Norwegian spellchecker worker...");
                        worker = new Worker(new URL('./norwegian.worker.ts', import.meta.url), {
                            type: 'module',
                        });
                        if (onStatusChange) onStatusChange('loading');

                        worker.onmessage = (e) => {
                            const { type, results, error, version: resultVersion } = e.data;

                            if (type === 'ready') {
                                if (isReady) return;
                                console.log("Norwegian spellchecker worker ready.");
                                isReady = true;
                                if (onStatusChange) onStatusChange('ready');
                                // Trigger initial lint once ready
                                const text = editorView.state.doc.textContent;
                                worker?.postMessage({ type: 'lint', text, version });
                                return;
                            }

                            if (type === 'error') {
                                console.error('Norwegian Worker Error:', error);
                                if (onStatusChange) onStatusChange('error');
                                return;
                            }

                            // Only process results if they match the current document version
                            if (resultVersion !== version) {
                                return;
                            }

                            if (type === 'results') {
                                if (onResults) {
                                    // `lastText` is the snapshot posted to the
                                    // worker for this version; the version
                                    // check above guarantees it still matches
                                    // the text these results describe.
                                    onResults(results, lastText);
                                }
                            }
                        };

                        // Explicitly trigger initialization
                        worker.postMessage({ type: 'init' });
                    };

                    // Start worker immediately (dictionary is lazy-loaded inside worker)
                    initTimeout = setTimeout(initWorker, 500);

                    return {
                        update(view) {
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
