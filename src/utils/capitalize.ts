/**
 * Converts a string to PascalCase format (first letter uppercase)
 * Handles kebab-case, snake_case, camelCase, and regular strings with spaces
 * @param str - The string to convert to PascalCase
 * @returns The PascalCase formatted string
 */
export function capitalize(str: string): string {
	if (!str || typeof str !== "string") return "";

	return (
		str
			// Handle kebab-case, snake_case, and spaces
			.replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ""))
			// Ensure first letter is uppercase (PascalCase)
			.replace(/^[a-z]/, (char) => char.toUpperCase())
			// Remove any remaining non-alphanumeric characters except at start
			.replace(/[^a-zA-Z0-9]/g, "")
	);
}
