import { Router } from "express";
const router = Router();

const electric_url = `https://api.ctenvios.com/v1/shape`;

router.get("/shape", async (req, res) => {
   const searchParams = new URLSearchParams();

   // Forward all query parameters from the request
   Object.keys(req.query).forEach((key) => {
      const value = req.query[key];
      if (value !== undefined && value !== null) {
         searchParams.set(key, String(value));
      }
   });

   // Use query params from request or default to -1 for offset
   if (!req.query.offset) {
      searchParams.set(`offset`, "-1");
   }

   const url = new URL(electric_url);
   url.search = searchParams.toString();

   const response = await fetch(url);

   // Forward ALL headers from Electric service response
   // This must be done before calling res.json() or res.send()
   response.headers.forEach((value, key) => {
      // Skip headers that Express manages automatically
      const lowerKey = key.toLowerCase();
      if (
         lowerKey !== "content-encoding" &&
         lowerKey !== "content-length" &&
         lowerKey !== "transfer-encoding" &&
         lowerKey !== "connection"
      ) {
         res.setHeader(key, value);
      }
   });

   // Forward status code
   res.status(response.status);

   const data = await response.json();
   res.json(data);
});

export default router;
