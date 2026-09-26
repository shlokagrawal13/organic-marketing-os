import "./isolated";
import { PrismaClient, Role } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { token, digest, hashPassword } from "../../packages/core/security";
export const db = new PrismaClient();
export const base = process.env.TEST_API_URL || "http://127.0.0.1:4000/api";
export async function actor(org: string | null, role: Role = "OWNER") {
  const raw = token();
  const user = await db.user.create({
    data: {
      name: "Verification actor",
      email: `qa-${randomUUID()}@example.test`,
      passwordHash: await hashPassword("Verification-only password 123"),
    },
  });
  if (org)
    await db.membership.create({
      data: { userId: user.id, organizationId: org, role },
    });
  await db.session.create({
    data: {
      userId: user.id,
      tokenHash: digest(raw),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const headers = {
    cookie: `mos_session=${raw}`,
    "X-Requested-With": "MarketingOS",
  };
  return {
    id: user.id,
    headers,
    async call(path: string, method = "GET", body?: unknown) {
      const res = await fetch(base + path, {
        method,
        headers: { ...headers, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: res.status, body: await res.json() };
    },
  };
}
export async function until<T>(
  fn: () => Promise<T>,
  good: (r: T) => boolean,
  timeout = 15000,
) {
  const end = Date.now() + timeout;
  let last: T;
  do {
    last = await fn();
    if (good(last)) return last;
    await new Promise((r) => setTimeout(r, 150));
  } while (Date.now() < end);
  throw new Error("Timed out waiting for state: " + JSON.stringify(last));
}
export const draft = {
  title: "QA factual draft",
  platform: "LinkedIn",
  format: "Text",
  hook: "A useful question",
  body: "A factual explanation without performance promises.",
  cta: "Share your thoughts",
  scenes: [],
};
export const scene = {
  id: "opening",
  purpose: "Introduction",
  duration: 2,
  voiceover: "",
  visual: "Text card",
  onScreenText: "Verification",
  caption: "",
  transition: "Cut",
  music: "",
  sfx: "",
  cta: "",
  visualAssetId: null,
  audioAssetId: null,
};
