# Sicherheitsbericht CineVaultV2 (v2)

**Stand:** Februar 2026 (aktualisiert, 2026-02-04)  
**Umfang:** Code-Review und Berücksichtigung umgesetzter Maßnahmen. Dependencies: siehe Abschnitt 2.

---

## 1. Zusammenfassung

Das Projekt setzt an vielen Stellen sinnvolle Sicherheitsmaßnahmen um (Argon2id, Session in DB, Rollenprüfung, 2FA mit verschlüsseltem Secret). Seit dem ersten Bericht wurden u. a. folgende Punkte umgesetzt:

- **Rate-Limiting und Account-Lock** für Login und 2FA (pro IP und pro Account); temporäre Sperre nach Fehlversuchen, Admin-Report zum Einsehen und Entsperren.
- **CSRF-Token** für sensible Aktionen (Passwort ändern, 2FA Setup/Verify/Disable/Trust, E-Mail/Name ändern); Token in Session, Abgleich bei POST, optional Token-Rotation nach Erfolg.
- **Cron:** Keine HTTP-Cron-Endpoints mehr; geplante Aufgaben laufen ausschließlich in-process über node-cron – kein CRON_SECRET erforderlich.
- **Security-Report CI:** Wöchentlich und manuell: npm audit + Tests (Vitest), KI-Einschätzung (Grok), Versand des Reports an Discord (Webhook).

Weiterhin zu beachten:

- **Open Redirect** über `callbackUrl` nach Login/2FA (mittleres Risiko, gut eingrenzbar).
- **SESSION_SECRET** in Produktion zwingend setzen; Fallback im Code birgt Risiko.
- **Dependencies:** npm audit wird per CI ausgeführt und gemeldet; kritische/hohe Findings sollten zeitnah behoben werden.

---

## 2. Dependencies und CVEs

- **npm audit:** Wird im Projekt regelmäßig im Rahmen des **Security-Report CI** (GitHub Actions) ausgeführt: wöchentlich (Montag 09:00 UTC) und bei manuellem Trigger. Das Ergebnis (Critical/High/Moderate/Low/Info, betroffene Pakete) wird zusammen mit den **Testergebnissen** (Vitest) und einer **KI-Einschätzung** (Grok) an einen Discord-Webhook gesendet. So bleibt der Stand der Dependencies und der Tests sichtbar, ohne dass automatisch `npm audit fix` ausgeführt wird.
- **Empfehlung:** Kritische und hohe Findings aus dem Report zeitnah adressieren; Fixes gezielt und manuell (kein blindes `npm audit fix`), um Breaking Changes zu vermeiden.
- **Hinweis:** Viele moderate Warnungen stammen von **swagger-ui-react** (Peer-Deps, veraltete Unterabhängigkeiten); nur durch Paket-Updates oder Wechsel der Bibliothek behebbar.

---

## 3. Authentifizierung und Session

| Aspekt | Befund |
|--------|--------|
| **Passwort-Hashing** | Argon2id mit konfigurierbaren Parametern (timeCost, memoryCost, etc.); optionaler **Pepper** (PASSWORD_PEPPER / PASSWORD_PEPPER_FILE). |
| **Session** | Cookie `cv.sid` (Session-ID); Session-Daten in **Datenbank** (Prisma), nicht im Cookie. Session-ID: 24 Bytes random, base64url. |
| **Cookie-Optionen** | `httpOnly: true`, `secure` in Production, `sameSite: "lax"`. |
| **SESSION_SECRET** | In `env.ts`: Fallback `"change-me-in-production-please"`, wenn nicht gesetzt. **Risiko:** In Produktion muss ein starker, eindeutiger Wert gesetzt werden; sonst Gefahr von Session-Fixation/Prädiktion. |
| **Dev-Login** | `/api/auth/dev-login` nur wenn `ENVIRONMENT=dev/development/developement`; sonst 403. Master-Admin wird automatisch eingeloggt. Sicher nur, wenn Prod nicht mit `ENVIRONMENT=dev` läuft. |

---

## 4. Autorisierung

- **Rollen:** VIEWER, EDITOR, ADMIN; Prüfung über `getAuth()` und `hasEffectiveRole()` (Daten aus DB, nicht nur Cookie).
- **Proxy (Middleware):** Nutzt `cv.role` aus Cookie für Routen-Schutz. **Hinweis:** Rolle ist clientseitig setzbar; die **tatsächliche** Autorisierung erfolgt in den API-Routen über `getAuth()`/DB. Wer nur das Cookie fälscht, kann ggf. UI sehen, aber keine fremden Daten über die API ändern (IDOR-Schutz durch DB-Abfragen mit `auth.user.id` bzw. Rolle).
- **Admin/Editor-Routen:** Konsistent `hasEffectiveRole(auth, RoleEnum.EDITOR)` bzw. `ADMIN`; API Keys z. B. mit `where: { id, userId: auth.user.id }` – kein IDOR auf andere Nutzer-Keys.

---

