# Sicherheitsbericht CineVaultV2 (v1)

**Stand:** Februar 2026  
**Umfang:** Code-Review (keine Änderungen vorgenommen). Dependencies: siehe Abschnitt 2.

---

## 1. Zusammenfassung

Das Projekt setzt an vielen Stellen sinnvolle Sicherheitsmaßnahmen um (Argon2id, Session in DB, Rollenprüfung, geschützte Cron-Endpoints, 2FA mit verschlüsseltem Secret). Es bestehen u. a. folgende Risiken und Verbesserungsmöglichkeiten:

- **Open Redirect** über `callbackUrl` nach Login/2FA (mittleres Risiko, gut eingrenzbar).
- **Kein Rate-Limiting** auf Login/2FA (Brute-Force-Risiko).
- **Standard-SESSION_SECRET** in Code, wenn nicht gesetzt (kritisch in Produktion).
- **8 moderate Schwachstellen** in Dependencies (npm audit); keine Prüfung auf bekannte CVEs in diesem Bericht durchgeführt – siehe Abschnitt 2.

---

## 2. Dependencies und CVEs

- **npm audit:** Im Deployment-Job-Log wurden zuletzt **8 moderate severity vulnerabilities** gemeldet. Es wurden **keine** Änderungen am Projekt vorgenommen; eine aktuelle Bewertung solltest du lokal durchführen:
  - `npm audit`
  - `npm audit fix` bzw. `npm audit fix --force` (mit Vorsicht bei Breaking Changes).
- **Hinweis:** Viele Warnungen stammen von **swagger-ui-react** (Peer-Deps React 19, veraltete Unterabhängigkeiten). Diese lassen sich nur durch Paket-Updates oder Wechsel der Bibliothek adressieren.
- **Empfehlung:** Regelmäßig `npm audit` ausführen, kritische/hohe Findings priorisieren und Dependencies aktuell halten.

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
- **Mitigation (Empfehlung):** Vor dem Redirect prüfen, dass die aufgelöste URL nur zur eigenen Origin gehört (z. B. nur Pfade die mit der eigenen Origin beginnen akzeptieren, absolute URLs ablehnen oder strikt whitelisten).

---

## 6. Cron-Endpoints

- **`/api/cron/cleanup-sessions`** und **`/api/cron/cdn-warmup`** sind durch **CRON_SECRET** geschützt: `Authorization: Bearer <CRON_SECRET>`.
- Wenn `CRON_SECRET` nicht gesetzt ist, schlagen die Checks fehl (401). Sinnvoll: In Produktion starkes Secret setzen und nur an vertrauenswürdige Scheduler (z. B. Vercel Cron, eigener Server) vergeben.

---

## 7. API v1 (Challenge-Response, API-Keys)

- Authentifizierung über Challenge-Response mit **SSH-Key-Signatur** (sshpk); öffentlicher Schlüssel wird in der DB **verschlüsselt** abgelegt (AES-256-GCM, Key aus PASSWORD_PEPPER/SESSION_SECRET).
- Kein Klartext-API-Key in der DB; Zugriff auf API Keys nur mit `userId: auth.user.id` – kein IDOR.

---

## 8. 2FA (TOTP)

- TOTP-Secret in DB mit **AES-256-GCM** (Präfix `2fa.`), Key aus SESSION_SECRET.
- Backup-Codes gehasht (SHA-256) gespeichert; Verifikation mit konstantem Zeitenvergleich (otplib).
- **Abhängigkeit:** SESSION_SECRET muss stark sein, da es sowohl Session als auch 2FA-Verschlüsselung schützt.

---

## 9. Datei-Upload (Avatar/Banner)

- **Größenlimit:** 5 MB (Avatar).
- **Erlaubte Typen:** z. B. image/jpeg, image/png, image/webp, image/gif, image/svg+xml, image/avif.
- **Speicherpfad:** Key aus festem Prefix + `userId` (aus Auth) + Dateiendung; `userId` kommt nicht aus dem Request – **kein Path-Traversal** über User-Input in den Speicherpfad.
- **Hinweis:** SVG/XML-Uploads können theoretisch XXE/SSRF-Risiken in Parsern bergen; wenn ihr SVG nur speichert und nicht serverseitig rendert, ist das Risiko gering. Bei eigener Verarbeitung: sichere Parser/Libs verwenden.

