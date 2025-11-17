import { Router } from "express";
import repository from "../repositories";
import { Request, Response } from "express";
import { pricingService } from "../services/pricing.service";
const router = Router();

router.get("/", async (req: Request, res: Response) => {
   const { page = 1, limit = 25 } = req.query;
   const { dispatches: rows, total } = await repository.dispatch.get(
      parseInt(page as string),
      parseInt(limit as string)
   );
   res.status(200).json({ rows, total });
});
router.get("/:id", async (req: Request, res: Response) => {
   const dispatch = await repository.dispatch.getById(parseInt(req.params.id));
   res.status(200).json(dispatch);
});
router.post("/", async (req: any, res: Response) => {
   const user = req.user;
   const dispatch = await repository.dispatch.create({
      sender_agency_id: user.agency_id,
      receiver_agency_id: req.body.receiver_agency_id,
      created_by_id: user.id,
   });
   res.status(200).json(dispatch);
});

router.post("/:id/item", async (req: Request, res: Response) => {
   const dispatch = await repository.dispatch.getById(parseInt(req.params.id));
   if (!dispatch) {
      return res.status(400).json({ message: "Dispatch not found" });
   }

   // i need the price agreement of the item
   const item_with_rate = await repository.items.findForDispatch(req.body.hbl);
   if (!item_with_rate) {
      return res.status(400).json({ message: "Item not found" });
   }
   if (item_with_rate.dispatch_id && item_with_rate.dispatch_id == dispatch.id) {
      return res.status(400).json({ message: "Item already in dispatch" });
   }
   const itemInDispatch = await repository.dispatch.addItem(item_with_rate, parseInt(req.params.id));
   res.status(200).json(itemInDispatch);
});

router.delete("/:id", async (req: Request, res: Response) => {
   const dispatch = await repository.dispatch.delete(parseInt(req.params.id));
   if (!dispatch) {
      return res.status(400).json({ message: "Dispatch not found" });
   }
   return res.status(200).json({ message: "Dispatch deleted" });
});

export default router;
