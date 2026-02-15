/**
 * Validation: when sizeAfterBytes is set, sizeBeforeBytes must also be set.
 * See Issue #2.
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

/** Frontend helper: check if validation error (number values from form). */
export function hasSizeValidationError(
  sizeAfter: number,
  sizeBefore: number
): boolean {
  return sizeAfter > 0 && sizeBefore <= 0;
}