## 5. Open Redirect (callbackUrl)

- **Login / 2FA / Dev-Login:** Nach erfolgreicher Anmeldung Redirect mit `new URL(callbackUrl, base)`.
- **Problem:** Ist `callbackUrl` eine **absolute URL** (z. B. `https://evil.example.com/phishing`), wird genau dorthin weitergeleitet; `base` wird dann ignoriert.
- **Risiko:** Angreifer könnte einen Link mit `callbackUrl=https://evil.example.com/...` setzen; nach Login landet das Opfer auf der Schadseite (Phishing/Diebstahl von Tokens, wenn diese in der URL landen).
- **Mitigation (Empfehlung):** Vor dem Redirect prüfen, dass die aufgelöste URL nur zur eigenen Origin gehört (z. B. nur relative Pfade oder explizit whitelistete URLs für `callbackUrl` zulassen).

---

## 6. Cron (node-cron)

- Geplante Aufgaben (Session-Cleanup, Status-Digest, CDN-Warmup, Status-Scheduled) laufen ausschließlich **in-process** über **node-cron** in `instrumentation.ts` (nur in Production).
- Es gibt **keine** HTTP-Cron-Endpoints; kein CRON_SECRET erforderlich. Damit entfällt die frühere Empfehlung, CRON_SECRET in Produktion zu setzen.

---

## 7. API v1 (Challenge-Response, API-Keys)

- Authentifizierung über Challenge-Response mit **SSH-Key-Signatur** (sshpk); öffentlicher Schlüssel wird in der DB **verschlüsselt** abgelegt (AES-256-GCM, Key aus PASSWORD_PEPPER/SESSION_SECRET).
- Kein Klartext-API-Key in der DB; Zugriff auf API Keys nur mit `userId: auth.user.id` – kein IDOR.
- **CSRF:** Die Challenge-Response-Auth (challenge + verify) ist **nicht** mit CSRF abgesichert – und soll es bewusst nicht sein. Die Authentifizierung beruht auf Besitznachweis (Private-Key-Signatur); ein Angreifer von einer anderen Seite kann keine gültige Signatur erzeugen. CSRF für diese Endpoints würde API-Clients (Skripte, CLI, Swagger Try-it-out) brechen, die keine Session/CSRF-Token vor dem Auth-Flow haben.

---

## 8. 2FA (TOTP)

- TOTP-Secret in DB mit **AES-256-GCM** (Präfix `2fa.`), Key aus SESSION_SECRET.
- Backup-Codes gehasht (SHA-256) gespeichert; Verifikation mit konstantem Zeitenvergleich (otplib).
- **Abhängigkeit:** SESSION_SECRET muss stark sein, da es sowohl Session als auch 2FA-Verschlüsselung schützt.
- Sensible 2FA-Aktionen (Setup, Verify, Disable, Trust-Device) sind durch **CSRF-Token** geschützt.

---

## 9. Datei-Upload (Avatar/Banner)

- **Größenlimit:** 5 MB (Avatar).
- **Erlaubte Typen:** z. B. image/jpeg, image/png, image/webp, image/gif, image/svg+xml, image/avif.
- **Speicherpfad:** Key aus festem Prefix + `userId` (aus Auth) + Dateiendung; `userId` kommt nicht aus dem Request – **kein Path-Traversal** über User-Input in den Speicherpfad.
- **Hinweis:** SVG/XML-Uploads können theoretisch XXE/SSRF-Risiken in Parsern bergen; wenn SVG nur gespeichert und nicht serverseitig gerendert wird, ist das Risiko gering. Bei eigener Verarbeitung: sichere Parser/Libs verwenden.

---

## 10. Datenbank und Injection

- **Prisma** durchgängig für DB-Zugriffe; **keine** `$queryRaw`/Raw-SQL-Stellen gefunden.
- Parameterisierte Abfragen über Prisma – **kein klassisches SQL-Injection-Risiko** aus dem aktuellen Code.

---

## 11. XSS

- **Kein** `dangerouslySetInnerHTML`, `innerHTML`, `eval(…)` oder `new Function(…)` in der Codebase gefunden.
- React escaped Ausgaben standardmäßig; trotzdem: Nutzer-steuerbare Daten (z. B. Filmtitel, Namen) nur als Text rendern, keine HTML-Strings einbauen.

---

## 12. Rate-Limiting und Brute-Force (umgesetzt)

- **Login** und **2FA** sind mittlerweile mit **Rate-Limiting** (pro IP und pro Account) und **Account-Lock** abgesichert: Fehlversuche werden erfasst (LoginFailure), bei Überschreitung einer Schwelle wird der Account temporär gesperrt (`lockedUntil`). Admins können im **Security-Report** (Admin-Bereich) Sperren einsehen und gezielt aufheben (clear-lock). Der Report zeigt außerdem Fehlversuche pro Account, pro IP und die letzten Fehlversuche (inkl. Zeitraum-Auswahl).
- Damit ist das frühere Brute-Force-Risiko deutlich reduziert; starke Passwörter und 2FA bleiben weiterhin empfohlen.

