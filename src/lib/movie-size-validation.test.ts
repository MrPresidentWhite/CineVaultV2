import { describe, it, expect } from "vitest";
import {
  validateSizeBeforeWhenSizeAfter,
  hasSizeValidationError,
  SIZE_VALIDATION_ERROR_MESSAGE,
} from "./movie-size-validation";

describe("validateSizeBeforeWhenSizeAfter (Issue #2)", () => {
  it("gibt null zurück wenn Größe nachher nicht gesetzt", () => {
    expect(validateSizeBeforeWhenSizeAfter(null, null)).toBeNull();
    expect(validateSizeBeforeWhenSizeAfter(null, BigInt(100))).toBeNull();
    expect(validateSizeBeforeWhenSizeAfter(BigInt(0), null)).toBeNull();
    expect(validateSizeBeforeWhenSizeAfter(BigInt(0), BigInt(50))).toBeNull();
  });

  it("gibt SIZE_VALIDATION_ERROR_MESSAGE zurück wenn Größe nachher gesetzt, Größe vorher fehlt", () => {
    expect(validateSizeBeforeWhenSizeAfter(BigInt(100), null)).toBe(
      SIZE_VALIDATION_ERROR_MESSAGE
    );
    expect(validateSizeBeforeWhenSizeAfter(BigInt(1), null)).toBe(
      SIZE_VALIDATION_ERROR_MESSAGE
    );
    expect(validateSizeBeforeWhenSizeAfter(BigInt(80530636800), null)).toBe(
      SIZE_VALIDATION_ERROR_MESSAGE
    );
  });

  it("gibt SIZE_VALIDATION_ERROR_MESSAGE zurück wenn Größe nachher gesetzt, Größe vorher ist 0", () => {
    expect(validateSizeBeforeWhenSizeAfter(BigInt(100), BigInt(0))).toBe(
      SIZE_VALIDATION_ERROR_MESSAGE
    );
  });

  it("gibt null zurück wenn beide gesetzt sind", () => {
    expect(validateSizeBeforeWhenSizeAfter(BigInt(80), BigInt(100))).toBeNull();
    expect(validateSizeBeforeWhenSizeAfter(BigInt(1), BigInt(1))).toBeNull();
    expect(
      validateSizeBeforeWhenSizeAfter(BigInt(69835161600), BigInt(80530636800))
    ).toBeNull();
  });
});

describe("hasSizeValidationError (Frontend)", () => {
  it("gibt true wenn Größe nachher > 0 und Größe vorher <= 0", () => {
    expect(hasSizeValidationError(100, 0)).toBe(true);
    expect(hasSizeValidationError(1, 0)).toBe(true);
    expect(hasSizeValidationError(100, -1)).toBe(true);
  });

  it("gibt false wenn Größe nachher nicht gesetzt oder beide ok", () => {
    expect(hasSizeValidationError(0, 0)).toBe(false);
    expect(hasSizeValidationError(0, 100)).toBe(false);
    expect(hasSizeValidationError(80, 100)).toBe(false);
  });
});
