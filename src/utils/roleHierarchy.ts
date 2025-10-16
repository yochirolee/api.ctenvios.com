import { Roles } from "@prisma/client";

// Role hierarchy definition (higher number = higher privilege)
const ROLE_HIERARCHY = {
   [Roles.ROOT]: 9,
   [Roles.ADMINISTRATOR]: 8,
   [Roles.FORWARDER_ADMIN]: 7,
   [Roles.CARRIER_ADMIN]: 6,
   [Roles.FORWARDER_RESELLER]: 5,
   [Roles.AGENCY_SUPERVISOR]: 4,
   [Roles.AGENCY_ADMIN]: 3,
   [Roles.AGENCY_SALES]: 2,
   [Roles.MESSENGER]: 1,
   [Roles.USER]: 0,
} as const;

/**
 * Get all roles that are equal to or below the given user role
 * @param userRole - The current user's role
 * @returns Array of roles the user can see/assign
 */
export const getRolesEqualOrBelow = (userRole: Roles): Roles[] => {
   const userLevel = ROLE_HIERARCHY[userRole];

   return Object.entries(ROLE_HIERARCHY)
      .filter(([_, level]) => level <= userLevel)
      .map(([role, _]) => role as Roles)
      .sort((a, b) => ROLE_HIERARCHY[b] - ROLE_HIERARCHY[a]); // Sort by hierarchy desc
};

/**
 * Check if a user can assign/manage a specific role
 * @param userRole - The current user's role
 * @param targetRole - The role to check against
 * @returns Boolean indicating if the user can manage the target role
 */
export const canManageRole = (userRole: Roles, targetRole: Roles): boolean => {
   return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[targetRole];
};

/**
 * Get the hierarchy level of a role
 * @param role - The role to get level for
 * @returns The numeric level of the role
 */
export const getRoleLevel = (role: Roles): number => {
   return ROLE_HIERARCHY[role];
};
