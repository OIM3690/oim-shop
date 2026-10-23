// Sign-in with a GitHub OAuth App. The app asks GitHub for no scopes, so it
// can read only a user's public profile, and of that it keeps the numeric
// user ID alone: no email, no username.
import { GitHub, generateState } from "arctic";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type { AppEnv } from "../app.ts";
import { endSession, startSession } from "../session.ts";

const STATE_COOKIE = "oauth_state";
const githubUser = z.object({ id: z.number().int().positive() });

export const auth = new Hono<AppEnv>()
  .get("/github", (c) => {
    const state = generateState();
    const { publicUrl } = c.var.settings;
    setCookie(c, STATE_COOKIE, state, {
      httpOnly: true,
      secure: publicUrl.startsWith("https://"),
      sameSite: "Lax",
      path: "/api/auth",
      maxAge: 10 * 60,
    });
    return c.redirect(client(c.var.settings).createAuthorizationURL(state, []).toString());
  })
  .get("/github/callback", async (c) => {
    const { code, state } = c.req.query();
    const expected = getCookie(c, STATE_COOKIE);
    deleteCookie(c, STATE_COOKIE, { path: "/api/auth" });
    if (!code || !state || !expected || state !== expected) {
      return c.json({ detail: "Sign-in could not be checked. Start again from the sign-in button." }, 400);
    }

    let githubId: number;
    try {
      const tokens = await client(c.var.settings).validateAuthorizationCode(code);
      const response = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${tokens.accessToken()}`, "User-Agent": "oim-shop" },
      });
      if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
      githubId = githubUser.parse(await response.json()).id;
    } catch {
      return c.json(
        { detail: "GitHub did not confirm the sign-in. Start again from the sign-in button." },
        400,
      );
    }

    const db = c.var.db;
    db.prepare(
      "INSERT INTO users (github_id, created_at) VALUES (?, ?) ON CONFLICT (github_id) DO NOTHING",
    ).run(githubId, c.var.now());
    const user = db
      .prepare(
        "SELECT u.user_id, e.employee_id FROM users u LEFT JOIN employees e USING (user_id) WHERE github_id = ?",
      )
      .get(githubId)!;
    startSession(c, db, Number(user.user_id), c.var.settings.publicUrl.startsWith("https://"));
    // A new rep first chooses the name other people will see.
    return c.redirect(`${c.var.settings.publicUrl}${user.employee_id === null ? "/welcome" : "/"}`);
  })
  .post("/logout", (c) => {
    endSession(c, c.var.db);
    return c.body(null, 204);
  });

function client(settings: AppEnv["Variables"]["settings"]) {
  return new GitHub(
    settings.github.clientId,
    settings.github.clientSecret,
    `${settings.publicUrl}/api/auth/github/callback`,
  );
}
