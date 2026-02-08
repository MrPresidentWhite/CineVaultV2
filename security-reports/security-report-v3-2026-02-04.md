# Sicherheitsbericht CineVaultV2 (v3) – Aktualisierter Stand

**Stand:** 2026-02-04 (aktualisiert)  
**Bezug:** v2 (`security-report-v2-2026-02-04.md`). Alle priorisierten Empfehlungen (Abschnitt 16) sind umgesetzt. Dieser Bericht vergleicht v2 mit dem aktuellen Stand und dokumentiert die umgesetzten Maßnahmen. **v2 wurde nicht verändert.**

---

## Priorisierte Empfehlungen v2 (Abschnitt 16) – aktueller Status

| Nr. | Empfehlung (v2) | v2-Status | Aktueller Stand |
|-----|------------------|-----------|-----------------|
| 1 | **SESSION_SECRET** in Produktion zwingend setzen; Fallback nur für Dev. | Offen | **Umgesetzt:** `getSessionSecret()` in `env.ts` – Prod wirft beim Start, wenn SESSION_SECRET fehlt oder Default ist. Dev nutzt `SESSION_SECRET_DEV` (getrennt vom Prod-Secret). |
| 2 | **Open Redirect** bei Login/2FA entschärfen. | Offen | **Umgesetzt:** `getSafeCallbackPath()` lehnt absolute URLs ab, prüft Same-Origin; Login, 2FA, Dev-Login nutzen die Funktion. |
| 3 | Rate-Limiting und Account-Lock für Login/2FA. | Umgesetzt | Unverändert (LoginFailure, lockedUntil, Admin Security-Report). |
| 4 | npm audit regelmäßig; CVEs (kritisch/hoch) beheben. | Umgesetzt | Unverändert (Security-Report CI, Grok, Discord). |
| 5 | CRON_SECRET / HTTP-Cron schützen. | Entfallen | Unverändert (nur node-cron, keine HTTP-Cron-Endpoints). |
| 6 | CSRF-Token für sensible Änderungen; Account-Lock. | Umgesetzt | Unverändert (CSRF für Passwort, 2FA, E-Mail, Name). |

**Fazit:** Keine offenen priorisierten Empfehlungen mehr aus v2.

---

## Vergleich v2 ↔ aktuell (ausgewählte Abschnitte)

| v2-Abschnitt | v2-Befund / Risiko | Aktueller Stand |
|--------------|--------------------|-----------------|
| **3 Authentifizierung / Session** | SESSION_SECRET Fallback in Prod riskant; Proxy nutzt Cookie `cv.role`. | SESSION_SECRET in Prod Pflicht (App wirft sonst); Rolle nur noch in Session (`effectiveRole`), kein Rollen-Cookie. |
| **4 Autorisierung** | Rolle aus Cookie `cv.role` (clientseitig setzbar). | Rolle ausschließlich aus Session (DB); Admin-Rollenänderung aktualisiert alle Sessions des Users. |
| **5 Open Redirect** | callbackUrl als absolute URL möglich. | `getSafeCallbackPath()`: absolute URLs abgelehnt, nur Same-Origin. |
| **9 Datei-Upload** | SVG/XML erlaubt (XXE/SSRF-Hinweis). | SVG/XML für Avatar/Banner entfernt; nur JPEG, PNG, WebP, GIF, AVIF. |
| **11 XSS** | Nutzerdaten nur als Text rendern. | Cursor-Regel + ESLint `react/no-danger`; durchgängig Text-Rendering. |
| **15 Weitere Punkte** | CORS, Fehlermeldungen, Logging, Tests. | CORS/Fehlermeldungen/Tests unverändert; Logging: Cursor-Regel + Staging-Logging-Check warnt bei Verdacht auf Secret-Logging. |
| **16 Priorisierte Empfehlungen** | Nr. 1 und 2 offen. | Nr. 1 und 2 umgesetzt; siehe Tabelle oben. |

---

