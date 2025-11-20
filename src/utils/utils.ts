import { Unit } from "@prisma/client";

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
