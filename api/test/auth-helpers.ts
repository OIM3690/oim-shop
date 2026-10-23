// Stand-ins for GitHub's OAuth endpoints, and a helper that signs a user in
// through the real flow: /api/auth/github, then the callback with GitHub's code.
import { http, HttpResponse } from "msw";
import type { Hono } from "hono";

export function fakeGitHub(users: Record<string, number>) {
  return [
    http.post("https://github.com/login/oauth/access_token", async ({ request }) => {
      const code = new URLSearchParams(await request.text()).get("code") ?? "";
      if (!(code in users)) return HttpResponse.json({ error: "bad_verification_code" });
      return HttpResponse.json({ access_token: `token-${code}`, token_type: "bearer", scope: "" });
    }),
    http.get("https://api.github.com/user", ({ request }) => {
      const code = request.headers.get("Authorization")?.replace("Bearer token-", "") ?? "";
      if (!(code in users)) return HttpResponse.json({ message: "Bad credentials" }, { status: 401 });
      // GitHub sends more than this, including the login; the app keeps only the id.
      return HttpResponse.json({ id: users[code], login: `user-${code}`, email: `${code}@example.com` });
    }),
  ];
}

export const ORIGIN = "http://localhost:5173";

const cookieValue = (setCookie: string[], name: string) =>
  setCookie.map((c) => c.split(";")[0]).find((c) => c.startsWith(`${name}=`));

/** Goes through sign-in with the given GitHub code and returns the session cookie. */
export async function signIn(app: Hono, code: string) {
  const start = await app.request("/api/auth/github");
  const state = new URL(start.headers.get("Location")!).searchParams.get("state");
  const stateCookie = cookieValue(start.headers.getSetCookie(), "oauth_state")!;
  const callback = await app.request(`/api/auth/github/callback?code=${code}&state=${state}`, {
    headers: { Cookie: stateCookie },
  });
  const session = cookieValue(callback.headers.getSetCookie(), "session");
  return { callback, cookie: session ?? "" };
}

/** A request as a signed-in browser makes it: with the cookie and its own Origin. */
export function as(cookie: string, init: RequestInit & { json?: unknown } = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Cookie", cookie);
  headers.set("Origin", ORIGIN);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  return { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body };
}
