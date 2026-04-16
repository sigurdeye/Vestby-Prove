> [!WARNING]
> **Dette prosjektet er under utvikling (Work in Progress).**
> Det er ikke grundig testet ennå og kan inneholde feil som kan føre til tap av data. Bruk på eget ansvar.

[English version (README.en.md)](README.en.md) | [Spørsmål og svar](QA.md)

# Vestby prøve 📝

Vestby prøve er et minimalistisk, sikkert og "dumt" skriveverktøy designet spesifikt for bruk under prøver. Verktøyet er bygget for å være enkelt å hviteliste i **Safe Exam Browser (SEB)** og eliminerer risikoen for samarbeid.

![Vestby prøve - Skjermvisning](assets/Showcase1.jpg)

## Hvorfor bruke Vestby prøve?

*   **Ingen innlogging:**
*   **Sikkert mot juks:** Ingen innebygde delingsfunksjoner.
*   **GDPR-vennlig:** Ingen tekst eller personopplysninger du skriver her hverken sendes til eller lagres på en server.
*   **Krasjsikring:** Teksten lagres automatisk og kontinuerlig i nettleserens minne (localStorage). Hvis PC-en går tom for strøm eller SEB krasjer, er teksten der når de åpner siden igjen. For at dette skal funke i SEB krever det at SEB-konfigurasjonsfilen har begge instansene av "Clear browser session" slått av.
*   **Universell utforming:** Inkluderer **OpenDyslexic** som standard font for å hjelpe elever med dysleksi. Applikasjonen inneholder også så få distraherende elementer som mulig.

## Funksjoner

*   Enkel tekstbehandling (Fet, Kursiv, Understrek, Overskrifter)
*   Fast linjeavstand på 1.5 (standard for skoleoppgaver)
*   Valg mellom OpenDyslexic, Arial og Verdana
*   Ordtelling i sanntid
*   Eksport til standard docx-format
*   Innebygd stavekontroll for **norsk (bokmål)**, **norsk (nynorsk)** og **engelsk** (internasjonal)

## Teknisk info & Personvern (GDPR)

Dette er en **Zero-Knowledge** applikasjon. 

1.  **Serveren** man benytter seg av for å kjøre applikasjonen trenger kun å leverer koden (HTML/JS/CSS) til elevens maskin
2.  **All tekst** som skrives, behandles og lagres kun i elevens egen nettleser
3.  **Eksporten** til Word (.docx) skjer lokalt på maskinen
4.  Ingen databaser, ingen sporing, ingen informasjonskapsler (cookies) fra tredjeparter

## Lisens, tredjepartsprogramvare og kostnader

Dette prosjektet er åpen kildekode og lisensiert under [MIT-lisensen](LICENSE). Du kan derfor fritt klone prosjektet og hoste det selv. Den innebygde stavekontrollen krever at hver bruker laster ned omtrent 10 MB med data fra serveren din. Serveren din må derfor ha en datakvote som støtter dette. Github pages og Cloudflare er gode gratis alternativer. 

Vi benytter oss av følgende tredjepartsprogramvare:
*   [Harper](https://github.com/elijah-potter/harper) (Apache License 2.0) - Brukes til lokal stavekontroll og grammatikk.

Se [CREDITS.md](CREDITS.md) for fullstendige lisensvilkår for tredjepartskomponenter.

## Veien videre (TODO)

*   **Testing:** Teste applikasjonen grundig i Safe Exam Browser (SEB).
*   **Refaktorering:** Splitte opp `App.tsx` i mindre, mer håndterbare komponenter.
*   **Språklig presisjon:** Når man lagrer en docx-fil bør den si at filen ble lagret i det det faktisk blir lagret. Den bør også si at filen ble lagret på datamaskinen, og ikke "i nedlastingsmappen din"

---

[![Buy Me A Coffee](https://img.shields.io/badge/Feel%20free%20to%20support%20me-☕%20buymeacoffee.com-FFDD00?style=for-the-badge&logoColor=black)](https://www.buymeacoffee.com/sigurdeye)
