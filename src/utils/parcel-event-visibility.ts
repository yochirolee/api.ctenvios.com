import { ParcelEventType } from "@prisma/client";

/**
 * Parcel Event Visibility Helper
 * Determines which events are visible to customers (public) vs internal staff only
 * Following: TypeScript strict typing, Repository pattern conventions
 */

// Eventos visibles al cliente
const PUBLIC_EVENT_TYPES: ParcelEventType[] = [
   ParcelEventType.BILLED,
   ParcelEventType.IN_TRANSIT,
   ParcelEventType.ARRIVED_DESTINATION,
   ParcelEventType.CUSTOMS_PROCESSING,
   ParcelEventType.CUSTOMS_RELEASED,
   ParcelEventType.OUT_FOR_DELIVERY,
   ParcelEventType.DELIVERED,
   ParcelEventType.DELIVERY_FAILED,
   ParcelEventType.DELIVERY_RESCHEDULED,
];

// Mensajes amigables para el cliente (en español)
const PUBLIC_EVENT_MESSAGES: Record<ParcelEventType, string> = {
   // Públicos
   [ParcelEventType.BILLED]: "Paquete recibido en agencia",
   [ParcelEventType.IN_TRANSIT]: "En tránsito hacia destino",
   [ParcelEventType.ARRIVED_DESTINATION]: "Arribó al país de destino",
   [ParcelEventType.CUSTOMS_PROCESSING]: "En proceso de aduana",
   [ParcelEventType.CUSTOMS_RELEASED]: "Liberado de aduana",
   [ParcelEventType.OUT_FOR_DELIVERY]: "En camino para entrega",
   [ParcelEventType.DELIVERED]: "Entregado",
   [ParcelEventType.DELIVERY_FAILED]: "Intento de entrega fallido",
   [ParcelEventType.DELIVERY_RESCHEDULED]: "Entrega reprogramada",
   // Internos (no se mostrarán al cliente, pero definimos mensajes por si acaso)
   [ParcelEventType.ADDED_TO_PALLET]: "Procesando en almacén",
   [ParcelEventType.REMOVED_FROM_PALLET]: "Procesando en almacén",
   [ParcelEventType.ADDED_TO_DISPATCH]: "Procesando envío",
   [ParcelEventType.RECEIVED_IN_DISPATCH]: "Recibido en centro de distribución",
   [ParcelEventType.LOADED_TO_CONTAINER]: "Procesando envío internacional",
   [ParcelEventType.REMOVED_FROM_CONTAINER]: "Procesando",
   [ParcelEventType.LOADED_TO_FLIGHT]: "Procesando envío internacional",
   [ParcelEventType.REMOVED_FROM_FLIGHT]: "Procesando",
   [ParcelEventType.MANIFEST_SCANNED]: "Verificando paquete",
   [ParcelEventType.WAREHOUSE_RECEIVED]: "Recibido en centro de distribución",
   [ParcelEventType.WAREHOUSE_TRANSFERRED]: "En tránsito interno",
   [ParcelEventType.ASSIGNED_TO_ROUTE]: "Preparando entrega",
   [ParcelEventType.ASSIGNED_TO_MESSENGER]: "Asignado para entrega",
   // Sistema/Incidencias
   [ParcelEventType.DISCREPANCY_FOUND]: "En revisión",
   [ParcelEventType.DISCREPANCY_RESOLVED]: "Revisión completada",
   [ParcelEventType.ISSUE_REPORTED]: "Incidencia reportada",
   [ParcelEventType.NOTE_ADDED]: "Actualización de estado",
   [ParcelEventType.STATUS_CORRECTED]: "Estado actualizado",
};

/**
 * Check if an event type is public (visible to customers)
 */
export const isPublicEvent = (type: ParcelEventType): boolean => {
   return PUBLIC_EVENT_TYPES.includes(type);
};

/**
 * Get the customer-friendly message for an event type
 */
export const getPublicMessage = (type: ParcelEventType): string => {
   return PUBLIC_EVENT_MESSAGES[type] || "Procesando";
};

/**
 * Filter events to only include public ones
 */
export const filterPublicEvents = <T extends { event_type: ParcelEventType }>(
   events: T[]
): T[] => {
   return events.filter((e) => isPublicEvent(e.event_type));
};

/**
 * Get all public event types
 */
export const getPublicEventTypes = (): ParcelEventType[] => {
   return [...PUBLIC_EVENT_TYPES];
};

/**
 * Map container status changes to appropriate ParcelEventType
 */
export const getEventTypeForContainerStatus = (
   containerStatus: string
): ParcelEventType => {
   const statusMap: Record<string, ParcelEventType> = {
      LOADING: ParcelEventType.LOADED_TO_CONTAINER,
      DEPARTED: ParcelEventType.IN_TRANSIT,
      IN_TRANSIT: ParcelEventType.IN_TRANSIT,
      AT_PORT: ParcelEventType.ARRIVED_DESTINATION,
      CUSTOMS_HOLD: ParcelEventType.CUSTOMS_PROCESSING,
      CUSTOMS_CLEARED: ParcelEventType.CUSTOMS_RELEASED,
      UNLOADING: ParcelEventType.CUSTOMS_RELEASED,
   };
   return statusMap[containerStatus] || ParcelEventType.NOTE_ADDED;
};

/**
 * Map flight status changes to appropriate ParcelEventType
 */
export const getEventTypeForFlightStatus = (
   flightStatus: string
): ParcelEventType => {
   const statusMap: Record<string, ParcelEventType> = {
      LOADING: ParcelEventType.LOADED_TO_FLIGHT,
      DEPARTED: ParcelEventType.IN_TRANSIT,
      IN_TRANSIT: ParcelEventType.IN_TRANSIT,
      LANDED: ParcelEventType.ARRIVED_DESTINATION,
      CUSTOMS_HOLD: ParcelEventType.CUSTOMS_PROCESSING,
      CUSTOMS_CLEARED: ParcelEventType.CUSTOMS_RELEASED,
      UNLOADING: ParcelEventType.CUSTOMS_RELEASED,
   };
   return statusMap[flightStatus] || ParcelEventType.NOTE_ADDED;
};
