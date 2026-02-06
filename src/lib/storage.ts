/**
 * Cloudflare R2 Storage (S3-kompatibel) mit Redis-Cache.
 * Nutzt R2_* und R2_PUBLIC_BASE_URL aus der Umgebung.
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type HeadObjectCommandOutput,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "node:crypto";
import type { Readable as NodeReadable } from "node:stream";
import { cacheDelete, cacheGet, cacheSet } from "./cache";
import { purgeCloudflareCache } from "./cloudflare";
import {
  APP_URL,
  DEBUG_R2,
  R2_ACCESS_KEY_ID,
  R2_BUCKET,
  R2_ENDPOINT,
  R2_PUBLIC_BASE_URL,
  R2_REGION,
  R2_SECRET_ACCESS_KEY,
  R2_S3_FORCE_PATH_STYLE,
  TMDB_IMAGE_BASE_URL,
} from "./env";

const R2_EXISTS_CACHE_PREFIX = "r2:exists:";
const R2_EXISTS_CACHE_TTL = 300; // 5 Min
const R2_TMDB_KEY_CACHE_TTL = 86400; // 24h für "key ist gecached"

let r2Client: S3Client | null = null;
let r2Bucket: string | null = null;

function getR2Config(): {
  endpoint: string;
  bucket: string;
  region: string;
  forcePathStyle: boolean;
  credentials: { accessKeyId: string; secretAccessKey: string };
} | null {
  if (
    !R2_ENDPOINT ||
    !R2_BUCKET ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY
  ) {
    return null;
  }
  return {
    endpoint: R2_ENDPOINT,
    bucket: R2_BUCKET,
    region: R2_REGION,
    forcePathStyle: R2_S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  };
}

function getR2Client(): S3Client {
  if (r2Client) return r2Client;
  const config = getR2Config();
  if (!config) {
    throw new Error(
      "R2 nicht konfiguriert: R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env setzen."
    );
  }
  r2Client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: config.credentials,
  });
  r2Bucket = config.bucket;
  return r2Client;
}

function getBucket(): string {
  getR2Client();
  return r2Bucket!;
}

/** Gibt an, ob R2 konfiguriert ist (ohne Client zu erzeugen). */
export function isR2Configured(): boolean {
  return getR2Config() !== null;
}

/* --------------------------------------
 * Namespaces / Präfixe
 * ------------------------------------ */
export const StoragePrefix = {
  TMDB: "tmdb",
  UPLOADS: "uploads",
  USER: "uploads/users",
  USER_AVATARS: "uploads/users/avatars",
  USER_BANNERS: "uploads/users/banners",
} as const;

export type TmdbSize =
  | "w92"
  | "w154"
  | "w185"
  | "w342"
  | "w500"
  | "w780"
  | "w1280"
  | "original";

/* --------------------------------------
 * Key + URL Helper
 * ------------------------------------ */
export function normalizeKey(
  ...parts: (string | number | undefined | null)[]
): string {
  const p = parts
    .filter(Boolean)
    .map((x) => String(x).replace(/^\/+|\/+$/g, ""))
    .filter((x) => x.length > 0);
  return p.join("/");
}

