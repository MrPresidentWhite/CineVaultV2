declare module "sshpk" {
  export interface ParsedKey {
    type: string;
    comment?: string;
    fingerprint(algo?: string, type?: string): { toString(format?: string): string };
    createVerify(hashAlgo?: string): {
      update(data: string | Buffer, encoding?: string): void;
      verify(signature: unknown, format?: string): boolean;
    };
    toString(format?: string): string;
  }

  export interface ParsedSignature {
    type: string;
  }

  export function parseKey(
    data: string,
    format?: string,
    options?: { passphrase?: string; filename?: string }
  ): ParsedKey;

  export function parseSignature(
    data: string | Buffer,
    type: string,
    format: string
  ): ParsedSignature;
}
