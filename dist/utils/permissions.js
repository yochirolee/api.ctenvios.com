"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canViewResource = exports.canManageOwnResource = exports.canViewOwnResource = exports.hasAnyPermission = exports.hasPermission = exports.Permissions = void 0;
const client_1 = require("@prisma/client");
/**
 * Sistema de permisos centralizado
 * Define permisos como acciones, no como roles individuales
 * Esto facilita el mantenimiento y evita duplicación de código
 */
// ============================================
// DEFINICIÓN DE PERMISOS POR ACCIÓN
// ============================================
exports.Permissions = {
    // Carriers
    CARRIER_VIEW_ALL: [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR, client_1.Roles.FORWARDER_ADMIN],
    CARRIER_MANAGE: [
        client_1.Roles.ROOT,
        client_1.Roles.ADMINISTRATOR,
        client_1.Roles.FORWARDER_ADMIN,
        client_1.Roles.CARRIER_OWNER,
        client_1.Roles.CARRIER_ADMIN,
    ],
    CARRIER_CREATE: [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR, client_1.Roles.FORWARDER_ADMIN],
    CARRIER_DELETE: [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR],
    // Issues
    ISSUE_VIEW_ALL: [
        client_1.Roles.ROOT,
        client_1.Roles.ADMINISTRATOR,
        client_1.Roles.CARRIER_OWNER,
        client_1.Roles.CARRIER_ADMIN,
        client_1.Roles.CARRIER_ISSUES_MANAGER,
    ],
    ISSUE_MANAGE: [
        client_1.Roles.ROOT,
        client_1.Roles.ADMINISTRATOR,
        client_1.Roles.CARRIER_OWNER,
        client_1.Roles.CARRIER_ADMIN,
        client_1.Roles.CARRIER_ISSUES_MANAGER,
    ],
    ISSUE_DELETE: [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR, client_1.Roles.CARRIER_OWNER, client_1.Roles.CARRIER_ADMIN],
    // Legacy Issues
    LEGACY_ISSUE_VIEW_ALL: [
        client_1.Roles.ROOT,
        client_1.Roles.ADMINISTRATOR,
        client_1.Roles.CARRIER_OWNER,
        client_1.Roles.CARRIER_ADMIN,
        client_1.Roles.CARRIER_ISSUES_MANAGER,
    ],
    // Agencies
    AGENCY_VIEW_ALL: [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR, client_1.Roles.FORWARDER_ADMIN],
    AGENCY_CREATE: [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR, client_1.Roles.AGENCY_ADMIN],
    // Partners
    PARTNER_VIEW_ALL: [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR, client_1.Roles.FORWARDER_ADMIN],
};
// ============================================
// FUNCIONES HELPER PARA VERIFICAR PERMISOS
// ============================================
/**
 * Verifica si un usuario tiene un permiso específico
 */
const hasPermission = (userRole, permission) => {
    return permission.includes(userRole);
};
exports.hasPermission = hasPermission;
/**
 * Verifica si un usuario tiene alguno de los permisos especificados
 */
const hasAnyPermission = (userRole, permissions) => {
    return permissions.some((permission) => permission.includes(userRole));
};
exports.hasAnyPermission = hasAnyPermission;
/**
 * Verifica si el usuario puede ver recursos de su organización o todos los recursos
 * @param userRole - Rol del usuario
 * @param userOrgId - ID de la organización del usuario (agency_id o carrier_id)
 * @param resourceOrgId - ID de la organización del recurso
 * @param viewAllPermission - Permisos que permiten ver todos los recursos
 * @returns true si el usuario puede ver el recurso
 */
const canViewOwnResource = (userRole, userOrgId, resourceOrgId, viewAllPermission) => {
    // Si tiene permiso para ver todos, puede ver cualquier recurso
    if ((0, exports.hasPermission)(userRole, viewAllPermission)) {
        return true;
    }
    // Si no tiene permiso global, solo puede ver recursos de su organización
    return userOrgId !== null && userOrgId !== undefined && userOrgId === resourceOrgId;
};
exports.canViewOwnResource = canViewOwnResource;
/**
 * Verifica si el usuario puede gestionar recursos de su organización o todos los recursos
 * @param userRole - Rol del usuario
 * @param userOrgId - ID de la organización del usuario (agency_id o carrier_id)
 * @param resourceOrgId - ID de la organización del recurso
 * @param manageAllPermission - Permisos que permiten gestionar todos los recursos
 * @param manageOwnPermission - Permisos que permiten gestionar solo recursos propios (opcional)
 * @returns true si el usuario puede gestionar el recurso
 */
const canManageOwnResource = (userRole, userOrgId, resourceOrgId, manageAllPermission, manageOwnPermission) => {
    // Si tiene permiso para gestionar todos, puede gestionar cualquier recurso
    if ((0, exports.hasPermission)(userRole, manageAllPermission)) {
        return true;
    }
    // Si tiene permiso para gestionar propios y pertenece a la misma organización
    if (manageOwnPermission && (0, exports.hasPermission)(userRole, manageOwnPermission)) {
        return userOrgId !== null && userOrgId !== undefined && userOrgId === resourceOrgId;
    }
    return false;
};
exports.canManageOwnResource = canManageOwnResource;
/**
 * Verifica si el usuario puede ver un recurso basado en múltiples condiciones
 * Útil para casos donde hay lógica adicional (ej: creador, asignado, etc.)
 */
const canViewResource = (userRole, userOrgId, resourceOrgId, viewAllPermission, additionalConditions) => {
    // Si tiene permiso para ver todos, puede ver cualquier recurso
    if ((0, exports.hasPermission)(userRole, viewAllPermission)) {
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
exports.canViewResource = canViewResource;
