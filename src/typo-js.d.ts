declare module 'typo-js' {
    export default class Typo {
        constructor(
            language: string,
            affData?: string | null,
            dicData?: string | null,
            options?: {
                dictionaryPath?: string;
                asyncLoad?: boolean;
                loadedCallback?: () => void;
            }
        );
        check(word: string): boolean;
        suggest(word: string, limit?: number): string[];
    }
}
