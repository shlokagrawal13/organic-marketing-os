import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
export const token = () => randomBytes(32).toString("hex");
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, encoded] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !encoded) return false;
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(encoded, "hex");
  return expected.length === hash.length && timingSafeEqual(expected, hash);
}
export const roles = [
  "OWNER",
  "ADMIN",
  "EDITOR",
  "CREATOR",
  "ANALYST",
  "CLIENT",
] as const;
export function canEdit(role: string) {
  return ["OWNER", "ADMIN", "EDITOR", "CREATOR"].includes(role);
}
export function canApprove(role: string) {
  return ["OWNER", "ADMIN", "EDITOR"].includes(role);
}
