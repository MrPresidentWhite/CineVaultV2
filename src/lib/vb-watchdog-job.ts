/**
 * VB-Watchdog-Job: Liest täglich (Cron 18:15) das konfigurierte E-Mail-Postfach,
 * filtert Mails von VIDEOBUSTER mit Betreff „Versandstatus“ und wertet sie aus:
 * - „folgende Titel haben wir heute dankend von dir zurückerhalten:“ → Filme UPLOADED → ARCHIVED, vbReceivedAt = Mail-Datum
 *   Fallback: Ist der Film bereits ARCHIVED (manuell), wird nur vbReceivedAt gesetzt, wenn noch null.
 * - „Neue Titel sind bereits auf dem Weg zu dir:“ → Filme VB_WISHLIST → SHIPPING, vbSentAt = Mail-Datum
 *   Fallback: Ist der Film bereits SHIPPING (manuell), wird nur vbSentAt gesetzt, wenn noch null.
 * Als Datum wird das Ankunftsdatum der Mail im Postfach verwendet (Envelope-Datum).
 * Statusänderungen nur, wenn der aktuelle Status passt (keine unnötigen MovieStatusChange).
 * Nach vollständiger Abarbeitung wird die Mail per Checksum-Abgleich identifiziert und in den Ordner „Abgearbeitet“ verschoben.
 */

import { createHash } from "node:crypto";
import { ImapFlow } from "imapflow";
// @ts-expect-error - mailparser has no official type definitions
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/db";
import { Status as StatusEnum } from "@/generated/prisma/enums";
import { invalidateMovieCache, invalidateMoviesListCache } from "@/lib/movie-data";
import { invalidateHomeCache } from "@/lib/home-data";
import {
  VB_WATCHDOG_IMAP_HOST,
  VB_WATCHDOG_IMAP_PORT,
  VB_WATCHDOG_IMAP_USER,
  VB_WATCHDOG_IMAP_PASS,
  VB_WATCHDOG_SMTP_FROM_VB_MAIL,
  VB_WATCHDOG_DISCORD_WEBHOOK_URL,
} from "@/lib/env";

const VB_BASE = "https://www.videobuster.de/dvd-bluray-verleih/";
/** Erkennt dvd-bluray-verleih-URLs; Gruppe 1 = ID/Slug (Groß-/Kleinschreibung wird beim Normalisieren auf kleingeschrieben). */
const VB_LINK_REGEX = /https:\/\/www\.videobuster\.de\/dvd-bluray-verleih\/(\d+\/[a-zA-Z0-9-]+)/gi;

const SECTION_RETOUR = "folgende titel haben wir heute dankend von dir zurückerhalten:";
const SECTION_SHIPPING = "neue titel sind bereits auf dem weg zu dir:";
const SECTION_KEINE_SENDUNGEN = "keine sendungen mehr frei:";

/** Frühestes akzeptables Mail-Datum (Vermeidung offensichtlich falscher Envelope-Daten). */
const MIN_MAIL_DATE = new Date("2000-01-01T00:00:00Z");

/**
 * Validiert ein aus der Mail stammendes Datum für vbReceivedAt/vbSentAt.
 * Gibt nur dann ein Date zurück, wenn es gültig, nicht in der Zukunft und nicht vor MIN_MAIL_DATE liegt.
 */
function validMailDate(candidate: Date | undefined | null): Date | null {
  if (candidate == null || !(candidate instanceof Date)) return null;
  const t = candidate.getTime();
  if (Number.isNaN(t)) return null;
  const now = Date.now();
  if (t > now) return null;
  if (t < MIN_MAIL_DATE.getTime()) return null;
  return candidate;
}

/** Erzeugt eine Checksumme des Nachrichteninhalts zur eindeutigen Identifikation (z. B. vor Löschen). */
function messageChecksum(source: Buffer | string): string {
  const buf = typeof source === "string" ? Buffer.from(source, "utf-8") : source;
  return createHash("sha256").update(buf).digest("hex");
}

