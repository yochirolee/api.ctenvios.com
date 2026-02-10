"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEventTypeForFlightStatus = exports.getEventTypeForContainerStatus = exports.getPublicEventTypes = exports.filterPublicEvents = exports.getPublicMessage = exports.isPublicEvent = void 0;
const client_1 = require("@prisma/client");
/**
 * Parcel Event Visibility Helper
 * Determines which events are visible to customers (public) vs internal staff only
 * Following: TypeScript strict typing, Repository pattern conventions
 */
// Eventos visibles al cliente
const PUBLIC_EVENT_TYPES = [
    client_1.ParcelEventType.BILLED,
    client_1.ParcelEventType.IN_TRANSIT,
    client_1.ParcelEventType.ARRIVED_DESTINATION,
    client_1.ParcelEventType.CUSTOMS_PROCESSING,
    client_1.ParcelEventType.CUSTOMS_RELEASED,
    client_1.ParcelEventType.OUT_FOR_DELIVERY,
    client_1.ParcelEventType.DELIVERED,
    client_1.ParcelEventType.DELIVERY_FAILED,
    client_1.ParcelEventType.DELIVERY_RESCHEDULED,
];
// Mensajes amigables para el cliente (en español)
const PUBLIC_EVENT_MESSAGES = {
    // Públicos
    [client_1.ParcelEventType.BILLED]: "Paquete recibido en agencia",
    [client_1.ParcelEventType.IN_TRANSIT]: "En tránsito hacia destino",
    [client_1.ParcelEventType.ARRIVED_DESTINATION]: "Arribó al país de destino",
    [client_1.ParcelEventType.CUSTOMS_PROCESSING]: "En proceso de aduana",
    [client_1.ParcelEventType.CUSTOMS_RELEASED]: "Liberado de aduana",
    [client_1.ParcelEventType.OUT_FOR_DELIVERY]: "En camino para entrega",
    [client_1.ParcelEventType.DELIVERED]: "Entregado",
    [client_1.ParcelEventType.DELIVERY_FAILED]: "Intento de entrega fallido",
    [client_1.ParcelEventType.DELIVERY_RESCHEDULED]: "Entrega reprogramada",
    // Internos (no se mostrarán al cliente, pero definimos mensajes por si acaso)
    [client_1.ParcelEventType.ADDED_TO_PALLET]: "Procesando en almacén",
    [client_1.ParcelEventType.REMOVED_FROM_PALLET]: "Procesando en almacén",
    [client_1.ParcelEventType.ADDED_TO_DISPATCH]: "Procesando envío",
    [client_1.ParcelEventType.REMOVED_FROM_DISPATCH]: "Procesando",
    [client_1.ParcelEventType.RECEIVED_IN_DISPATCH]: "Recibido en centro de distribución",
    [client_1.ParcelEventType.LOADED_TO_CONTAINER]: "Procesando envío internacional",
    [client_1.ParcelEventType.REMOVED_FROM_CONTAINER]: "Procesando",
    [client_1.ParcelEventType.LOADED_TO_FLIGHT]: "Procesando envío internacional",
    [client_1.ParcelEventType.REMOVED_FROM_FLIGHT]: "Procesando",
    [client_1.ParcelEventType.MANIFEST_SCANNED]: "Verificando paquete",
    [client_1.ParcelEventType.WAREHOUSE_RECEIVED]: "Recibido en centro de distribución",
    [client_1.ParcelEventType.WAREHOUSE_TRANSFERRED]: "En tránsito interno",
    [client_1.ParcelEventType.ASSIGNED_TO_ROUTE]: "Preparando entrega",
    [client_1.ParcelEventType.ASSIGNED_TO_MESSENGER]: "Asignado para entrega",
    // Sistema/Incidencias
    [client_1.ParcelEventType.DISCREPANCY_FOUND]: "En revisión",
    [client_1.ParcelEventType.DISCREPANCY_RESOLVED]: "Revisión completada",
    [client_1.ParcelEventType.ISSUE_REPORTED]: "Incidencia reportada",
    [client_1.ParcelEventType.NOTE_ADDED]: "Actualización de estado",
    [client_1.ParcelEventType.STATUS_CORRECTED]: "Estado actualizado",
};
/**
 * Check if an event type is public (visible to customers)
 */
const isPublicEvent = (type) => {
    return PUBLIC_EVENT_TYPES.includes(type);
};
exports.isPublicEvent = isPublicEvent;
/**
 * Get the customer-friendly message for an event type
 */
const getPublicMessage = (type) => {
    return PUBLIC_EVENT_MESSAGES[type] || "Procesando";
};
exports.getPublicMessage = getPublicMessage;
/**
 * Filter events to only include public ones
 */
const filterPublicEvents = (events) => {
    return events.filter((e) => (0, exports.isPublicEvent)(e.event_type));
};
exports.filterPublicEvents = filterPublicEvents;
/**
 * Get all public event types
 */
const getPublicEventTypes = () => {
    return [...PUBLIC_EVENT_TYPES];
};
exports.getPublicEventTypes = getPublicEventTypes;
/**
 * Map container status changes to appropriate ParcelEventType
 */
const getEventTypeForContainerStatus = (containerStatus) => {
    const statusMap = {
        LOADING: client_1.ParcelEventType.LOADED_TO_CONTAINER,
        DEPARTED: client_1.ParcelEventType.IN_TRANSIT,
        IN_TRANSIT: client_1.ParcelEventType.IN_TRANSIT,
        AT_PORT: client_1.ParcelEventType.ARRIVED_DESTINATION,
        CUSTOMS_HOLD: client_1.ParcelEventType.CUSTOMS_PROCESSING,
        CUSTOMS_CLEARED: client_1.ParcelEventType.CUSTOMS_RELEASED,
        UNLOADING: client_1.ParcelEventType.CUSTOMS_RELEASED,
    };
    return statusMap[containerStatus] || client_1.ParcelEventType.NOTE_ADDED;
};
exports.getEventTypeForContainerStatus = getEventTypeForContainerStatus;
/**
 * Map flight status changes to appropriate ParcelEventType
 */
const getEventTypeForFlightStatus = (flightStatus) => {
    const statusMap = {
        LOADING: client_1.ParcelEventType.LOADED_TO_FLIGHT,
        DEPARTED: client_1.ParcelEventType.IN_TRANSIT,
        IN_TRANSIT: client_1.ParcelEventType.IN_TRANSIT,
        LANDED: client_1.ParcelEventType.ARRIVED_DESTINATION,
        CUSTOMS_HOLD: client_1.ParcelEventType.CUSTOMS_PROCESSING,
        CUSTOMS_CLEARED: client_1.ParcelEventType.CUSTOMS_RELEASED,
        UNLOADING: client_1.ParcelEventType.CUSTOMS_RELEASED,
    };
    return statusMap[flightStatus] || client_1.ParcelEventType.NOTE_ADDED;
};
exports.getEventTypeForFlightStatus = getEventTypeForFlightStatus;
