import { Roles } from "@prisma/client";

/**
 * Sistema de permisos centralizado
 * Define permisos como acciones, no como roles individuales
 * Esto facilita el mantenimiento y evita duplicación de código
 */

// ============================================
// DEFINICIÓN DE PERMISOS POR ACCIÓN
// ============================================

export const Permissions = {
   // Carriers
   CARRIER_VIEW_ALL: [Roles.ROOT, Roles.ADMINISTRATOR, Roles.FORWARDER_ADMIN],
   CARRIER_MANAGE: [
      Roles.ROOT,
      Roles.ADMINISTRATOR,
      Roles.FORWARDER_ADMIN,
      Roles.CARRIER_OWNER,
      Roles.CARRIER_ADMIN,
   ],
   CARRIER_CREATE: [Roles.ROOT, Roles.ADMINISTRATOR, Roles.FORWARDER_ADMIN],
   CARRIER_DELETE: [Roles.ROOT, Roles.ADMINISTRATOR],

   // Issues
   ISSUE_VIEW_ALL: [
      Roles.ROOT,
      Roles.ADMINISTRATOR,
      Roles.CARRIER_OWNER,
      Roles.CARRIER_ADMIN,
      Roles.CARRIER_ISSUES_MANAGER,
   ],
   ISSUE_MANAGE: [
      Roles.ROOT,
      Roles.ADMINISTRATOR,
      Roles.CARRIER_OWNER,
      Roles.CARRIER_ADMIN,
      Roles.CARRIER_ISSUES_MANAGER,
   ],
   ISSUE_DELETE: [Roles.ROOT, Roles.ADMINISTRATOR, Roles.CARRIER_OWNER, Roles.CARRIER_ADMIN],

   // Legacy Issues
   LEGACY_ISSUE_VIEW_ALL: [
      Roles.ROOT,
      Roles.ADMINISTRATOR,
      Roles.CARRIER_OWNER,
      Roles.CARRIER_ADMIN,
      Roles.CARRIER_ISSUES_MANAGER,
   ],

   // Agencies
   AGENCY_VIEW_ALL: [Roles.ROOT, Roles.ADMINISTRATOR, Roles.FORWARDER_ADMIN],
   AGENCY_CREATE: [Roles.ROOT, Roles.ADMINISTRATOR, Roles.AGENCY_ADMIN],

   // Partners
   PARTNER_VIEW_ALL: [Roles.ROOT, Roles.ADMINISTRATOR, Roles.FORWARDER_ADMIN],
} as const;

// ============================================
// FUNCIONES HELPER PARA VERIFICAR PERMISOS
// ============================================

/**
 * Verifica si un usuario tiene un permiso específico
 */
export const hasPermission = (userRole: Roles, permission: readonly Roles[]): boolean => {
   return permission.includes(userRole);
};

/**
 * Verifica si un usuario tiene alguno de los permisos especificados
 */
export const hasAnyPermission = (userRole: Roles, permissions: readonly Roles[][]): boolean => {
   return permissions.some((permission) => permission.includes(userRole));
};

/**
 * Verifica si el usuario puede ver recursos de su organización o todos los recursos
 * @param userRole - Rol del usuario
 * @param userOrgId - ID de la organización del usuario (agency_id o carrier_id)
 * @param resourceOrgId - ID de la organización del recurso
 * @param viewAllPermission - Permisos que permiten ver todos los recursos
 * @returns true si el usuario puede ver el recurso
 */
export const canViewOwnResource = (
   userRole: Roles,
   userOrgId: number | null | undefined,
   resourceOrgId: number | null | undefined,
   viewAllPermission: readonly Roles[]
): boolean => {
   // Si tiene permiso para ver todos, puede ver cualquier recurso
   if (hasPermission(userRole, viewAllPermission)) {
      return true;
   }

   // Si no tiene permiso global, solo puede ver recursos de su organización
   return userOrgId !== null && userOrgId !== undefined && userOrgId === resourceOrgId;
};

/**
 * Verifica si el usuario puede gestionar recursos de su organización o todos los recursos
 * @param userRole - Rol del usuario
 * @param userOrgId - ID de la organización del usuario (agency_id o carrier_id)
 * @param resourceOrgId - ID de la organización del recurso
 * @param manageAllPermission - Permisos que permiten gestionar todos los recursos
 * @param manageOwnPermission - Permisos que permiten gestionar solo recursos propios (opcional)
 * @returns true si el usuario puede gestionar el recurso
 */
export const canManageOwnResource = (
   userRole: Roles,
   userOrgId: number | null | undefined,
   resourceOrgId: number | null | undefined,
   manageAllPermission: readonly Roles[],
   manageOwnPermission?: readonly Roles[]
): boolean => {
   // Si tiene permiso para gestionar todos, puede gestionar cualquier recurso
   if (hasPermission(userRole, manageAllPermission)) {
      return true;
   }

   // Si tiene permiso para gestionar propios y pertenece a la misma organización
   if (manageOwnPermission && hasPermission(userRole, manageOwnPermission)) {
      return userOrgId !== null && userOrgId !== undefined && userOrgId === resourceOrgId;
   }

   return false;
};

/**
 * Verifica si el usuario puede ver un recurso basado en múltiples condiciones
 * Útil para casos donde hay lógica adicional (ej: creador, asignado, etc.)
 */
export const canViewResource = (
   userRole: Roles,
   userOrgId: number | null | undefined,
   resourceOrgId: number | null | undefined,
   viewAllPermission: readonly Roles[],
   additionalConditions?: {
      isCreator?: boolean;
      isAssigned?: boolean;
      [key: string]: boolean | undefined;
   }
): boolean => {
   // Si tiene permiso para ver todos, puede ver cualquier recurso
   if (hasPermission(userRole, viewAllPermission)) {
      return true;
   }

   // Si cumple condiciones adicionales (ej: es el creador o asignado)
   if (additionalConditions) {
      if (additionalConditions.isCreator || additionalConditions.isAssigned) {
         return true;
      }
   }

   // Si no tiene permiso global, solo puede ver recursos de su organización
   return userOrgId !== null && userOrgId !== undefined && userOrgId === resourceOrgId;
};

