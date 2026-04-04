import { loadRootEnv } from "./load-root-env.js";
import { serve } from "@hono/node-server";
import { createTripgentApp } from "./create-app.js";

loadRootEnv();

const app = createTripgentApp();

const port = Number(process.env.PORT ?? 8787);
console.log(`Tripgent API listening on http://127.0.0.1:${port}`);
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" });
