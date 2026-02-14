/**
 * Validierung: Wenn „Größe nachher“ (sizeAfterBytes) gesetzt ist,
 * muss auch „Größe vorher“ (sizeBeforeBytes) gesetzt sein.
 * Vgl. Issue #2
 */
export const SIZE_VALIDATION_ERROR_MESSAGE =
  "Wenn „Größe nachher“ ausgefüllt ist, muss auch „Größe vorher“ ausgefüllt sein.";

export function validateSizeBeforeWhenSizeAfter(
  sizeAfter: bigint | null,
  sizeBefore: bigint | null
): string | null {
  if (sizeAfter == null || sizeAfter <= BigInt(0)) return null;
  if (sizeBefore != null && sizeBefore > BigInt(0)) return null;
  return SIZE_VALIDATION_ERROR_MESSAGE;
}

/** Frontend-Helper: prüft ob Validierungsfehler vorliegt (Number-Werte aus Formular) */
export function hasSizeValidationError(
  sizeAfter: number,
  sizeBefore: number
): boolean {
  return sizeAfter > 0 && sizeBefore <= 0;
}