## 1. Rollen-Schutz (gegenüber v2 Abschnitt 4)

| Aspekt | v2 | Aktuell |
|--------|-----|---------|
| Rolle für Zugriffskontrolle | Cookie `cv.role` (clientseitig setzbar). | Rolle nur in Session (DB) als `effectiveRole`; kein Rollen-Cookie. |
| Proxy | Liest `cv.role` aus Cookie. | Liest `session.effectiveRole` aus Session; Fallback `VIEWER`. |
| Login/2FA/Dev-Login | Setzen Cookie `cv.role`. | Setzen kein Rollen-Cookie; speichern `effectiveRole` in Session. |
| Admin ändert User-Rolle | Nur DB-Update. | Alle Sessions des Users werden aktualisiert (`effectiveRole`, `viewAsRole`). |

---

## 2. Open Redirect (v2 Abschnitt 5 / Empfehlung 2)

- **Umsetzung:** `getSafeCallbackPath()` in `src/lib/request-url.ts` – absolute URLs (`http://`, `https://`) werden abgelehnt; bei relativen Pfaden wird die aufgelöste URL gegen die eigene Origin geprüft. Login, 2FA und Dev-Login nutzen die Funktion für den Redirect.

---

## 3. Datei-Upload Avatar/Banner (v2 Abschnitt 9)

- **Umsetzung:** SVG/XML entfernt. Erlaubt nur noch: JPEG, PNG, WebP, GIF, AVIF. API-Routen und Formular angepasst; Dateiendung `.svg` wird zusätzlich abgelehnt.

---

## 4. XSS / Nutzerdaten (v2 Abschnitt 11.2)

- **Umsetzung:** Cursor-Regel `.cursor/rules/xss-user-data.mdc`; ESLint `react/no-danger: error`; Codebase nutzt durchgängig Text-Rendering für nutzersteuerbare Daten.

---

## 5. Weitere Punkte (v2 Abschnitt 15)

- **15.1 CORS:** Next.js-Standard (same-origin); bei Bedarf CORS gezielt setzen.
- **15.2 Fehlermeldungen:** Generische Login/2FA-Meldungen beibehalten.
- **15.3 Logging:** Cursor-Regel `.cursor/rules/logging-secrets.mdc`; Staging-Workflow enthält Logging-Check (`staging-logging-check.mjs`), der bei Verdacht auf Secret-Logging warnt und Staging fehlschlagen lässt.
- **15.4 Tests:** CSRF-Unit-Tests (Vitest) in Security-Report CI und Staging.

---

## 6. SESSION_SECRET (v2 Empfehlung 1 / Abschnitt 3 und 14)

- **Umsetzung:** `getSessionSecret()` in `src/lib/env.ts`:
  - **Dev:** Verwendung von `SESSION_SECRET_DEV ?? SESSION_SECRET ?? Default` – Dev kann eigenen Secret setzen (Prod-Secret nicht in Dev nötig).
  - **Prod:** Nur `SESSION_SECRET`; fehlt er oder entspricht er dem Default, wirft die App beim Start (kein Start mit Fallback in Prod).
- `.env.example` um `SESSION_SECRET_DEV` und Hinweise ergänzt.

---

## 7. Staging und CI (ergänzend zu v2)

- **Staging-Workflow:** Lint, Tests, Build und Logging-Check laufen vor Deployment; bei Erfolg wird Deploy getriggert. Staging-Report (inkl. KI-Einschätzung, Grok) geht an Discord (`DISCORD_STAGING_WEBHOOK`).
- **Logging-Check:** Sucht in `src/` nach riskanten `console.*`-Aufrufen (z. B. Passwort, Token, Session-ID); bei Treffern schlägt Staging fehl und warnt im Discord-Report.

---

*V2-Bericht (`security-report-v2-2026-02-04.md`) wurde nicht verändert. Dieser Bericht (v3) dokumentiert den vollständigen Umsetzungsstand aller priorisierten Empfehlungen und der genannten v2-Abschnitte.*
