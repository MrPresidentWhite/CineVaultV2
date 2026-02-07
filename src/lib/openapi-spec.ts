/**
 * OpenAPI 3.0 Spec für die API-Dokumentation (Swagger UI).
 * Basis: /api/v1 – Server-URL in der UI auswählbar.
 */

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "CineVault API",
    version: "1.0.0",
    description:
      "API für CineVault. Authentifizierung erfolgt per **Challenge-Response** mit SSH-Keys (kein Passwort, kein Bearer-Token).\n\n**Try it out mit Auth:** Für geschützte Endpoints (z. B. Movies) zuerst **POST /auth/challenge** (Fingerprint eintragen) ausführen, dann den Nonce mit deinem privaten SSH-Key signieren und **POST /auth/verify** (challengeId + Signatur) aufrufen. Danach setzt der Server das Session-Cookie; alle weiteren Try-it-out-Requests senden es automatisch mit.",
  },
  servers: [
    { url: "/api/v1", description: "Relativ (gleiche Origin)" },
    { url: "http://localhost:3000/api/v1", description: "Lokal (localhost)" },
  ],
  tags: [
    {
      name: "API Authentication (Challenge-Response)",
      description:
        "Authentifizierung ohne Passwort und ohne Bearer-Token: Der Client weist sich mit seinem **privaten SSH-Key** gegenüber dem Server aus. Der Server hat den **öffentlichen Schlüssel** (verschlüsselt) gespeichert.\n\n**Ablauf:**\n1. **Challenge anfordern** – Client sendet den Fingerprint seines Keys (SHA256, hex mit Doppelpunkten).\n2. Server erzeugt eine einmalige Challenge (Nonce) und speichert sie mit Ablaufzeit.\n3. **Signatur senden** – Client signiert den Nonce mit seinem privaten SSH-Key und sendet die Signatur (Base64, SSH-Format).\n4. Server prüft die Signatur mit dem gespeicherten öffentlichen Schlüssel. Bei Erfolg: API-Session (Cookie `cv.api_sid`), gültig für alle weiteren `/api/v1/*`-Requests.\n\n**Hinweis:** Nur der **aktive** Key pro User kann verwendet werden. Fingerprint und aktiven Key findest du im Dashboard unter API Key.",
    },
    {
      name: "Movies",
      description: "Filme abfragen. Alle Routen erfordern eine gültige API-Session (Cookie `cv.api_sid`).",
    },
  ],
  paths: {
    "/": {
      get: {
        tags: ["API Authentication (Challenge-Response)"],
        summary: "API-Info",
        description: "Öffentliche Basis-Route, keine Authentifizierung nötig.",
        operationId: "getApiInfo",
        responses: {
          "200": {
            description: "API-Informationen",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    api: { type: "string", example: "v1" },
                    docs: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/auth/challenge": {
      post: {
        tags: ["API Authentication (Challenge-Response)"],
        summary: "Challenge anfordern",
        description:
          "Fordert eine einmalige Challenge (Nonce) für die Challenge-Response-Authentifizierung an. Der Fingerprint muss zum **aktiven** API-Key des Nutzers gehören (SHA256-Fingerprint, hex mit Doppelpunkten, z. B. aus dem Dashboard).",
        operationId: "createChallenge",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["fingerprint"],
                properties: {
                  fingerprint: {
                    type: "string",
                    description:
                      "SHA256-Fingerprint des aktiven Keys (hex mit Doppelpunkten, z. B. 81:c2:8d:25:...)",
                    example: "81:c2:8d:25:d1:49:ae:c5:46:24:5c:31:35:f7:4a:65:47:21:b2:83:bd:a1:d4:a8:f7:4b:0f:a5:9e:f5:b8:d4",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description:
              "Challenge erstellt. **Wichtig:** Es wird keine Signatur zurückgegeben. Du musst den **nonce** (Klartext) mit deinem **privaten SSH-Key** signieren und die entstandene Signatur (Base64, SSH-Format) bei POST /auth/verify im Feld **signature** senden. Den Nonce selbst als signature einzutragen funktioniert nicht.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    challengeId: { type: "string", description: "ID der Challenge (für Verify nötig)" },
                    nonce: {
                      type: "string",
                      description:
                        "Zu signierender Klartext – mit dem privaten Key signieren, Ergebnis (nicht der Nonce!) als signature an /auth/verify senden",
                    },
                    expiresAt: { type: "string", format: "date-time", description: "Ablaufzeit der Challenge" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Ungültige Anfrage (z. B. fingerprint fehlt)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "404": {
            description: "Key nicht gefunden oder nicht aktiv",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/auth/verify": {
      post: {
        tags: ["API Authentication (Challenge-Response)"],
        summary: "Signatur prüfen und Session eröffnen",
        description:
          "Sendet die **Signatur** (nicht den Nonce!). Die Signatur entsteht, indem du den **nonce** aus der Challenge mit deinem **privaten SSH-Key** signierst; das Ergebnis (Base64, SSH-Format) ist das Feld **signature**. Den Nonce-Klartext als signature einzutragen führt zu 401 – der Server prüft die Signatur kryptographisch. Bei Erfolg setzt der Server das Cookie `cv.api_sid`.",
        operationId: "verifyChallenge",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["challengeId", "signature"],
                properties: {
                  challengeId: {
                    type: "string",
                    description: "ID der zuvor angeforderten Challenge (aus POST /auth/challenge)",
                  },
                  signature: {
                    type: "string",
                    description:
                      "Kryptographische Signatur über den nonce, erzeugt mit dem privaten SSH-Key (Base64, SSH-Format). Nicht den Nonce-Text hier eintragen – nur die echte Signatur wird akzeptiert.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Erfolgreich authentifiziert; Cookie cv.api_sid gesetzt",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { ok: { type: "boolean", example: true } },
                },
              },
            },
          },
          "400": {
            description: "Challenge ungültig oder abgelaufen",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": {
            description: "Signatur ungültig",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/movies/{idOrChecksum}": {
      get: {
        tags: ["Movies"],
        summary: "Film abrufen",
        description:
          "Liefert einen Film anhand der **ID** (Zahl, z. B. `42`) oder der **Checksum** (String). Erfordert gültige API-Session (Cookie `cv.api_sid`).",
        operationId: "getMovie",
        parameters: [
          {
            name: "idOrChecksum",
            in: "path",
            required: true,
            description:
              "Film-ID (nur Ziffern, z. B. 42) oder Checksum (String) des Films",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Film gefunden",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Movie" },
              },
            },
          },
          "401": {
            description: "Nicht authentifiziert (keine oder ungültige Session)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "404": {
            description: "Film nicht gefunden",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
      patch: {
        tags: ["Movies"],
        summary: "Film-Status ändern",
        description:
          "Aktualisiert **nur** den Status eines Films. Film wird per **ID** (Zahl) oder **Checksum** (String) identifiziert. Erfordert gültige API-Session (Cookie `cv.api_sid`).",
        operationId: "patchMovieStatus",
        parameters: [
          {
            name: "idOrChecksum",
            in: "path",
            required: true,
            description:
              "Film-ID (nur Ziffern, z. B. 42) oder Checksum (String) des Films",
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/MovieStatusUpdate" },
            },
          },
        },
        responses: {
          "200": {
            description: "Status aktualisiert; vollständiges Film-Objekt",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Movie" },
              },
            },
          },
          "400": {
            description: "Ungültige Anfrage (z. B. status fehlt oder ungültiger Wert)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": {
            description: "Nicht authentifiziert (keine oder ungültige Session)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "404": {
            description: "Film nicht gefunden",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Movie: {
        type: "object",
        description: "Film-Objekt",
        properties: {
          id: { type: "integer", description: "Interne Film-ID" },
          title: { type: "string" },
          releaseYear: { type: "integer" },
          runtimeMin: { type: "integer" },
          posterUrl: { type: "string", nullable: true },
          backdropUrl: { type: "string", nullable: true },
          accentColor: { type: "string", nullable: true },
          accentColorBackdrop: { type: "string", nullable: true },
          tmdbId: { type: "integer", nullable: true },
          tagline: { type: "string", nullable: true },
          overview: { type: "string", nullable: true },
          status: { type: "string", description: "Status (z. B. UPLOADED, ARCHIVED)" },
          priority: { type: "string" },
          quality: { type: "string", nullable: true },
          mediaType: { type: "string", nullable: true },
          fsk: { type: "integer", nullable: true },
          checkSum: { type: "string", nullable: true },
          sizeBeforeBytes: { type: "string", nullable: true },
          sizeAfterBytes: { type: "string", nullable: true },
          vbSentAt: { type: "string", format: "date-time", nullable: true },
          vbReceivedAt: { type: "string", format: "date-time", nullable: true },
          videobusterUrl: { type: "string", nullable: true },
          addedAt: { type: "string", format: "date-time" },
          collectionId: { type: "integer", nullable: true },
          genres: { type: "array", items: { type: "string" }, description: "Genre-Codes" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      MovieStatusUpdate: {
        type: "object",
        required: ["status"],
        description: "Body für PATCH /movies/{idOrChecksum} – nur status wird aktualisiert",
        properties: {
          status: {
            type: "string",
            enum: [
              "ON_WATCHLIST",
              "VO_UNKNOWN",
              "VO_SOON",
              "VB_WISHLIST",
              "SHIPPING",
              "PROCESSING",
              "UPLOADED",
              "ARCHIVED",
            ],
            description: "Neuer Status des Films",
          },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string", description: "Fehlermeldung" },
        },
      },
    },
  },
} as const;
