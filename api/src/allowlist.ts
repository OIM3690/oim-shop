// Who may sign in. The server's allowlist file holds one GitHub login per
// line, optionally followed by the word "manager"; a line starting with # is
// a comment. The file is read at every sign-in, so a change takes effect at
// the person's next sign-in, and it lives only on the server.
import { readFileSync } from "node:fs";

export type Role = "rep" | "manager";

/** Logins (lowercased, as GitHub treats them) and their roles. A line with any other word is skipped. */
export function parseAllowlist(text: string): Map<string, Role> {
  const list = new Map<string, Role>();
  for (const line of text.split("\n")) {
    const words = line.trim().split(/\s+/);
    const [login, role, ...rest] = words;
    if (!login || login.startsWith("#") || rest.length > 0) continue;
    if (role === undefined) list.set(login.toLowerCase(), "rep");
    else if (role === "manager") list.set(login.toLowerCase(), "manager");
  }
  return list;
}

/**
 * The role a GitHub login signs in with, or null if it may not sign in.
 * Without a file, as on your own machine, anyone signs in as a rep. With a
 * file the server cannot read, no one signs in.
 */
export function roleFor(file: string | undefined, login: string): Role | null {
  if (!file) return "rep";
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return null;
  }
  return parseAllowlist(text).get(login.toLowerCase()) ?? null;
}
