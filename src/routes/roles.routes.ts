import { Router } from "express";
import { Roles } from "@prisma/client";

const router = Router();

router.get("/", async (req, res) => {
	const roles = Object.values(Roles);
	res.status(200).json(roles);
});

export default router;