export function toPublicUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (/^https?:\/\//i.test(key)) return key;
  const k = String(key).replace(/^\/+/, "");
  const base = R2_PUBLIC_BASE_URL.replace(/^['"]|['"]$/g, "").replace(
    /\/+$/,
    ""
  );
  return base ? `${base}/${k}` : `/${k}`;
}

/* --------------------------------------
 * Redis-Cache für exists()
 * ------------------------------------ */
function existsCacheKey(key: string): string {
  return `${R2_EXISTS_CACHE_PREFIX}${key}`;
}

async function invalidateExistsCache(key: string): Promise<void> {
  await cacheDelete(existsCacheKey(key));
}

/* --------------------------------------
 * HEAD / exists (mit Redis-Cache)
 * ------------------------------------ */
export async function headObject(
  key: string
): Promise<HeadObjectCommandOutput | null> {
  const client = getR2Client();
  try {
    return await client.send(
      new HeadObjectCommand({ Bucket: getBucket(), Key: key })
    );
  } catch (e: unknown) {
    const code = (e as { $metadata?: { httpStatusCode?: number } })
      ?.$metadata?.httpStatusCode;
    if (code === 404) return null;
    throw e;
  }
}

export async function exists(key: string): Promise<boolean> {
  const cacheKey = existsCacheKey(key);
  const cached = await cacheGet<string>(cacheKey);
  if (cached === "1") return true;
  if (cached === "0") return false;

  const h = await headObject(key);
  const result = h != null;
  await cacheSet(cacheKey, result ? "1" : "0", R2_EXISTS_CACHE_TTL);
  return result;
}

/** Prüft, ob ein TMDb-Key bereits in R2 liegt (Redis-Cache 24h). */
async function tmdbKeyExistsCached(key: string): Promise<boolean> {
  const cacheKey = `r2:tmdb:${key}`;
  const cached = await cacheGet<string>(cacheKey);
  if (cached === "1") return true;
  const result = await exists(key);
  if (result) await cacheSet(cacheKey, "1", R2_TMDB_KEY_CACHE_TTL);
  return result;
}

/* --------------------------------------
 * Body-Typen
 * ------------------------------------ */
export type BodyInput =
  | Buffer
  | Uint8Array
  | ArrayBuffer
  | string
  | NodeReadable;

function toSdkBody(body: BodyInput): PutObjectCommandInput["Body"] {
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  return body as PutObjectCommandInput["Body"];
}

async function sha256OfBufferish(body: BodyInput): Promise<string> {
  const hash = createHash("sha256");
  if (typeof body === "string") {
    hash.update(body);
  } else if (body instanceof Buffer || body instanceof Uint8Array) {
    hash.update(body);
  } else if (body instanceof ArrayBuffer) {
    hash.update(new Uint8Array(body));
  } else {
    await new Promise<void>((resolve, reject) => {
      body
        .on("data", (chunk: Buffer) => hash.update(chunk))
        .on("end", resolve)
        .on("error", reject);
    });
  }
  return hash.digest("hex");
}

function getBodySize(body: BodyInput): number | "unknown" {
  if (body instanceof Buffer) return body.length;
  if (body instanceof Uint8Array) return body.length;
  if (body instanceof ArrayBuffer) return body.byteLength;
  return "unknown";
}

/* --------------------------------------
 * Put / Get / Delete / SignedURL
 * ------------------------------------ */
export async function putObject(params: {
  key: string;
  body: BodyInput;
  contentType?: string;
  cacheControl?: string;
  sha256?: string;
  skipIfSameHash?: boolean;
  extraMetadata?: Record<string, string>;
}): Promise<void> {
  const {
    key,
    body,
    contentType,
    cacheControl,
    sha256,
    skipIfSameHash = false,
    extraMetadata,
  } = params;

  if (DEBUG_R2) {
    console.log(`[R2 putObject] START Key: ${key}, Size: ${getBodySize(body)}`);
  }

  const client = getR2Client();

  if (skipIfSameHash && sha256) {
    const h = await headObject(key);
    if (h?.Metadata?.["cv-sha256"] === sha256) {
      if (DEBUG_R2) console.log(`[R2 putObject] SKIP gleicher SHA256: ${key}`);
      return;
    }
  }

  const metadata: Record<string, string> = {};
  if (sha256) metadata["cv-sha256"] = sha256;
  if (extraMetadata) {
    for (const [k, v] of Object.entries(extraMetadata)) {
      metadata[k.toLowerCase()] = String(v);
    }
  }

  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: toSdkBody(body),
      ContentType: contentType,
      CacheControl: cacheControl,
      Metadata: Object.keys(metadata).length ? metadata : undefined,
    })
  );

  await invalidateExistsCache(key);
  if (DEBUG_R2) console.log(`[R2 putObject] SUCCESS ${key}`);
}

export async function getObject(key: string): Promise<NodeReadable | null> {
  const client = getR2Client();
  const res = await client.send(
    new GetObjectCommand({ Bucket: getBucket(), Key: key })
  );
  return (res.Body as NodeReadable) ?? null;
}

/** Liest ein R2-Objekt komplett in einen Buffer (z. B. für Accent-Berechnung). */
export async function getObjectAsBuffer(key: string): Promise<Buffer | null> {
  const stream = await getObject(key);
  if (!stream) return null;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function deleteObject(key: string): Promise<void> {
  const client = getR2Client();
  await client.send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: key })
  );
  await invalidateExistsCache(key);
}

/** Redis-TTL für Signed URLs: etwas kürzer als Ablauf, damit keine abgelaufene URL aus Cache kommt. */
const SIGNED_URL_CACHE_BUFFER = 120;

export async function getSignedUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  const cacheKey = `r2:signed:${key}:${expiresInSeconds}`;
  const ttl = Math.max(60, expiresInSeconds - SIGNED_URL_CACHE_BUFFER);
  const cached = await cacheGet<string>(cacheKey);
  if (cached) return cached;
  const client = getR2Client();
  const cmd = new GetObjectCommand({ Bucket: getBucket(), Key: key });
  const url = await awsGetSignedUrl(client, cmd, { expiresIn: expiresInSeconds });
  await cacheSet(cacheKey, url, ttl);
  return url;
}

/* --------------------------------------
 * User Avatar / Banner (DRY + Purge)
 * ------------------------------------ */
