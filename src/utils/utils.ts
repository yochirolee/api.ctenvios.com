export function formatPhoneNumber(phoneNumber: string): string {
   return phoneNumber.replace(/^(\+535|535)?/, "");
}

export function isValidCubanCI(ci: string): boolean {
   if (!/^\d{11}$/.test(ci)) return false;

   const year = parseInt(ci.slice(0, 2), 10);
   const month = parseInt(ci.slice(2, 4), 10);
   const day = parseInt(ci.slice(4, 6), 10);

   // Infer century based on current year to support people born in 19xx and 20xx
   const currentYY = new Date().getFullYear() % 100;
   const fullYear = year > currentYY ? 1900 + year : 2000 + year;

   if (month < 1 || month > 12 || day < 1 || day > 31) return false;

   const date = new Date(fullYear, month - 1, day);
   const isValidDate = date.getFullYear() === fullYear && date.getMonth() === month - 1 && date.getDate() === day;

   if (!isValidDate) return false;

   // If born before 2014, don't enforce control digit
   if (fullYear < 2014) return true;

   const weights = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
   let sum = 0;

   for (let i = 0; i < 10; i++) {
      const digit = parseInt(ci[i], 10);
      const product = digit * weights[i];
      sum += product < 10 ? product : Math.floor(product / 10) + (product % 10);
   }

   const controlDigit = (10 - (sum % 10)) % 10;
   return controlDigit === parseInt(ci[10], 10);
}

export function dollarsToCents(amount: number | string): number {
   const num = typeof amount === "string" ? parseFloat(amount) : amount;
   if (!Number.isFinite(num)) throw new Error("Monto invalido");
   return Math.round(num * 100);
}

export function centsToDollars(cents: number): number {
   return Math.round((cents / 100) * 100) / 100;
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(locale: string, currency: string): Intl.NumberFormat {
   const key = `${locale}-${currency}`;
   let formatter = formatterCache.get(key);

   if (!formatter) {
      formatter = new Intl.NumberFormat(locale, {
         style: "currency",
         currency,
         minimumFractionDigits: 2,
         maximumFractionDigits: 2,
      });
      formatterCache.set(key, formatter);
   }

   return formatter;
}

export function formatCents(cents: number, locale: string = "en-US", currency: string = "USD"): string {
   return getFormatter(locale, currency).format(cents / 100);
}

// Helper function to safely convert Prisma Decimal to number
export function toNumber(value: number | { toNumber?: () => number } | null | undefined): number {
   if (value === null || value === undefined) return 0;
   if (typeof value === "number") return value;
   if (typeof value === "object" && typeof value.toNumber === "function") {
      return value.toNumber();
   }
   return Number(value) || 0;
}

export const calculate_row_subtotal = (
   price_in_cents: number,
   weight: number,
   customs_fee_in_cents: number,
   charge_fee_in_cents: number,
   insurance_fee_in_cents: number,
   unit: string,
): number => {
   const safePriceInCents = price_in_cents || 0;
   const safeWeight = toNumber(weight) || 0;
   const safeCustomsFeeInCents = customs_fee_in_cents || 0;
   const safeChargeFeeInCents = charge_fee_in_cents || 0;
   const safeInsuranceFeeInCents = insurance_fee_in_cents || 0;

   if (unit === "PER_LB") {
      return Math.ceil(
         safePriceInCents * safeWeight + safeCustomsFeeInCents + safeChargeFeeInCents + safeInsuranceFeeInCents,
      );
   }
   return Math.ceil(safePriceInCents + safeCustomsFeeInCents);
};

// Helper function for calculating order total (matches invoice calculation)
export function calculateOrderTotal(items: any[]): number {
   return items.reduce((total, item) => {
      const itemSubtotal = calculate_row_subtotal(
         item.price_in_cents || 0,
         item.weight || 0,
         item.customs_fee_in_cents || 0,
         item.charge_fee_in_cents || 0,
         item.insurance_fee_in_cents || 0,
         item.unit || "PER_LB",
      );
      return total + itemSubtotal;
   }, 0);
}

export const distributeCents = (totalCents: number, parts: number): number[] => {
   if (parts <= 0) return [];
   const total = Math.round(totalCents);
   const base = Math.floor(total / parts);
   const remainder = total - base * parts; // 0..parts-1

   return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
};

// Timezone offset for EST (UTC-5) - adjust for your region
export const TIMEZONE_OFFSET_HOURS = -5;

// Helper function to get date adjusted to target timezone
export const getAdjustedDate = (date: Date): Date => {
   const utcTime = date.getTime() + date.getTimezoneOffset() * 60000;
   return new Date(utcTime + TIMEZONE_OFFSET_HOURS * 3600000);
};

// Helper function to format date locally (YYYY-MM-DD)
export const formatDateLocal = (date: Date): string => {
   const adjusted = getAdjustedDate(date);
   const year = adjusted.getFullYear();
   const month = String(adjusted.getMonth() + 1).padStart(2, "0");
   const day = String(adjusted.getDate()).padStart(2, "0");
   return `${year}-${month}-${day}`;
};

// Helper function to format date with time locally (YYYY-MM-DD HH:mm)
export const formatDateTimeLocal = (date: Date): string => {
   const adjusted = getAdjustedDate(date);
   const year = adjusted.getFullYear();
   const month = String(adjusted.getMonth() + 1).padStart(2, "0");
   const day = String(adjusted.getDate()).padStart(2, "0");
   const hours = String(adjusted.getHours()).padStart(2, "0");
   const minutes = String(adjusted.getMinutes()).padStart(2, "0");
   return `${year}-${month}-${day} ${hours}:${minutes}`;
};

// Get day range for a specific date in EST timezone, converted to UTC for database queries
// The input date's year/month/day should be treated as the EST date we want to query
export const getDayRangeUTC = (date: Date): { start: Date; end: Date } => {
   // Extract year, month, day from the input date directly (treat as EST date)
   // Use UTC methods to avoid local timezone interference
   const year = date.getUTCFullYear();
   const month = date.getUTCMonth();
   const day = date.getUTCDate();

   // Create start of day in EST (00:00:00 EST = 05:00:00 UTC)
   // EST is UTC-5, so midnight EST = 5 AM UTC
   const utcStart = new Date(Date.UTC(year, month, day, 5, 0, 0, 0));
   // End of day in EST (23:59:59 EST = 04:59:59 UTC next day)
   const utcEnd = new Date(Date.UTC(year, month, day + 1, 4, 59, 59, 999));

   return { start: utcStart, end: utcEnd };
};

// Get today's date range in EST timezone, converted to UTC for database queries
export const getTodayRangeUTC = (): { start: Date; end: Date } => {
   // Get current time adjusted to EST
   const estNow = getAdjustedDate(new Date());
   // Create a date with today's EST date components
   const todayEST = new Date(Date.UTC(estNow.getFullYear(), estNow.getMonth(), estNow.getDate()));
   return getDayRangeUTC(todayEST);
};

// Get month range for a specific year/month in EST timezone, converted to UTC for database queries
export const getMonthRangeUTC = (year: number, month: number): { start: Date; end: Date } => {
   // month is 1-based (1 = January)
   // First day of month at 00:00:00 EST = 05:00:00 UTC
   const utcStart = new Date(Date.UTC(year, month - 1, 1, 5, 0, 0, 0));
   // Last day of month at 23:59:59 EST = next month day 1 at 04:59:59 UTC
   const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate(); // day 0 of next month = last day of current
   const utcEnd = new Date(Date.UTC(year, month - 1, lastDayOfMonth + 1, 4, 59, 59, 999));
   return { start: utcStart, end: utcEnd };
};
