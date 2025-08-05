import { Router } from "express";
import { Roles } from "@prisma/client";

const router = Router();

router.get("/", async (req, res) => {
	const roles = Object.values(Roles);
	//convert to array of objects with id and name
	const rolesWithId = roles.map((role) => ({ id: role, name: role }));
	res.status(200).json(rolesWithId);
});

export default router;
