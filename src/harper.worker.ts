import * as harper from "harper.js";

let linter: harper.LocalLinter | null = null;

async function init() {
  if (!linter) {
    try {
      console.log("Initializing Harper LocalLinter with explicit binary...");
      // Explicitly pass the binary and dialect to the constructor
      linter = new harper.LocalLinter({
        binary: harper.binary,
        dialect: harper.Dialect.British, // Trying British as it sometimes has broader matching
      });
      await linter.setup();
      console.log("Harper LocalLinter initialized successfully.");
    } catch (e) {
      console.error("Failed to initialize Harper:", e);
    }
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { text, type } = e.data;

  if (type === 'lint') {
    await init();
    if (linter) {
      try {
        console.log("Linting text:", text);
        if (!text || text.trim().length === 0) {
          self.postMessage({ type: 'results', results: [] });
          return;
        }
        
        const lints = await linter.lint(text);
        console.log("Raw lints from Harper:", lints);
        
        // Map Harper's internal lint objects to a serializable format
        const serializableResults = lints.map(lint => {
          const suggestions = lint.suggestions();
          const kind = lint.lint_kind();
          
          // Extract all suggestions as plain strings
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
        });

        console.log("Sending serializable results:", serializableResults);
        self.postMessage({ type: 'results', results: serializableResults });
      } catch (error) {
        console.error('Harper lint error:', error);
        self.postMessage({ type: 'error', error: String(error) });
      }
    } else {
      console.warn("Linter not initialized yet.");
    }
  }
};
