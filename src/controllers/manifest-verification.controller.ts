import { Response } from "express";
import { VerificationStatus } from "@prisma/client";
import manifestVerificationRepository from "../repositories/manifest-verification.repository";

/**
 * Manifest Verification Controller
 * Following: Repository pattern, TypeScript strict typing
 */

interface VerificationRequest {
   user?: {
      id: string;
   };
   query: {
      page?: number;
      limit?: number;
      status?: VerificationStatus;
      container_id?: number;
      flight_id?: number;
   };
   body: any;
   params: {
      id?: number;
      discrepancyId?: number;
   };
}

export const manifestVerification = {
   /**
    * Get all verifications with pagination and filters
    */
   getAll: async (req: VerificationRequest, res: Response): Promise<void> => {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const status = req.query.status as VerificationStatus | undefined;
      const container_id = req.query.container_id ? Number(req.query.container_id) : undefined;
      const flight_id = req.query.flight_id ? Number(req.query.flight_id) : undefined;

      const result = await manifestVerificationRepository.getAll(page, limit, status, container_id, flight_id);

      res.status(200).json({
         rows: result.verifications,
         total: result.total,
         page,
         limit,
      });
   },

   /**
    * Get verification by ID
    */
   getById: async (req: VerificationRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const verification = await manifestVerificationRepository.getById(id!);

      if (!verification) {
         res.status(404).json({ error: "Verification not found" });
         return;
      }

      res.status(200).json(verification);
   },

   /**
    * Start container verification
    */
   startContainerVerification: async (req: VerificationRequest, res: Response): Promise<void> => {
      const { container_id } = req.body;
      const user = req.user!;

      const verification = await manifestVerificationRepository.startContainerVerification(container_id, user.id);

      res.status(201).json(verification);
   },

   /**
    * Start flight verification
    */
   startFlightVerification: async (req: VerificationRequest, res: Response): Promise<void> => {
      const { flight_id } = req.body;
      const user = req.user!;

      const verification = await manifestVerificationRepository.startFlightVerification(flight_id, user.id);

      res.status(201).json(verification);
   },

   /**
    * Scan parcel for verification
    */
   scanParcel: async (req: VerificationRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { tracking_number } = req.body;
      const user = req.user!;

      const result = await manifestVerificationRepository.scanParcel(id!, tracking_number, user.id);

      res.status(200).json(result);
   },

   /**
    * Complete verification
    */
   complete: async (req: VerificationRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { notes } = req.body;
      const user = req.user!;

      const verification = await manifestVerificationRepository.complete(id!, user.id, notes);

      res.status(200).json(verification);
   },

   /**
    * Report damaged parcel
    */
   reportDamage: async (req: VerificationRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { tracking_number, notes } = req.body;
      const user = req.user!;

      const discrepancy = await manifestVerificationRepository.reportDamage(id!, tracking_number, user.id, notes);

      res.status(201).json(discrepancy);
   },

   /**
    * Resolve discrepancy
    */
   resolveDiscrepancy: async (req: VerificationRequest, res: Response): Promise<void> => {
      const { discrepancyId } = req.params;
      const { resolution } = req.body;
      const user = req.user!;

      const discrepancy = await manifestVerificationRepository.resolveDiscrepancy(discrepancyId!, resolution, user.id);

      res.status(200).json(discrepancy);
   },

   /**
    * Get discrepancies for a verification
    */
   getDiscrepancies: async (req: VerificationRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      const discrepancies = await manifestVerificationRepository.getDiscrepancies(id!);

      res.status(200).json(discrepancies);
   },
};

export default manifestVerification;
