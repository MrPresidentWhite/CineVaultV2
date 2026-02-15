/**
 * WebAuthn challenge storage in Redis.
 * Challenges must be stored between options generation and response verification.
 * TTL: 5 minutes.
 */

import { randomBytes } from "node:crypto";
import { getRedis } from "./redis";

/** Cookie for auth challenge (user not logged in). */
export const WEBAUTHN_CHALLENGE_COOKIE_NAME = "cv.webauthn.challenge";

const PREFIX_REG = "webauthn:reg:";
const PREFIX_AUTH = "webauthn:auth:";
const TTL_SEC = 300; // 5 minutes

export type RegistrationChallengePayload = {
  challenge: string;
  webauthnUserId: string;
};

export async function setRegistrationChallenge(
  sessionId: string,
  challenge: string,
  webauthnUserId: string
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const payload: RegistrationChallengePayload = { challenge, webauthnUserId };
    await redis.setex(PREFIX_REG + sessionId, TTL_SEC, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export async function getRegistrationChallenge(
  sessionId: string
): Promise<RegistrationChallengePayload | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const val = await redis.get(PREFIX_REG + sessionId);
    if (!val) return null;
    await redis.del(PREFIX_REG + sessionId);
    return JSON.parse(val) as RegistrationChallengePayload;
  } catch {
    return null;
  }
}

export async function setAuthenticationChallenge(
  sessionId: string,
  challenge: string
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    await redis.setex(PREFIX_AUTH + sessionId, TTL_SEC, challenge);
    return true;
  } catch {
    return false;
  }
}

export async function getAuthenticationChallenge(
  sessionId: string
): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const val = await redis.get(PREFIX_AUTH + sessionId);
    if (!val) return null;
    await redis.del(PREFIX_AUTH + sessionId);
    return val;
  } catch {
    return null;
  }
}

/** Generates a random ID for the auth challenge cookie (user not logged in). */
export function generateChallengeSessionId(): string {
  return randomBytes(24).toString("base64url");
}