---

## 13. CSRF (umgesetzt)

- Für **sensible Aktionen** (Passwort ändern, 2FA Setup/Verify/Disable/Trust-Device, E-Mail ändern, Name ändern) ist ein **CSRF-Token** eingeführt: Token pro Session (in Session gespeichert), Abruf über GET `/api/csrf`, Abgleich bei jedem geschützten POST (Header `X-CSRF-Token` oder Body `csrfToken`). Nach erfolgreicher Aktion kann der Token rotiert werden (neuer Token in Session und in der Response), der Client aktualisiert den Cache entsprechend.
- **Nicht** mit CSRF abgesichert (und so gewollt): Login, 2FA-Login, Challenge-Response-API (v1), sowie alle Lese- oder nicht sensiblen Endpoints. Login/2FA-Login haben kein Session-Cookie vor dem Auth; die API v1 nutzt Besitznachweis (Signatur), kein Cookie-basierter CSRF-Angriff möglich.

---

## 14. Sensible Konfiguration und Secrets

- **.env** und **.secrets/** in `.gitignore`; **.env.example** ohne echte Secrets.
- **SESSION_SECRET:** Siehe Abschnitt 3 – in Produktion zwingend setzen.
- **PASSWORD_PEPPER:** Optional; bei Nutzung stark und getrennt vom SESSION_SECRET halten; Rotation bedeutet ggf. Re-Hash aller Passwörter.
- **Deploy (GitHub Actions):** SSH_KEY als Secret; wird in `key.pem` geschrieben; `*.pem` ist in `.gitignore` (betrifft Repo, nicht den Runner). Üblich: Secrets in Actions nicht loggen; darauf achten, dass key.pem nur im Runner-Verzeichnis liegt und nicht committed wird.
- **Security-Report CI:** Nutzt u. a. GROK_API_MODEL, GROK_API_KEY, GROK_API_URL, DISCORD_SECURITY_WEBHOOK als Repository-Secrets; keine Secrets in Logs oder in der App.

---

## 15. Weitere Punkte

- **CORS:** Keine explizite CORS-Konfiguration im Review gefunden; Next.js Standard-Verhalten beachten (API-Routen same-origin, wenn kein eigener Header gesetzt).
- **Fehlermeldungen:** Login/2FA geben generische Meldungen („E-Mail oder Passwort ungültig“) – kein User-Enumeration über unterschiedliche Fehlertypen.
- **Logging:** Keine systematische Prüfung auf Logging von Passwörtern, Tokens oder Session-IDs; bei `console.error`/`console.log` darauf achten, keine Secrets zu loggen.
- **Tests:** CSRF-Logik (Token-Generierung, Abgleich, Abruf aus Request) ist durch **Unit-Tests** (Vitest) abgedeckt; die Tests laufen im Security-Report CI mit und werden im Discord-Report (inkl. KI-Einschätzung) berücksichtigt.

---

## 16. Priorisierte Empfehlungen – Status

| Nr. | Empfehlung | Status |
|-----|------------|--------|
| 1 | **SESSION_SECRET** in Produktion zwingend setzen und stark wählen; Fallback im Code entfernen oder nur für Dev erlauben. | Offen |
| 2 | **Open Redirect** bei Login/2FA entschärfen: nur relative Pfade oder explizit whitelistete URLs für `callbackUrl` zulassen. | Offen |
| 3 | Rate-Limiting für Login und 2FA (pro IP und/oder pro Account) sowie Account-Lock nach Fehlversuchen. | **Umgesetzt** (LoginFailure, lockedUntil, Admin Security-Report, clear-lock) |
| 4 | npm audit regelmäßig ausführen; bekannte CVEs in Dependencies beheben (insb. kritisch/hoch). | **Umgesetzt** (Security-Report CI: audit + Tests, Grok, Discord); Behebung weiterhin manuell/gezielt |
| 5 | CRON_SECRET in Produktion setzen bzw. HTTP-Cron-Endpoints schützen. | **Entfallen** (nur node-cron, keine HTTP-Cron-Endpoints) |
| 6 | CSRF-Token für sensible Änderungen (Passwort, 2FA, E-Mail); Account-Lock. | **Umgesetzt** (CSRF für Passwort, 2FA, E-Mail, Name; Account-Lock siehe Nr. 3) |

**Noch zu tun (priorisiert):** SESSION_SECRET in Produktion setzen (1), Open Redirect entschärfen (2). Optional: CSRF oder weitere Härtung für weitere Endpoints nach Bedarf; regelmäßige Behebung von npm-audit-Findings (kritisch/hoch) anhand des Discord-Reports.

---

*Dieser Bericht ersetzt keine Penetrationstests oder eine vollständige Sicherheitszertifizierung. Er dient als Grundlage für interne Entscheidungen und dokumentiert den aktuellen Stand der umgesetzten und offenen Maßnahmen.*
