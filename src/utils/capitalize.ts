/**
 * Capitalize the first letter of each word in a string
 * @param str The string to capitalize
 * @returns The capitalized string
 */
export default function capitalize(str: string): string {
	if (!str) return str;
	return str
		.toLowerCase()
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

/**
 * Format and truncate names intelligently for display
 * @param firstName First name
 * @param middleName Middle name (optional)
 * @param lastName Last name
 * @param secondLastName Second last name (optional)
 * @param maxLength Maximum total length (default 30)
 * @returns Formatted name string
 */
export function formatName(
	firstName: string,
	middleName: string | null,
	lastName: string,
	secondLastName: string | null,
	maxLength: number = 50,
): string {
	// Build full name with available parts
	const nameParts = [
		firstName?.trim(),
		middleName?.trim(),
		lastName?.trim(),
		secondLastName?.trim(),
	].filter(Boolean);

	const fullName = nameParts.join(" ");

	// If name fits within limit, return as is
	if (fullName.length <= maxLength) {
		return fullName;
	}

	// For long names, prioritize first and last name, truncate middle names
	const essential = `${firstName} ${lastName}`.trim();

	if (essential.length <= maxLength) {
		// Add second last name if there's space
		if (secondLastName && (essential + " " + secondLastName).length <= maxLength) {
			return `${essential} ${secondLastName}`;
		}
		// Add abbreviated middle name if there's space
		if (middleName && (essential + " " + middleName.charAt(0) + ".").length <= maxLength) {
			return `${essential} ${middleName.charAt(0)}.`;
		}
		return essential;
	}

	// If even essential names are too long, truncate with ellipsis
	return essential.length > maxLength ? essential.substring(0, maxLength - 3) + "..." : essential;
}
