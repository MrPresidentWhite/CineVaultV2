/**
 * API v1 Session-Store (Redis).
 * Nach erfolgreicher Challenge-Response-Auth: Session für /api/v1/* Requests.
 */

import { getRedis } from "@/lib/redis";
import {
  API_SESSION_COOKIE_NAME,
  API_SESSION_TTL_SEC,
  API_SESSION_KEY_PREFIX,
} from "./config";

export type ApiSessionData = {
  userId: number;
  apiKeyId: string;
};

export async function getApiSession(sid: string): Promise<ApiSessionData | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(API_SESSION_KEY_PREFIX + sid);
    if (!raw) return null;
    const data = JSON.parse(raw) as ApiSessionData;
    if (typeof data.userId !== "number" || typeof data.apiKeyId !== "string")
      return null;
    return data;
  } catch {
    return null;
  }
}

export async function setApiSession(
  sid: string,
  data: ApiSessionData
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.setex(
      API_SESSION_KEY_PREFIX + sid,
      API_SESSION_TTL_SEC,
      JSON.stringify(data)
    );
  } catch {
    // ignore
  }
}

export async function destroyApiSession(sid: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(API_SESSION_KEY_PREFIX + sid);
  } catch {
    // ignore
  }
}

/**
 * Liest die API v1 Session aus dem Request (Cookie cv.api_sid).
 * Für geschützte /api/v1/* Routen: bei null 401 zurückgeben.
 */
export async function getApiSessionFromRequest(
  request: Request
): Promise<ApiSessionData | null> {
  const sid = request.cookies.get(API_SESSION_COOKIE_NAME)?.value;
  if (!sid) return null;
  return getApiSession(sid);
}

export { API_SESSION_COOKIE_NAME, API_SESSION_TTL_SEC };