---

## 10. Datenbank und Injection

- **Prisma** durchgängig für DB-Zugriffe; **keine** `$queryRaw`/Raw-SQL-Stellen gefunden.
- Parameterisierte Abfragen über Prisma – **kein klassisches SQL-Injection-Risiko** aus dem aktuellen Code.

---

## 11. XSS

- **Kein** `dangerouslySetInnerHTML`, `innerHTML`, `eval(…)` oder `new Function(…)` in der Codebase gefunden.
- React escaped Ausgaben standardmäßig; trotzdem: Nutzer-steuerbare Daten (z. B. Filmtitel, Namen) nur als Text rendern, keine HTML-Strings einbauen.

---

## 12. Rate-Limiting und Brute-Force

- **Login** und **2FA** haben **kein** Rate-Limiting (weder pro IP noch pro Konto).
- **Risiko:** Brute-Force auf Passwort oder 2FA-Codes (6-stellig, 30s-Fenster). Risiko kann durch starke Passwörter und 2FA gemindert werden, bleibt aber bestehen.
- **Empfehlung:** Rate-Limiting (z. B. pro IP und/oder pro Account) und ggf. Account-Lock nach Fehlversuchen (z. B. `lastFailedAuth` ausbauen).

---

## 13. Sensible Konfiguration und Secrets

- **.env** und **.secrets/** in `.gitignore`; **.env.example** ohne echte Secrets.
- **SESSION_SECRET:** Siehe Abschnitt 3 – in Produktion zwingend setzen.
- **CRON_SECRET:** Für Cron-Endpoints in Produktion setzen.
- **PASSWORD_PEPPER:** Optional; bei Nutzung stark und getrennt vom SESSION_SECRET halten; Rotation bedeutet ggf. Re-Hash aller Passwörter.
- **Deploy (GitHub Actions):** SSH_KEY als Secret; wird in `key.pem` geschrieben; `*.pem` ist in `.gitignore` (betrifft Repo, nicht den Runner). Üblich: Secrets in Actions nicht loggen; darauf achten, dass key.pem nur im Runner-Verzeichnis liegt und nicht committed wird.

---

## 14. Weitere Punkte

- **CORS:** Keine explizite CORS-Konfiguration im Review gefunden; Next.js Standard-Verhalten beachten (API-Routen same-origin, wenn kein eigener Header gesetzt).
- **CSRF:** Formulare (Login, 2FA, etc.) werden als POST von derselben Origin ausgeliefert; Next.js nutzt Same-Origin. Für kritische Aktionen (z. B. Passwort ändern, 2FA aktivieren) sind zusätzliche CSRF-Token möglich, wurden aber nicht geprüft.
- **Fehlermeldungen:** Login/2FA geben generische Meldungen („E-Mail oder Passwort ungültig“) – kein User-Enumeration über unterschiedliche Fehlertypen.
- **Logging:** Keine systematische Prüfung auf Logging von Passwörtern, Tokens oder Session-IDs; bei `console.error`/`console.log` darauf achten, keine Secrets zu loggen.

---

## 15. Priorisierte Empfehlungen (ohne Reihenfolge)

1. **SESSION_SECRET** in Produktion zwingend setzen und stark wählen; Fallback im Code entfernen oder nur für Dev erlauben.
2. **Open Redirect** bei Login/2FA entschärfen: nur relative Pfade oder explizit whitelistete URLs für `callbackUrl` zulassen.
3. **Rate-Limiting** für Login und 2FA (pro IP und/oder pro Account).
4. **npm audit** regelmäßig ausführen; bekannte CVEs in Dependencies beheben (insb. kritisch/hoch).
5. **CRON_SECRET** in Produktion setzen und nur an vertrauenswürdige Aufrufer vergeben.
6. Optional: **CSRF-Token** für sensible Änderungen (Passwort, 2FA, E-Mail); sowie **Account-Lock** nach wiederholten Fehlversuchen (z. B. auf Basis von `lastFailedAuth`).

---

*Dieser Bericht ersetzt keine Penetrationstests oder eine vollständige Sicherheitszertifizierung. Er dient als Grundlage für interne Entscheidungen, welche der genannten Punkte umgesetzt werden.*
