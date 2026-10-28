// Sessions: the browser holds a random token in an HttpOnly cookie, and the
// database holds only its SHA-256, so a copy of the database cannot be used
// to sign in as anyone.
import { createHash, randomBytes } from "node:crypto";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Role } from "./allowlist.ts";
import type { Database } from "./db.ts";

export const SESSION_COOKIE = "session";
const SESSION_DAYS = 30;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export interface SessionUser {
  user_id: number;
  employee_id: number | null;
  role: Role;
}

/** Stores a new session for the user and returns its token, which only the cookie will hold. */
export function createSession(db: Database, userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
    hash(token),
    userId,
    expires.toISOString(),
  );
  return { token, expires };
}

export function startSession(c: Context, db: Database, userId: number, secure: boolean) {
  const { token, expires } = createSession(db, userId);
  setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure, sameSite: "Lax", path: "/", expires });
}

export function readSession(c: Context, db: Database): SessionUser | null {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT s.user_id, e.employee_id, u.role FROM sessions s JOIN users u USING (user_id)
         LEFT JOIN employees e USING (user_id)
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(hash(token), new Date().toISOString());
  if (!row) return null;
  return {
    user_id: Number(row.user_id),
    employee_id: row.employee_id === null ? null : Number(row.employee_id),
    role: row.role === "manager" ? "manager" : "rep",
  };
}

export function endSession(c: Context, db: Database) {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hash(token));
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}
