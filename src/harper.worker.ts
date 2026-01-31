/**
 * This file is part of Vestby PrÃ¸ve.
 * It utilizes harper.js (https://github.com/elijah-potter/harper), 
 * which is licensed under the Apache License 2.0.
 */

import * as harper from "harper.js";

let americanLinter: harper.LocalLinter | null = null;
let britishLinter: harper.LocalLinter | null = null;
let isInitializing = false;

async function init() {
  if (isInitializing) return;
  if (americanLinter && britishLinter) return;
  
  isInitializing = true;
  try {
    if (!americanLinter) {
      console.log("Initializing Harper American Linter...");
      americanLinter = new harper.LocalLinter({
        binary: harper.binary,
        dialect: harper.Dialect.American,
      });
      await americanLinter.setup();
    }
    if (!britishLinter) {
      console.log("Initializing Harper British Linter...");
      britishLinter = new harper.LocalLinter({
        binary: harper.binary,
        dialect: harper.Dialect.British,
      });
      await britishLinter.setup();
    }
    
    if (americanLinter && britishLinter) {
      self.postMessage({ type: 'ready' });
    }
  } catch (e) {
    console.error("Failed to initialize Harper:", e);
    self.postMessage({ type: 'error', error: String(e) });
  } finally {
    isInitializing = false;
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { text, type, version } = e.data;

  if (type === 'dispose') {
    [americanLinter, britishLinter].forEach(l => {
      if (l) {
        try {
          // @ts-ignore
          if (typeof l.dispose === 'function') l.dispose();
        } catch (e) {
          console.error("Failed to dispose Harper:", e);
        }
      }
    });
    americanLinter = null;
    britishLinter = null;
    return;
  }

  if (type === 'init') {
    await init();
    return;
  }

  if (type === 'lint') {
    await init();
    if (americanLinter && britishLinter) {
      try {
        if (!text || text.trim().length === 0) {
          self.postMessage({ type: 'results', results: [], version });
          return;
        }
        
        const [americanLints, britishLints] = await Promise.all([
          americanLinter.lint(text),
          britishLinter.lint(text)
        ]);

        // We only want to report a spelling error if BOTH linters agree it's an error.
        // For other categories (Grammar, etc.), we can probably just take one or merge them.
        // Since the user specifically mentioned "colour" vs "color", we focus on Spelling.

        const formatLint = (lint: harper.Lint) => {
          const suggestions = lint.suggestions();
          const kind = lint.lint_kind();
          
          const allSuggestions = suggestions.map(s => {
            try {
              // @ts-ignore
              if (typeof s.get_replacement_text === 'function') {
                // @ts-ignore
                return String(s.get_replacement_text());
              }
              // @ts-ignore
              return s.text || s.replacement || String(s);
            } catch (e) {
              return String(s);
            }
          });

          return {
            message: String(lint.message()),
            span: {
              start: Number(lint.span().start),
              end: Number(lint.span().end)
            },
            suggestions: allSuggestions,
            category: String(kind)
          };
        };

        const americanFormatted = americanLints.map(formatLint);
        const britishFormatted = britishLints.map(formatLint);

        // Merge strategy:
        // 1. If a lint is in both, keep it (and merge suggestions).
        // 2. If a lint is only in one, and it's NOT a spelling error, keep it.
        // 3. If a lint is only in one, and it IS a spelling error, discard it (because the other dialect accepts it).

        const finalResults: any[] = [];
        
        // Helper to find a matching lint in another list
        const findMatch = (lint: any, list: any[]) => 
          list.find(l => l.span.start === lint.span.start && l.span.end === lint.span.end);

        // Process American lints
        americanFormatted.forEach(aLint => {
          const bMatch = findMatch(aLint, britishFormatted);
          if (bMatch) {
            // It's in both. Merge suggestions and keep.
            const mergedSuggestions = Array.from(new Set([...aLint.suggestions, ...bMatch.suggestions]));
            finalResults.push({
              ...aLint,
              suggestions: mergedSuggestions
            });
          } else {
            // Only in American. Keep if not spelling.
            if (aLint.category !== 'Spelling') {
              finalResults.push(aLint);
            }
          }
        });

        // Process British lints that weren't in American
        britishFormatted.forEach(bLint => {
          const aMatch = findMatch(bLint, americanFormatted);
          if (!aMatch) {
            // Only in British. Keep if not spelling.
            if (bLint.category !== 'Spelling') {
              finalResults.push(bLint);
            }
          }
        });

        self.postMessage({ type: 'results', results: finalResults, version });
      } catch (error) {
        console.error('Harper lint error:', error);
        self.postMessage({ type: 'error', error: String(error), version });
      }
    } else {
      console.warn("Linters not initialized yet.");
    }
  }
};








