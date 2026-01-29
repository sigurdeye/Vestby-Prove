# Vestby prøve 📝

Vestby prøve er et minimalistisk, sikkert og "dumt" skriveverktøy designet spesifikt for bruk i skoleverket under prøver og eksamen. Verktøyet er bygget for å være enkelt å hviteliste i **Safe Exam Browser (SEB)** og eliminerer risikoen for uautorisert samarbeid.

## Hvorfor bruke Vestby prøve?

*   **Ingen innlogging:** Elevene trenger ikke Office 365-konto eller annen pålogging.
*   **Sikkert mot juks:** Ingen innebygde delingsfunksjoner eller muligheter for sanntidsredigering (co-authoring).
*   **GDPR-vennlig:** Ingen tekst eller personopplysninger du skriver her sendes til eller lagres på en server. Alt blir værende lokalt i elevens nettleser.
*   **Krasjsikring:** Teksten lagres automatisk i nettleserens minne (localStorage) hvert sekund. Hvis PC-en går tom for strøm eller SEB krasjer, er teksten der når de åpner siden igjen. (Sikrer mot krasj eller tomt batteri).
*   **Universell utforming:** Inkluderer **OpenDyslexic** som standard font for å hjelpe elever med dysleksi.

## Funksjoner

*   Enkel tekstbehandling (Fet, Kursiv, Understrek, Overskrifter).
*   Fast linjeavstand på 1.5 (standard for skoleoppgaver).
*   Valg mellom OpenDyslexic, Arial og Verdana.
*   Ordtelling i sanntid.
*   Eksport til standard `.docx`-format for innlevering i læringsplattformer (LMS).

## Teknisk info & Personvern (GDPR)

Dette er en **Zero-Knowledge** applikasjon. 

1.  **Serveren (Firebase Hosting)** leverer kun koden (HTML/JS/CSS) til elevens maskin.
2.  **All tekst** som skrives, behandles og lagres kun i elevens egen nettleser.
3.  **Eksporten** til Word skjer lokalt på maskinen.
4.  Ingen databaser, ingen sporing, ingen informasjonskapsler (cookies) fra tredjeparter.

## Lisens & Tredjepartsprogramvare

Dette prosjektet er åpen kildekode og lisensiert under [MIT-lisensen](LICENSE).

Vi benytter oss av følgende tredjepartsprogramvare:
*   [Harper](https://github.com/elijah-potter/harper) (Apache License 2.0) - Brukes til lokal stavekontroll og grammatikk.

Se [CREDITS.md](CREDITS.md) for fullstendige lisensvilkår for tredjepartskomponenter.

## Veien videre (TODO)

*   **Plattformtesting:** Verifisere at verktøyet og eksporten fungerer optimalt på macOS (foreløpig kun testet på Windows).

---

❤️
