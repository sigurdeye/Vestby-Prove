> [!WARNING]
> **This project is a Work in Progress.**
> It has not been thoroughly tested yet and may contain bugs that could lead to data loss. Use at your own risk.

[Norsk versjon (README.md)](README.md)

# Vestby prøve 📝

Vestby prøve is a minimalist, secure, and "dumb" writing tool designed specifically for use in schools during tests and exams. The tool is built to be easily whitelisted in **Safe Exam Browser (SEB)** and eliminates the risk of unauthorized collaboration.

## Why use Vestby prøve?

*   **No login:** Students do not need an Office 365 account or any other login.
*   **Secure against cheating:** No built-in sharing features or real-time co-authoring capabilities.
*   **GDPR-friendly:** No text or personal data you write here is sent to or stored on a server. Everything remains local in the student's browser.
*   **Crash protection:** Text is automatically saved to the browser's memory (localStorage) every second. If the PC runs out of power or SEB crashes, the text is still there when they reopen the page.
*   **Universal design:** Includes **OpenDyslexic** as the default font to help students with dyslexia.

## Features

*   Simple text processing (Bold, Italic, Underline, Headings).
*   Fixed line spacing of 1.5 (standard for school assignments).
*   Choice between OpenDyslexic, Arial, and Verdana.
*   Real-time word count.
*   Export to standard `.docx` format.

## User Interface and Language

The tool is designed specifically for Norwegian students, and the interface is therefore in Norwegian. A language selector is technically simple to implement but has been intentionally omitted to minimize "noise" and distractions in the user interface during exams. Support for additional languages may be considered later if there is a clear need.

## Technical Info & Privacy (GDPR)

This is a **Zero-Knowledge** application.

1.  **The Server (Firebase Hosting)** only delivers the code (HTML/JS/CSS) to the student's machine.
2.  **All text** written is processed and stored only in the student's own browser.
3.  **The export** to Word happens locally on the machine.
4.  No databases, no tracking, no third-party cookies.

## License & Third-Party Software

This project is open-source and licensed under the [MIT License](LICENSE).

We use the following third-party software:
*   [Harper](https://github.com/elijah-potter/harper) (Apache License 2.0) - Used for local spellcheck and grammar.

See [CREDITS.md](CREDITS.md) for full license terms for third-party components.

## Future Plans (TODO)

*   **Platform testing:** Verify that the tool and export work optimally on macOS (currently only tested on Windows).

---

[![Buy Me A Coffee](https://img.shields.io/badge/Feel%20free%20to%20support%20me-☕%20buymeacoffee.com-FFDD00?style=for-the-badge&logoColor=black)](https://www.buymeacoffee.com/sigurdeye)
