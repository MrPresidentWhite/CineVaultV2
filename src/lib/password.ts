/**
 * Passwort-Hashing und -Verifikation mit Argon2id.
 * Nutzt ARGON2_* und PASSWORD_PEPPER aus der Umgebung.
 */

import argon2 from "argon2";
import {
  ARGON2_HASH_LENGTH,
  ARGON2_MEMORY_KIB,
  ARGON2_PARALLELISM,
  ARGON2_TIME_COST,
  PASSWORD_PEPPER,
} from "./env";

const argon2Options: argon2.Options = {
  type: argon2.argon2id,
  timeCost: ARGON2_TIME_COST,
  memoryCost: ARGON2_MEMORY_KIB,
  parallelism: ARGON2_PARALLELISM,
  hashLength: ARGON2_HASH_LENGTH,
};

/**
 * Hasht ein Klartext-Passwort mit Argon2id (inkl. optionalem Pepper).
 * @param plain Klartext-Passwort
 * @returns Argon2id-Hash-String (für DB)
 */
export async function hashPassword(plain: string): Promise<string> {
  const toHash = PASSWORD_PEPPER ? plain + PASSWORD_PEPPER : plain;
  return argon2.hash(toHash, argon2Options);
}

/**
 * Prüft ein Klartext-Passwort gegen einen gespeicherten Argon2id-Hash.
 * @param plain Klartext-Passwort
 * @param storedHash In der DB gespeicherter Hash
 * @returns true wenn Passwort stimmt
 */
export async function verifyPassword(
  plain: string,
  storedHash: string
): Promise<boolean> {
  const toVerify = PASSWORD_PEPPER ? plain + PASSWORD_PEPPER : plain;
  return argon2.verify(storedHash, toVerify);
}

/**
 * Prüft, ob ein Hash mit den aktuellen Argon2-Optionen neu gehasht werden sollte
 * (z. B. nach Erhöhung von timeCost/memoryCost oder Pepper-Wechsel).
 */
export async function needsRehash(hash: string): Promise<boolean> {
  return argon2.needsRehash(hash, argon2Options);
}
