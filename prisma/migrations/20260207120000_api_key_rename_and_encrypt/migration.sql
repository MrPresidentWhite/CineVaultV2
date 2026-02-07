-- Rename columns for clarity and to reflect encrypted storage of verification key
ALTER TABLE "ApiKey" RENAME COLUMN "sshPublicKey" TO "keyContentHash";
ALTER TABLE "ApiKey" RENAME COLUMN "publicKeySsh" TO "verificationKeyEncrypted";
