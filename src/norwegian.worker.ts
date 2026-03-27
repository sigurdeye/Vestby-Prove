/**
 * Norwegian spellchecker worker using Typo.js with Hunspell dictionaries.
 * Mirrors the Harper worker interface for compatibility with the existing UI.
 */

import Typo from 'typo-js';
import bokmaalToNynorsk from './bokmaalToNynorsk';

let typo: Typo | null = null;
let isInitializing = false;
let dictionaryLoaded = false;
let dialect: 'nb_NO' | 'nn_NO' = 'nb_NO';

async function init() {
    if (isInitializing) return;
    if (dictionaryLoaded && typo) return;

    isInitializing = true;
    try {
        const langCode = dialect === 'nn_NO' ? 'nn' : 'nb';
        const langLabel = dialect === 'nn_NO' ? 'Nynorsk' : 'Bokmål';
        console.log(`Loading Norwegian (${langLabel}) dictionary...`);

        // Fetch dictionary files from public directory
        const [affResponse, dicResponse] = await Promise.all([
            fetch(`/dictionaries/${langCode}.aff`),
            fetch(`/dictionaries/${langCode}.dic`)
        ]);

        if (!affResponse.ok || !dicResponse.ok) {
            throw new Error('Failed to fetch dictionary files');
        }

        const affData = await affResponse.text();
        const dicData = await dicResponse.text();

        console.log("Dictionary files fetched. DIC size:", dicData.length, "AFF size:", affData.length);
        console.log("DIC start:", dicData.substring(0, 100));

        // Create Typo instance
        typo = new Typo(dialect, affData, dicData);

        // Test a known Norwegian word
        const testWord = "dette";
        const testResult = typo.check(testWord);
        console.log(`Self-test word "${testWord}": ${testResult ? 'OK' : 'FAILED'}`);
        if (!testResult) {
            console.log(`Suggestions for "${testWord}":`, typo.suggest(testWord));
        }

        dictionaryLoaded = true;
        console.log("Norwegian dictionary initialized successfully.");
        self.postMessage({ type: 'ready' });
    } catch (e) {
        console.error("Failed to initialize Norwegian spellchecker:", e);
        self.postMessage({ type: 'error', error: String(e) });
    } finally {
        isInitializing = false;
    }
}

interface LintResult {
    message: string;
    span: { start: number; end: number };
    suggestions: string[];
    category: string;
}

function lintText(text: string): LintResult[] {
    if (!typo || !text.trim()) return [];

    const results: LintResult[] = [];

    // Match words (including Norwegian characters æøå)
    const wordRegex = /[\p{L}\p{M}]+/gu;
    let match;

    while ((match = wordRegex.exec(text)) !== null) {
        const word = match[0];
        const start = match.index;
        const end = start + word.length;

        // Skip very short words (1-2 chars) and numbers
        if (word.length < 2) continue;

        // Check if word is spelled correctly
        if (!typo.check(word)) {
            // Get suggestions
            let suggestions = typo.suggest(word, 5) || [];

            // Add high-frequency Bokmål to Nynorsk suggestions if applicable
            const lowerWord = word.toLowerCase();
            if (bokmaalToNynorsk[lowerWord]) {
                const preferred = bokmaalToNynorsk[lowerWord];
                suggestions = [preferred, ...suggestions.filter(s => s !== preferred)];
            }

            // Ensure suggestions have the same casing as the original world
            suggestions = suggestions.map(s => {
                if (word[0] === word[0].toUpperCase()) {
                    return s.charAt(0).toUpperCase() + s.slice(1);
                } else {
                    return s.toLowerCase();
                }
            });

            results.push({
                message: `"${word}" kan være feilstavet.`,
                span: { start, end },
                suggestions,
                category: 'Spelling'
            });
        }
    }

    return results;
}

self.onmessage = async (e: MessageEvent) => {
    const { text, type, version } = e.data;

    if (type === 'dispose') {
        typo = null;
        dictionaryLoaded = false;
        return;
    }

    if (type === 'init') {
        if (e.data.dialect) dialect = e.data.dialect;
        await init();
        return;
    }

    if (type === 'lint') {
        await init();
        if (typo && dictionaryLoaded) {
            try {
                const results = lintText(text);
                self.postMessage({ type: 'results', results, version });
            } catch (error) {
                console.error('Norwegian lint error:', error);
                self.postMessage({ type: 'error', error: String(error), version });
            }
        } else {
            console.warn("Norwegian dictionary not initialized yet.");
        }
    }
};