function guessContentType(extOrName: string): string {
  const ext = extOrName.toLowerCase().replace(/^\./, "");
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    avif: "image/avif",
  };
  return map[ext] ?? "application/octet-stream";
}

async function saveUserMediaWithDedupAndPurge(
  params: {
    userId: number | string;
    data: BodyInput;
    ext: string;
    contentType?: string;
  },
  prefix: string
): Promise<string> {
  const key = normalizeKey(
    prefix,
    `${params.userId}.${params.ext.replace(/^\./, "")}`
  );
  const contentType =
    params.contentType ?? guessContentType(params.ext);
  const newSha = await sha256OfBufferish(params.data);

  if (DEBUG_R2) {
    console.log(
      `[saveUserMedia] Key: ${key}, SHA256: ${newSha.substring(0, 16)}...`
    );
  }

  const existing = await headObject(key);
  if (existing?.Metadata?.["cv-sha256"] === newSha) {
    if (DEBUG_R2) console.log(`[saveUserMedia] SKIP identisch: ${key}`);
    return key;
  }
  if (existing) {
    await deleteObject(key);
  }

  await putObject({
    key,
    body: params.data,
    contentType,
    cacheControl: "public, max-age=0, must-revalidate",
    sha256: newSha,
  });

  const publicUrl = toPublicUrl(key);
  if (publicUrl) await purgeCloudflareCache(publicUrl);

  if (DEBUG_R2) console.log(`[saveUserMedia] Upload OK: ${key}`);
  return key;
}

export async function saveUserAvatar(params: {
  userId: number | string;
  data: BodyInput;
  ext: string;
  contentType?: string;
}): Promise<string> {
  return saveUserMediaWithDedupAndPurge(params, StoragePrefix.USER_AVATARS);
}

export async function saveUserBanner(params: {
  userId: number | string;
  data: BodyInput;
  ext: string;
  contentType?: string;
}): Promise<string> {
  return saveUserMediaWithDedupAndPurge(params, StoragePrefix.USER_BANNERS);
}

/* --------------------------------------
 * TMDb Pull-Through (mit Redis-Cache für „key existiert“)
 * ------------------------------------ */
export function tmdbKey(filePath: string, size: TmdbSize = "original"): string {
  return normalizeKey(StoragePrefix.TMDB, size, filePath);
}

export async function ensureTmdbCached(params: {
  filePath: string;
  size?: TmdbSize;
  contentTypeHint?: string;
  longCache?: boolean;
}): Promise<string> {
  const {
    filePath,
    size = "original",
    contentTypeHint,
    longCache = true,
  } = params;

  const cleanPath = String(filePath).replace(/^\/+/, "");
  const key = tmdbKey(cleanPath, size);

  if (await tmdbKeyExistsCached(key)) {
    const h = await headObject(key);
    if (h != null) return key;
    // Cache sagt „existiert“, Objekt fehlt in R2 (z. B. anderer Bucket, gelöscht) → Cache löschen und neu laden
    await cacheDelete(`r2:tmdb:${key}`);
    await invalidateExistsCache(key);
  }

  const srcUrl = `${TMDB_IMAGE_BASE_URL}/${size}/${cleanPath}`;
  const userAgent = `CineVault/1.0 (+${APP_URL})`;
  const maxRetries = 4;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);

    try {
      const resp = await fetch(srcUrl, {
        signal: controller.signal,
        headers: { "User-Agent": userAgent },
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        throw new Error(`TMDb HTTP ${resp.status} ${resp.statusText}`);
      }
      const arr = await resp.arrayBuffer();
      if (arr.byteLength === 0) throw new Error("Empty image body");

      const buf = Buffer.from(arr);
      const contentType =
        resp.headers.get("content-type") ??
        contentTypeHint ??
        "image/jpeg";
      const sha = createHash("sha256").update(buf).digest("hex");

      await putObject({
        key,
        body: buf,
        contentType,
        cacheControl: longCache
          ? "public, max-age=31536000, immutable"
          : "public, max-age=86400",
        sha256: sha,
        skipIfSameHash: true,
      });

      await cacheSet(`r2:tmdb:${key}`, "1", R2_TMDB_KEY_CACHE_TTL);
      return key;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;
      const isTimeout =
        err instanceof Error &&
        (err.name === "AbortError" ||
          (err as { code?: string }).code === "UND_ERR_CONNECT_TIMEOUT");
      if (DEBUG_R2) {
        console.warn(
          `[TMDb Cache] Versuch ${attempt}/${maxRetries}${isTimeout ? " (Timeout)" : ""}: ${srcUrl} → ${err instanceof Error ? err.message : err}`
        );
      }
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * attempt * attempt));
      }
    }
  }

  throw new Error(
    `TMDb-Bild nach ${maxRetries} Versuchen nicht ladbar: ${srcUrl} – ${lastError instanceof Error ? lastError.message : lastError}`
  );
}
