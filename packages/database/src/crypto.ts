import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_VERSION = "v1";

function encryptionKey(): Buffer {
  const encoded = process.env.PROVIDER_ENCRYPTION_KEY;
  if (!encoded) {
    throw new Error("PROVIDER_ENCRYPTION_NOT_CONFIGURED");
  }

  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error("PROVIDER_ENCRYPTION_KEY_INVALID");
  }
  return key;
}

export function providerEncryptionConfigured(): boolean {
  const encoded = process.env.PROVIDER_ENCRYPTION_KEY;
  if (!encoded) return false;
  return Buffer.from(encoded, "base64").length === 32;
}

export function encryptProviderSecret(secret: string): {
  encryptedSecret: string;
  keyVersion: string;
} {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv(
    ALGORITHM,
    encryptionKey(),
    initializationVector,
  );
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const authenticationTag = cipher.getAuthTag();

  return {
    encryptedSecret: [
      KEY_VERSION,
      initializationVector.toString("base64url"),
      authenticationTag.toString("base64url"),
      ciphertext.toString("base64url"),
    ].join("."),
    keyVersion: KEY_VERSION,
  };
}

export function decryptProviderSecret(payload: string): string {
  const [version, initializationVector, authenticationTag, ciphertext] =
    payload.split(".");
  if (
    version !== KEY_VERSION ||
    !initializationVector ||
    !authenticationTag ||
    !ciphertext
  ) {
    throw new Error("PROVIDER_SECRET_FORMAT_INVALID");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey(),
    Buffer.from(initializationVector, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(authenticationTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
