import { v4 as uuidv4 } from "uuid";
import { createHash, randomBytes } from "crypto";

export function generateWebhookToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateId(): string {
  return uuidv4();
}
