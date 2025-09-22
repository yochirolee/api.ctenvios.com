

export function formatPhoneNumber(phoneNumber: string) {
	return phoneNumber.replace(/^(\+535|535)?/, "");
}

export function isValidCubanCI(ci: string): boolean {
	if (!/^\d{11}$/.test(ci)) return false;

	const digits = ci.split("").map(Number);
	const year = parseInt(ci.slice(0, 2), 10);
	const month = parseInt(ci.slice(2, 4), 10);
	const day = parseInt(ci.slice(4, 6), 10);
	const fullYear = year >= 30 ? 1900 + year : 2000 + year;

	// Validar fecha
	const date = new Date(fullYear, month - 1, day);
	const isValidDate =
		date.getFullYear() === fullYear && date.getMonth() === month - 1 && date.getDate() === day;

	if (!isValidDate) return false;

	// Si es antes de 2014 no se exige dígito de control
	if (fullYear < 2014) return true;

	const weights = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
	const sum = weights.reduce((acc, weight, i) => {
		const product = digits[i] * weight;
		return acc + (product < 10 ? product : Math.floor(product / 10) + (product % 10));
	}, 0);

	const controlDigit = (10 - (sum % 10)) % 10;
	return controlDigit === digits[10];
}

export function dollarsToCents(amount: number | string): number {
	const num = typeof amount === "string" ? parseFloat(amount) : amount;
	if (!Number.isFinite(num)) throw new Error("Monto inválido");
	return Math.round(num * 100);
}

export function centsToDollars(cents: number): number {
	return cents / 100;
}

export function formatCents(
	cents: number,
	locale: string = "en-US",
	currency: string = "USD",
): string {
	return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

export const calculate_row_subtotal = (
	rate_in_cents: number,
	weight: number,
	customs_fee_in_cents: number,
	rate_type: string,
	charge_fee_in_cents: number,
) => {
	// Ensure all values are valid numbers
	const safeRateInCents = Number(rate_in_cents) || 0;
	const safeWeight = Number(weight) || 0;
	const safeCustomsFeeInCents = Number(customs_fee_in_cents) || 0;
	const safeChargeFeeInCents = charge_fee_in_cents || 0;
	if (rate_type === "WEIGHT") {
		return (
			safeRateInCents * safeWeight + safeCustomsFeeInCents + safeChargeFeeInCents
		);
	} else {
		return safeRateInCents + safeCustomsFeeInCents;
	}
};
