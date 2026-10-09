import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type SocialTokenContext = {
  organizationId: string;
  provider: "YOUTUBE";
  externalAccountId: string;
};

function key(encoded: string | undefined) {
  if (!encoded || !/^[A-Za-z0-9+/]{43}=$/.test(encoded))
    throw new Error(
      "SOCIAL_TOKEN_ENCRYPTION_KEY must be 32 base64-encoded bytes.",
    );
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length !== 32 || bytes.toString("base64") !== encoded)
    throw new Error(
      "SOCIAL_TOKEN_ENCRYPTION_KEY must be 32 base64-encoded bytes.",
    );
  return bytes;
}

function aad(context: SocialTokenContext) {
  if (
    !context.organizationId ||
    !context.externalAccountId ||
    context.provider !== "YOUTUBE"
  )
    throw new Error("A complete social account identity is required.");
  return Buffer.from(
    JSON.stringify([
      "social-token-v1",
      context.organizationId,
      context.provider,
      context.externalAccountId,
    ]),
  );
}

export function encryptSocialToken(
  plaintext: string,
  context: SocialTokenContext,
  encodedKey = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY,
) {
  if (!plaintext) throw new Error("An empty social token cannot be stored.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(encodedKey), iv);
  cipher.setAAD(aad(context));
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptSocialToken(
  encoded: string,
  context: SocialTokenContext,
  encodedKey = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY,
) {
  const [version, ivRaw, tagRaw, contentRaw, extra] = encoded.split(":");
  if (version !== "v1" || !ivRaw || !tagRaw || !contentRaw || extra)
    throw new Error("Social token envelope is invalid.");
  const iv = Buffer.from(ivRaw, "base64url");
  const tag = Buffer.from(tagRaw, "base64url");
  if (iv.length !== 12 || tag.length !== 16)
    throw new Error("Social token envelope is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", key(encodedKey), iv);
  decipher.setAAD(aad(context));
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([
      decipher.update(Buffer.from(contentRaw, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Social token authentication failed.");
  }
}
