# Harper Mod Manifest (v1.5.1-modded)

This document describes the custom modifications made to the Harper grammar engine to make it more dyslexia-friendly and supportive of non-native speakers. These changes were built into the vendored binaries located in `src/vendor/harper/`.

## 🛠 Modifications

### 1. Phonetic Scoring Boost
- **Location**: `harper-core/src/spell/mod.rs` and `phonetic.rs`
- **Logic**: Added a phonetic scoring layer that compares the phonetic code (Soundex-like) of the misspelled word with candidates.
- **Boost**: Matching phonetic codes receive a **-25 point boost** (lower is better), allowing words like "verk" to rank "work" highly despite an edit distance of 2.

### 2. Increased Candidate Limit
- **Location**: `harper-core/src/linting/spell_check.rs`
- **Change**: `const MAX_SUGGESTIONS: usize = 3;` → **`8`**
- **Reason**: The stock limit of 3 was too restrictive. If there were 3 or more words with an edit distance of 1 (e.g., "verb", "vert", "very"), the distance-2 phonetic match ("work") would be truncated before it could be ranked. Increasing this to 8 ensures phonetic matches make it into the candidate pool.

### 3. Build & Integration Patches
- **WASM Patch**: In the generated `pkg/harper_wasm.js`, the initialization was modified:
  - From: `module_or_path = new URL('harper_wasm_bg.wasm', import.meta.url);`
  - To: `module_or_path = new URL();`
  - **Reason**: This allows Vite/bundlers to handle the WASM binary path dynamically rather than relying on a hardcoded relative path which breaks in some production builds.
- **Dialect**: Defaulted to `British` in the worker for broader matching patterns.

## 🚀 How to Recreate
1. Clone the official [Harper repository](https://github.com/elijah-potter/harper).
2. Apply the logic changes described above to the Rust source code.
3. Run `wasm-pack build --target web` in `harper-wasm/`.
4. Apply the `new URL()` patch to the generated JS file.
5. Run `pnpm build` in `packages/harper.js/`.
6. Copy `dist/` contents to `src/vendor/harper/` in this project.
