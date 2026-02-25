"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = capitalize;
exports.formatName = formatName;
/**
 * Capitalize the first letter of each word in a string
 * @param str The string to capitalize
 * @returns The capitalized string
 */
function capitalize(str) {
    if (!str)
        return str;
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
function formatName(firstName, middleName, lastName, secondLastName, maxLength = 50) {
    // Build full name with available parts
    const nameParts = [
        firstName === null || firstName === void 0 ? void 0 : firstName.trim(),
        middleName === null || middleName === void 0 ? void 0 : middleName.trim(),
        lastName === null || lastName === void 0 ? void 0 : lastName.trim(),
        secondLastName === null || secondLastName === void 0 ? void 0 : secondLastName.trim(),
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
