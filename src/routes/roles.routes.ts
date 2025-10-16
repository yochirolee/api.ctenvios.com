import { Router } from "express";
import { getRolesEqualOrBelow } from "../utils/roleHierarchy";
const router = Router();
//return equal or below roles
router.get("/", async (req: any, res: any) => {
   const role = req.user.role;
   const rolesEqualOrBelow = getRolesEqualOrBelow(role);

   const rolesWithId = rolesEqualOrBelow.map((role) => ({ id: role, name: role }));

   res.status(200).json(rolesWithId);
});

export default router;
