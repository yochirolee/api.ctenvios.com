// src/utils/hbl.ts

const CROCKFORD32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
// (sin I, L, O, U)

const BASE = 32;

// ORDER32(6)
const V1_WIDTH = 6;
const V1_SPAN = BASE ** V1_WIDTH; // 32^6 = 1,073,741,824
const V1_MAX_ORDER_ID = V1_SPAN - 1; // 1,073,741,823

function pad(n: number | string, w: number) {
   return String(n).padStart(w, "0");
}

// YYMM (4) en TZ indicada
export function todayYYMM(tz = "America/New_York"): string {
   const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "2-digit",
      month: "2-digit",
   }).formatToParts(new Date());

   const get = (t: string) => parts.find((p) => p.type === t)?.value!;
   const yy = get("year"); // "26"
   const mm = get("month"); // "02"
   return `${yy}${mm}`; // YYMM
}

// Base32 Crockford fixed width
export function toCrockfordBase32Fixed(n: number, width: number): string {
   if (!Number.isInteger(n) || n < 0) throw new Error("n must be a non-negative integer");

   let x = n;
   let out = "";
   do {
      const r = x % 32;
      out = CROCKFORD32[r] + out;
      x = Math.floor(x / 32);
   } while (x > 0);

   if (out.length > width) throw new Error(`overflow: ${n} exceeds ${width} base32 chars`);
   return out.padStart(width, "0");
}

export function fromCrockfordBase32(s: string): number {
   const map = new Map<string, number>();
   for (let i = 0; i < CROCKFORD32.length; i++) map.set(CROCKFORD32[i], i);

   const str = s.trim().toUpperCase();
   let n = 0;
   for (const ch of str) {
      const v = map.get(ch);
      if (v === undefined) throw new Error(`invalid base32 char: ${ch}`);
      n = n * 32 + v;
   }
   return n;
}

export type ParsedHBL =
   | { version: 1; provider: string; yymm: string; orderId: number; itemNo: number; raw: string }
   | { version: 2; provider: string; yymm: string; orderId: number; itemNo: number; raw: string };

// Validación básica de YYMM
function isYYMM(s: string) {
   if (!/^\d{4}$/.test(s)) return false;
   const yy = Number(s.slice(0, 2));
   const mm = Number(s.slice(2, 4));
   return yy >= 0 && yy <= 99 && mm >= 1 && mm <= 12;
}

/**
 * Construye HBL:
 * V1 (15): PROV(3) + YYMM(4) + ORDER32(6) + ITEM(2)
 * V2 (16): PROV(3) + "1"(1) + YYMM(4) + ORDER32(6) + ITEM(2)
 *
 * itemNo: 01..99 (al final)
 * orderId: Int positivo
 */
export function buildHBL(provider: string, yymm: string, orderId: number, itemNo: number): string {
   const prov = provider
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

   if (prov.length !== 3) throw new Error("provider must be exactly 3 chars (e.g. CTE)");
   if (!isYYMM(yymm)) throw new Error("yymm must be 4 digits: YYMM");
   if (!Number.isInteger(orderId) || orderId < 1) throw new Error("orderId must be a positive integer");
   if (!Number.isInteger(itemNo) || itemNo < 1 || itemNo > 99) throw new Error("itemNo must be 01..99");

   const item2 = pad(itemNo, 2);

   // ✅ V1: orderId 1..1,073,741,823
   if (orderId <= V1_MAX_ORDER_ID) {
      const order32 = toCrockfordBase32Fixed(orderId, V1_WIDTH);
      return `${prov}${yymm}${order32}${item2}`; // 15
   }

   // ✅ V2: orderId (V1_SPAN..2*V1_SPAN-1) usando offset para seguir con 6 chars
   const v2Id = orderId - V1_SPAN;
   if (v2Id >= 0 && v2Id <= V1_MAX_ORDER_ID) {
      const order32 = toCrockfordBase32Fixed(v2Id, V1_WIDTH);
      return `${prov}1${yymm}${order32}${item2}`; // 16
   }

   // Si algún día pasas esto, define V3 (o usa width 7)
   throw new Error(`orderId too large for v1/v2 range. Supported up to ${2 * V1_SPAN - 1} orders.`);
}

/**
 * Parse automático V1/V2.
 */
export function parseHBL(hbl: string): ParsedHBL {
   if (!hbl) throw new Error("empty HBL");

   const raw = hbl.trim().toUpperCase();

   // V1: 15
   if (raw.length === 15) {
      const provider = raw.slice(0, 3);
      const yymm = raw.slice(3, 7);
      const order32 = raw.slice(7, 13);
      const itemNo = Number(raw.slice(13, 15));

      if (!isYYMM(yymm)) throw new Error("invalid YYMM");
      if (!Number.isInteger(itemNo) || itemNo < 1 || itemNo > 99) throw new Error("invalid itemNo 01..99");

      const orderId = fromCrockfordBase32(order32);
      if (orderId < 1 || orderId > V1_MAX_ORDER_ID) throw new Error("invalid orderId decoded");

      return { version: 1, provider, yymm, orderId, itemNo, raw };
   }

   // V2: 16 con version "1"
   if (raw.length === 16) {
      const provider = raw.slice(0, 3);
      const v = raw.slice(3, 4);
      if (v !== "1") throw new Error("unknown HBL version");

      const yymm = raw.slice(4, 8);
      const order32 = raw.slice(8, 14);
      const itemNo = Number(raw.slice(14, 16));

      if (!isYYMM(yymm)) throw new Error("invalid YYMM");
      if (!Number.isInteger(itemNo) || itemNo < 1 || itemNo > 99) throw new Error("invalid itemNo 01..99");

      const v2Id = fromCrockfordBase32(order32);
      if (v2Id < 0 || v2Id > V1_MAX_ORDER_ID) throw new Error("invalid v2 order decoded");

      const orderId = v2Id + V1_SPAN;
      return { version: 2, provider, yymm, orderId, itemNo, raw };
   }

   throw new Error("invalid HBL length (expected 15 or 16)");
}

/**
 * Validación rápida (sin throw)
 */
export function isValidHBL(hbl: string): boolean {
   try {
      parseHBL(hbl);
      return true;
   } catch {
      return false;
   }
}
