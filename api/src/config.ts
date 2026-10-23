// Every setting comes from the environment, with a default that works on
// your own machine. Production sets them in the server's environment file.
import { z } from "zod";

const env = z
  .object({
    DATABASE_PATH: z.string().default("shop.db"),
    OIM_API_BASE: z.url().default("https://oim.zhili.dev/shop"),
    PORT: z.coerce.number().int().min(1).max(65535).default(8787),
    HOST: z.string().default("127.0.0.1"),
    /** The address people open, such as https://oim-shop-js.zhili.dev. Sign-in returns here. */
    PUBLIC_URL: z.url().default("http://localhost:5173"),
    /** The built web app to serve next to /api; empty in development, where Vite serves it. */
    WEB_DIST: z.string().default(""),
    /** Set to cf-connecting-ip behind Cloudflare, so rate limits count visitors and not the proxy. */
    CLIENT_IP_HEADER: z.string().default(""),
    GITHUB_CLIENT_ID: z.string().default(""),
    GITHUB_CLIENT_SECRET: z.string().default(""),
    /** Both or neither: a self-hosted Umami's script and this site's ID there. Unset, nothing is counted. */
    UMAMI_SCRIPT_URL: z.url().optional(),
    UMAMI_WEBSITE_ID: z.uuid().optional(),
  })
  .refine((e) => Boolean(e.UMAMI_SCRIPT_URL) === Boolean(e.UMAMI_WEBSITE_ID), {
    message: "Set UMAMI_SCRIPT_URL and UMAMI_WEBSITE_ID together, or neither",
  })
  .parse(process.env);

export const config = {
  databasePath: env.DATABASE_PATH,
  oimApiBase: env.OIM_API_BASE.replace(/\/$/, ""),
  port: env.PORT,
  host: env.HOST,
  publicUrl: env.PUBLIC_URL.replace(/\/$/, ""),
  webDist: env.WEB_DIST,
  clientIpHeader: env.CLIENT_IP_HEADER || undefined,
  github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET },
  analytics:
    env.UMAMI_SCRIPT_URL && env.UMAMI_WEBSITE_ID
      ? { scriptUrl: env.UMAMI_SCRIPT_URL, websiteId: env.UMAMI_WEBSITE_ID }
      : undefined,
};
