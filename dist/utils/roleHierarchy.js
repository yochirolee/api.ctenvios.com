"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoleLevel = exports.canManageRole = exports.getRolesEqualOrBelow = void 0;
const client_1 = require("@prisma/client");
// Role hierarchy definition (higher number = higher privilege)
const ROLE_HIERARCHY = {
    [client_1.Roles.ROOT]: 9,
    [client_1.Roles.ADMINISTRATOR]: 8,
    [client_1.Roles.FORWARDER_ADMIN]: 7,
    [client_1.Roles.CARRIER_ADMIN]: 6,
    [client_1.Roles.FORWARDER_RESELLER]: 5,
    [client_1.Roles.AGENCY_SUPERVISOR]: 4,
    [client_1.Roles.AGENCY_ADMIN]: 3,
    [client_1.Roles.AGENCY_SALES]: 2,
    [client_1.Roles.MESSENGER]: 1,
    [client_1.Roles.USER]: 0,
};
/**
 * Get all roles that are equal to or below the given user role
 * @param userRole - The current user's role
 * @returns Array of roles the user can see/assign
 */
const getRolesEqualOrBelow = (userRole) => {
    const userLevel = ROLE_HIERARCHY[userRole];
    return Object.entries(ROLE_HIERARCHY)
        .filter(([_, level]) => level <= userLevel)
        .map(([role, _]) => role)
        .sort((a, b) => ROLE_HIERARCHY[b] - ROLE_HIERARCHY[a]); // Sort by hierarchy desc
};
exports.getRolesEqualOrBelow = getRolesEqualOrBelow;
/**
 * Check if a user can assign/manage a specific role
 * @param userRole - The current user's role
 * @param targetRole - The role to check against
 * @returns Boolean indicating if the user can manage the target role
 */
const canManageRole = (userRole, targetRole) => {
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[targetRole];
};
exports.canManageRole = canManageRole;
/**
 * Get the hierarchy level of a role
 * @param role - The role to get level for
 * @returns The numeric level of the role
 */
const getRoleLevel = (role) => {
    return ROLE_HIERARCHY[role];
};
exports.getRoleLevel = getRoleLevel;
