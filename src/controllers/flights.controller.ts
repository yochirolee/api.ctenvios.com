import { Response } from "express";
import { FlightStatus } from "@prisma/client";
import flightsRepository from "../repositories/flights.repository";

interface FlightRequest {
   user?: {
      id: string;
      forwarder_id?: number;
      agency_id?: number;
   };
   query: {
      page?: number;
      limit?: number;
      status?: FlightStatus;
   };
   body: any;
   params: {
      id?: number;
      awbNumber?: string;
      trackingNumber?: string;
   };
}

export const flights = {
   /**
    * Get all flights with pagination and filters
    */
   getAll: async (req: FlightRequest, res: Response): Promise<void> => {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const status = req.query.status as FlightStatus | undefined;
      const user = req.user;
      const forwarder_id = user?.forwarder_id;

      const result = await flightsRepository.getAll(page, limit, forwarder_id, status);

      res.status(200).json({
         data: result.flights,
         pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit),
         },
      });
   },

   /**
    * Get flight by ID
    */
   getById: async (req: FlightRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const flight = await flightsRepository.getById(id!);

      if (!flight) {
         res.status(404).json({ error: "Flight not found" });
         return;
      }

      res.status(200).json(flight);
   },

   /**
    * Get flight by AWB number
    */
   getByAwbNumber: async (req: FlightRequest, res: Response): Promise<void> => {
      const { awbNumber } = req.params;
      const flight = await flightsRepository.getByAwbNumber(awbNumber!);

      if (!flight) {
         res.status(404).json({ error: "Flight not found" });
         return;
      }

      res.status(200).json(flight);
   },

   /**
    * Create a new flight
    */
   create: async (req: FlightRequest, res: Response): Promise<void> => {
      const user = req.user;

      if (!user?.forwarder_id) {
         res.status(403).json({ error: "Only forwarder users can create flights" });
         return;
      }

      const flight = await flightsRepository.create({
         ...req.body,
         forwarder_id: user.forwarder_id,
         created_by_id: user.id,
         estimated_departure: req.body.estimated_departure ? new Date(req.body.estimated_departure) : undefined,
         estimated_arrival: req.body.estimated_arrival ? new Date(req.body.estimated_arrival) : undefined,
      });

      res.status(201).json(flight);
   },

   /**
    * Update flight
    */
   update: async (req: FlightRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const user = req.user;

      const updateData = {
         ...req.body,
         estimated_departure: req.body.estimated_departure ? new Date(req.body.estimated_departure) : undefined,
         estimated_arrival: req.body.estimated_arrival ? new Date(req.body.estimated_arrival) : undefined,
         actual_departure: req.body.actual_departure ? new Date(req.body.actual_departure) : undefined,
         actual_arrival: req.body.actual_arrival ? new Date(req.body.actual_arrival) : undefined,
      };

      const flight = await flightsRepository.update(id!, updateData, user?.id);

      res.status(200).json(flight);
   },

   /**
    * Delete flight
    */
   delete: async (req: FlightRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const flight = await flightsRepository.delete(id!);
      res.status(200).json(flight);
   },

   /**
    * Get parcels in flight
    */
   getParcels: async (req: FlightRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const result = await flightsRepository.getParcels(id!, page, limit);

      res.status(200).json({
         data: result.parcels,
         pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit),
         },
      });
   },

   /**
    * Add parcel to flight
    */
   addParcel: async (req: FlightRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { tracking_number } = req.body;
      const user = req.user;

      const parcel = await flightsRepository.addParcel(id!, tracking_number, user!.id);

      res.status(200).json(parcel);
   },

   /**
    * Remove parcel from flight
    */
   removeParcel: async (req: FlightRequest, res: Response): Promise<void> => {
      const { id, trackingNumber } = req.params;
      const user = req.user;

      const parcel = await flightsRepository.removeParcel(Number(id), trackingNumber!, user!.id);

      res.status(200).json(parcel);
   },

   /**
    * Update flight status
    */
   updateStatus: async (req: FlightRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { status, location, description } = req.body;
      const user = req.user;

      const flight = await flightsRepository.updateStatus(id!, status, user!.id, location, description);

      res.status(200).json(flight);
   },

   /**
    * Get flight events
    */
   getEvents: async (req: FlightRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const events = await flightsRepository.getEvents(id!);
      res.status(200).json(events);
   },

   /**
    * Get parcels ready to be added to flight
    */
   getReadyParcels: async (req: FlightRequest, res: Response): Promise<void> => {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const user = req.user;

      if (!user?.forwarder_id) {
         res.status(403).json({ error: "Only forwarder users can access this resource" });
         return;
      }

      const result = await flightsRepository.getReadyParcels(user.forwarder_id, page, limit);

      res.status(200).json({
         data: result.parcels,
         pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit),
         },
      });
   },
};

export default flights;
