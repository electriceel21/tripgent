import { createTripgentApp } from "@tripgent/api/app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Raise on Vercel Pro / Enterprise if chat runs long; Hobby max is 10s. */
export const maxDuration = 300;

let app: ReturnType<typeof createTripgentApp> | undefined;

function getApp() {
  if (!app) {
    app = createTripgentApp();
  }
  return app;
}

/** Next serves Hono under `/api/*`; Hono routes are `/health`, `/v1/*`. */
function stripApiPrefix(req: Request): Request {
  const url = new URL(req.url);
  const p = url.pathname;
  if (p === "/api" || p.startsWith("/api/")) {
    url.pathname = p === "/api" ? "/" : p.slice(4) || "/";
  }
  return new Request(url, req);
}

async function dispatch(req: Request): Promise<Response> {
  return getApp().fetch(stripApiPrefix(req));
}

export const GET = dispatch;
export const POST = dispatch;
export const PUT = dispatch;
export const PATCH = dispatch;
export const DELETE = dispatch;
export const OPTIONS = dispatch;
