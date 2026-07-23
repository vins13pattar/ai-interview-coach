import { randomBytes } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  decryptProviderSecret,
  encryptProviderSecret,
  providerEncryptionConfigured,
} from "./crypto";

describe("provider secret encryption", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips with authenticated encryption and a random nonce", () => {
    vi.stubEnv("PROVIDER_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
    const plaintext = "fixture-provider-secret-never-store-in-plaintext";

    const first = encryptProviderSecret(plaintext);
    const second = encryptProviderSecret(plaintext);

    expect(providerEncryptionConfigured()).toBe(true);
    expect(first.encryptedSecret).not.toContain(plaintext);
    expect(first.encryptedSecret).not.toBe(second.encryptedSecret);
    expect(decryptProviderSecret(first.encryptedSecret)).toBe(plaintext);
  });

  it("rejects tampered ciphertext", () => {
    vi.stubEnv("PROVIDER_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
    const encrypted = encryptProviderSecret("fixture-tamper-detection-secret");
    const replacement = encrypted.encryptedSecret.endsWith("A") ? "B" : "A";
    const tampered = `${encrypted.encryptedSecret.slice(0, -1)}${replacement}`;

    expect(() => decryptProviderSecret(tampered)).toThrow();
  });

  it("remains unavailable without an operator-managed key", () => {
    vi.stubEnv("PROVIDER_ENCRYPTION_KEY", "");

    expect(providerEncryptionConfigured()).toBe(false);
    expect(() => encryptProviderSecret("fixture-unconfigured-secret")).toThrow(
      "PROVIDER_ENCRYPTION_NOT_CONFIGURED",
    );
  });
});
