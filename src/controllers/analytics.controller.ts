import { Request, Response } from "express";
import { repository } from "../repository";

export const analytics = {
	getSalesReport: async (req: Request, res: Response): Promise<void> => {
		let { year, agencyId, startDate, endDate } = req.query;

		// Validate required year parameter
		if (!year) {
			const currentYear = new Date().getFullYear().toString();
			year = currentYear;
		}

		const yearNum = Number(year);
		const agencyIdNum = agencyId ? Number(agencyId) : 0;

		// Parse optional date parameters
		const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
		const parsedEndDate = endDate ? new Date(endDate as string) : undefined;

		// Default date range if not provided
		const defaultStartDate = new Date(`${yearNum}-01-01`);
		const defaultEndDate = new Date(`${yearNum}-12-31`);

			const report = await repository.analytics.getSalesReport(
			yearNum,
			agencyIdNum,
			parsedStartDate || defaultStartDate,
			parsedEndDate || defaultEndDate,
		);

		res.status(200).json(report);
	},
};
