import { Router } from "express";
import { Readable } from "node:stream";

const router = Router();
const electric_url = `https://api.ctenvios.com/v1/shape`;

router.get("/shape", async (req, res) => {
   const qs = new URLSearchParams();

   // Solo keys “shape” en query
   const pass = new Set([
      "table", "offset", "handle", "cursor", "live", "log", "columns",
      "where", "subset__limit", "subset__offset", "subset__order_by", "subset__where", "subset__params",
   ]);
   for (const [k, v] of Object.entries(req.query)) {
      if (v == null) continue;
      if (!pass.has(k) && !k.startsWith("subset__")) continue;
      if (Array.isArray(v)) v.forEach((x) => qs.append(k, String(x)));
      else qs.set(k, String(v));
   }
   if (!req.query.offset) qs.set("offset", "-1");

   // Body subset
   const body: any = {};
   if (typeof req.query.where === "string") body.where = req.query.where;

   // binds or params -> body.params (Electric client sends "params", we also accept "binds")
   const paramsRaw = typeof req.query.params === "string" ? req.query.params : typeof req.query.binds === "string" ? req.query.binds : undefined;
   if (paramsRaw) {
      const parsed = JSON.parse(paramsRaw);
      body.params = parsed; // Electric espera { "1": 1 }
   }

   const url = new URL(electric_url);
   url.search = qs.toString();

   const upstream = await fetch(url, {
      method: Object.keys(body).length ? "POST" : "GET",
      headers: {
         authorization: req.headers.authorization ?? "",
         "content-type": "application/json",
      },
      body: Object.keys(body).length ? JSON.stringify(body) : undefined,
   });

   res.status(upstream.status);

   upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (!["content-encoding", "content-length", "transfer-encoding", "connection"].includes(lower)) {
         res.setHeader(key, value);
      }
   });

   res.setHeader(
      "Access-Control-Expose-Headers",
      "electric-offset,electric-handle,electric-schema,electric-cursor,next-offset",
   );

   if (!upstream.body) return res.end();
   Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
});

export default router;