/** Extrahiert alle VB-dvd-bluray-verleih-URLs aus einem Text; gibt normalisierte Basis-URLs zurück (ohne Duplikate, Reihenfolge). */
function extractVbUrls(text: string): string[] {
  if (!text || typeof text !== "string") return [];
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  VB_LINK_REGEX.lastIndex = 0;
  while ((m = VB_LINK_REGEX.exec(text)) !== null) {
    const norm = VB_BASE + m[1].toLowerCase();
    if (!seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  VB_LINK_REGEX.lastIndex = 0;
  return out;
}

/** Teilt den Mail-Text in Abschnitte: [retour], [shipping]. Jeder Abschnitt enthält nur den Text bis zum nächsten Abschnitt. */
function splitSections(text: string): { retour: string; shipping: string } {
  const lower = text.toLowerCase().replace(/\s+/g, " ").trim();
  let retour = "";
  let shipping = "";

  const idxRetour = lower.indexOf(SECTION_RETOUR);
  const idxShipping = lower.indexOf(SECTION_SHIPPING);
  const idxKeine = lower.indexOf(SECTION_KEINE_SENDUNGEN);

  if (idxRetour >= 0) {
    const endRetour =
      idxShipping >= 0 ? idxShipping : idxKeine >= 0 ? idxKeine : text.length;
    retour = text.slice(idxRetour, endRetour);
  }
  if (idxShipping >= 0) {
    shipping = text.slice(idxShipping);
  }

  return { retour, shipping };
}

function isWatchdogConfigured(): boolean {
  return Boolean(
    VB_WATCHDOG_IMAP_HOST &&
      VB_WATCHDOG_IMAP_USER &&
      VB_WATCHDOG_IMAP_PASS &&
      VB_WATCHDOG_SMTP_FROM_VB_MAIL
  );
}

export type VbWatchdogResult = {
  processed: number;
  archived: number;
  shipping: number;
  errors: string[];
};

/** Sendet Watchdog-Ergebnis als Discord-Embed an den konfigurierten Webhook. */
async function sendWatchdogDiscordEmbed(result: VbWatchdogResult): Promise<void> {
  if (!VB_WATCHDOG_DISCORD_WEBHOOK_URL?.trim()) {
    if (result.processed > 0 || result.errors.length > 0) {
      console.warn(
        "[vb-watchdog] Discord-Webhook nicht konfiguriert (VB_WATCHDOG_DISCORD_WEBHOOK_URL); Ergebnis nicht an Discord gesendet."
      );
    }
    return;
  }
  try {
    const hasErrors = result.errors.length > 0;
    const color = hasErrors ? 0xe67e22 : 0x2ecc71; // Orange bei Fehlern, Grün sonst
    const fields: { name: string; value: string; inline?: boolean }[] = [
      { name: "Mails verarbeitet", value: String(result.processed), inline: true },
      { name: "→ Archiviert", value: String(result.archived), inline: true },
      { name: "→ Im Versand", value: String(result.shipping), inline: true },
    ];
    if (hasErrors) {
      const errLines = result.errors
        .slice(0, 5)
        .map((e) => `• ${e.length > 120 ? e.slice(0, 120) + "…" : e}`);
      const errText =
        errLines.join("\n") +
        (result.errors.length > 5 ? `\n… und ${result.errors.length - 5} weitere` : "");
      fields.push({ name: "Fehler", value: errText.slice(0, 1024), inline: false });
    }
    const body = {
      embeds: [
        {
          title: "VB-Watchdog · Versandstatus",
          description: result.processed === 0 && !hasErrors
            ? "Keine Versandstatus-Mails gefunden oder Postfach nicht erreichbar."
            : `${result.processed} Mail(s) ausgewertet. ${result.archived} Film(e) auf Archiviert, ${result.shipping} Film(e) auf Im Versand gesetzt.`,
          color,
          fields,
          timestamp: new Date().toISOString(),
          footer: { text: "CineVault VB-Watchdog" },
        },
      ],
    };
    await fetch(VB_WATCHDOG_DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[vb-watchdog] Discord-Webhook fehlgeschlagen:", err);
  }
}

export async function runVbWatchdogJob(): Promise<VbWatchdogResult> {
  const result: VbWatchdogResult = { processed: 0, archived: 0, shipping: 0, errors: [] };

  if (!isWatchdogConfigured()) {
    return result;
  }

  const client = new ImapFlow({
    host: VB_WATCHDOG_IMAP_HOST!,
    port: VB_WATCHDOG_IMAP_PORT,
    secure: true,
    auth: {
      user: VB_WATCHDOG_IMAP_USER!,
      pass: VB_WATCHDOG_IMAP_PASS!,
    },
    logger: false,
  });

  try {
    await client.connect();
  } catch (e) {
    result.errors.push(`IMAP-Verbindung fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    return result;
  }

  let lock: { release: () => void } | null = null;
  try {
    lock = await client.getMailboxLock("INBOX");
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const uids = await client.search(
      {
        from: VB_WATCHDOG_SMTP_FROM_VB_MAIL!,
        subject: "Versandstatus",
        since,
      },
      { uid: true }
    );

    const uidList = Array.isArray(uids) ? uids : [];
    if (uidList.length === 0) return result;

    const messages = await client.fetchAll(uidList, { source: true, envelope: true }, { uid: true });

    for (const msg of messages) {
      let storedChecksum: string | null = null;
      try {
        if (!msg?.source) continue;

        storedChecksum = messageChecksum(msg.source);

        const parsed = await simpleParser(msg.source);
        const rawText = parsed.text ?? "";
        const rawHtml = parsed.html ?? "";
        const text = (rawText + " " + rawHtml.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");

        /** Mail-Datum (Ankunft im Postfach) für vbReceivedAt / vbSentAt; nur setzen wenn validiert. */
        const rawDate =
          typeof (msg as { envelope?: { date?: Date } }).envelope?.date === "object"
            ? (msg as { envelope: { date: Date } }).envelope.date
            : parsed.date ?? undefined;
        const mailDate = validMailDate(rawDate);

        const { retour, shipping } = splitSections(text);
        const urlsRetour = extractVbUrls(retour);
        const urlsShipping = extractVbUrls(shipping);

        for (const normalizedUrl of urlsRetour) {
          const movie = await prisma.movie.findFirst({
            where: {
              status: StatusEnum.UPLOADED,
              videobusterUrl: { not: null },
              OR: [
                { videobusterUrl: { equals: normalizedUrl, mode: "insensitive" } },
                {
                  videobusterUrl: {
                    startsWith: normalizedUrl + "#",
                    mode: "insensitive",
                  },
                },
                {
                  videobusterUrl: {
                    startsWith: normalizedUrl + "?",
                    mode: "insensitive",
                  },
                },
              ],
            },
            select: { id: true, vbReceivedAt: true },
          });
          if (movie) {
            const setReceivedAt =
              mailDate !== null && movie.vbReceivedAt === null;
            await prisma.$transaction([
              prisma.movie.update({
                where: { id: movie.id },
                data: {
                  status: StatusEnum.ARCHIVED,
                  ...(setReceivedAt && { vbReceivedAt: mailDate! }),
                },
              }),
              prisma.movieStatusChange.create({
                data: {
                  movieId: movie.id,
                  from: StatusEnum.UPLOADED,
                  to: StatusEnum.ARCHIVED,
                  changedBy: null,
                },
              }),
            ]);
            await invalidateMovieCache(movie.id);
            result.archived++;
          } else if (mailDate !== null) {
            /** Bereits manuell archiviert? Nur vbReceivedAt nachtragen, wenn noch null. */
            const alreadyArchived = await prisma.movie.findFirst({
              where: {
                status: StatusEnum.ARCHIVED,
                videobusterUrl: { not: null },
                vbReceivedAt: null,
                OR: [
                  { videobusterUrl: { equals: normalizedUrl, mode: "insensitive" } },
                  {
                    videobusterUrl: {
                      startsWith: normalizedUrl + "#",
                      mode: "insensitive",
                    },
                  },
                  {
                    videobusterUrl: {
                      startsWith: normalizedUrl + "?",
                      mode: "insensitive",
                    },
                  },
                ],
              },
              select: { id: true },
            });
            if (alreadyArchived) {
              await prisma.movie.update({
                where: { id: alreadyArchived.id },
                data: { vbReceivedAt: mailDate },
              });
              await invalidateMovieCache(alreadyArchived.id);
            }
          }
        }

        for (const normalizedUrl of urlsShipping) {
          const movie = await prisma.movie.findFirst({
            where: {
              status: StatusEnum.VB_WISHLIST,
              videobusterUrl: { not: null },
              OR: [
                { videobusterUrl: { equals: normalizedUrl, mode: "insensitive" } },
                {
                  videobusterUrl: {
                    startsWith: normalizedUrl + "#",
                    mode: "insensitive",
                  },
                },
                {
                  videobusterUrl: {
                    startsWith: normalizedUrl + "?",
                    mode: "insensitive",
                  },
                },
              ],
            },
            select: { id: true, vbSentAt: true },
          });
          if (movie) {
            const setSentAt = mailDate !== null && movie.vbSentAt === null;
            await prisma.$transaction([
              prisma.movie.update({
                where: { id: movie.id },
                data: {
                  status: StatusEnum.SHIPPING,
                  ...(setSentAt && { vbSentAt: mailDate! }),
                },
              }),
              prisma.movieStatusChange.create({
                data: {
                  movieId: movie.id,
                  from: StatusEnum.VB_WISHLIST,
                  to: StatusEnum.SHIPPING,
                  changedBy: null,
                },
              }),
            ]);
            await invalidateMovieCache(movie.id);
            result.shipping++;
          } else if (mailDate !== null) {
            /** Bereits manuell auf Im Versand? Nur vbSentAt nachtragen, wenn noch null. */
            const alreadyShipping = await prisma.movie.findFirst({
              where: {
                status: StatusEnum.SHIPPING,
                videobusterUrl: { not: null },
                vbSentAt: null,
                OR: [
                  { videobusterUrl: { equals: normalizedUrl, mode: "insensitive" } },
                  {
                    videobusterUrl: {
                      startsWith: normalizedUrl + "#",
                      mode: "insensitive",
                    },
                  },
                  {
                    videobusterUrl: {
                      startsWith: normalizedUrl + "?",
                      mode: "insensitive",
                    },
                  },
                ],
              },
              select: { id: true },
            });
            if (alreadyShipping) {
              await prisma.movie.update({
                where: { id: alreadyShipping.id },
                data: { vbSentAt: mailDate },
              });
              await invalidateMovieCache(alreadyShipping.id);
            }
          }
        }

        result.processed++;

        if (storedChecksum) {
          try {
            const refetch = await client.fetchOne(
              msg.uid,
              { source: true },
              { uid: true }
            );
            const refetchSource = refetch && "source" in refetch ? refetch.source : undefined;
            if (refetchSource && messageChecksum(refetchSource) === storedChecksum) {
              await client.messageMove(msg.uid, "Abgearbeitet", { uid: true });
            }
          } catch (moveErr) {
            result.errors.push(
              `Verschieben UID ${msg.uid} nach Abgearbeitet: ${moveErr instanceof Error ? moveErr.message : String(moveErr)}`
            );
          }
        } else {
          await client.messageFlagsAdd(msg.uid, ["\\Seen"], { uid: true });
        }
      } catch (e) {
        result.errors.push(`Nachricht ${msg?.uid ?? "?"}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (result.archived > 0 || result.shipping > 0) {
      await Promise.all([invalidateMoviesListCache(), invalidateHomeCache()]);
    }
  } finally {
    lock?.release();
    await client.logout();
  }

  await sendWatchdogDiscordEmbed(result);
  return result;
}
