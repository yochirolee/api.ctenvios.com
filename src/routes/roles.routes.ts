import { Router } from "express";
import { Roles } from "@prisma/client";
import { authMiddleware } from "../middlewares/auth-midleware";
import z from "zod";
const router = Router();




router.get("/", authMiddleware, async (req: any, res: any) => {
	const roles = Object.values(Roles);
	//how to get equal or below roles
	const user = req?.user;
	const permited_roles = [Roles.ROOT, Roles.ADMINISTRATOR];
	if(!permited_roles.includes(user.role)) {
		return res.status(403).json({ message: "You are not authorized to get roles" });
	}
	//convert to array of objects with id and name
	const rolesWithId = roles.map((role) => ({ id: role, name: role }));
	res.status(200).json(rolesWithId);
});

export default router;
