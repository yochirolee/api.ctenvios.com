
export function formatPhoneNumber(phoneNumber: string): string {
   return phoneNumber.replace(/^(\+535|535)?/, "");
}

export function isValidCubanCI(ci: string): boolean {
   if (!/^\d{11}$/.test(ci)) return false;

   const year = parseInt(ci.slice(0, 2), 10);
   const month = parseInt(ci.slice(2, 4), 10);
   const day = parseInt(ci.slice(4, 6), 10);
   const fullYear = year >= 30 ? 1900 + year : 2000 + year;

   if (month < 1 || month > 12 || day < 1 || day > 31) return false;

   // Validar fecha
   const date = new Date(fullYear, month - 1, day);
   const isValidDate = date.getFullYear() === fullYear && date.getMonth() === month - 1 && date.getDate() === day;

   if (!isValidDate) return false;

   // Si es antes de 2014 no se exige digito de control
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
   unit: string
): number => {
   const safePriceInCents = price_in_cents || 0;
   const safeWeight =toNumber(weight) || 0;
   const safeCustomsFeeInCents = customs_fee_in_cents || 0;
   const safeChargeFeeInCents = charge_fee_in_cents || 0;
   const safeInsuranceFeeInCents = insurance_fee_in_cents || 0;

   if (unit === "PER_LB") {
      return Math.ceil(
         safePriceInCents * safeWeight + safeCustomsFeeInCents + safeChargeFeeInCents + safeInsuranceFeeInCents
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
         item.unit || "PER_LB"
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
export const getDayRangeUTC = (date: Date): { start: Date; end: Date } => {
   const adjusted = getAdjustedDate(date);
   // Start of day in EST (00:00:00)
   const estStart = new Date(adjusted.getFullYear(), adjusted.getMonth(), adjusted.getDate(), 0, 0, 0);
   // End of day in EST (23:59:59)
   const estEnd = new Date(adjusted.getFullYear(), adjusted.getMonth(), adjusted.getDate(), 23, 59, 59, 999);
   // Convert back to UTC for database query
   const utcStart = new Date(estStart.getTime() - TIMEZONE_OFFSET_HOURS * 3600000);
   const utcEnd = new Date(estEnd.getTime() - TIMEZONE_OFFSET_HOURS * 3600000);
   return { start: utcStart, end: utcEnd };
};

// Get today's date range in EST timezone, converted to UTC for database queries
export const getTodayRangeUTC = (): { start: Date; end: Date } => {
   return getDayRangeUTC(new Date());
};

// Get month range for a specific year/month in EST timezone, converted to UTC for database queries
export const getMonthRangeUTC = (year: number, month: number): { start: Date; end: Date } => {
   // month is 1-based (1 = January)
   const estStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
   const estEnd = new Date(year, month, 0, 23, 59, 59, 999); // day 0 of next month = last day of current month
   const utcStart = new Date(estStart.getTime() - TIMEZONE_OFFSET_HOURS * 3600000);
   const utcEnd = new Date(estEnd.getTime() - TIMEZONE_OFFSET_HOURS * 3600000);
   return { start: utcStart, end: utcEnd };
};