import { Request, Response } from "express";
import repository from "../repositories";

const productController = {
   create: async (req: Request, res: Response) => {
      const product = await repository.products.create(req.body);
      res.status(201).json(product);
   },
   getAll: async (req: Request, res: Response) => {
      const products = await repository.products.getAll();
      res.status(200).json(products);
   },
   getById: async (req: Request, res: Response) => {
      const { id } = req.params;
      const product = await repository.products.getById(Number(id));
      res.status(200).json(product);
   },
   update: async (req: Request, res: Response) => {
      const { id } = req.params;
      const product = await repository.products.update(Number(id), req.body);
      res.status(200).json(product);
   },
   delete: async (req: Request, res: Response) => {
      const { id } = req.params;
      const product = await repository.products.delete(Number(id));
      res.status(200).json(product);
   },
   connectServices: async (req: Request, res: Response) => {
      const { id } = req.params;
      const service_id = req.body.service_id;
      const product = await repository.products.connectServices(Number(id), Number(service_id));
      res.status(200).json(product);
   },
   disconnectServices: async (req: Request, res: Response) => {
      const { id } = req.params;
      const service_id = req.body.service_id;
      const product = await repository.products.disconnectServices(Number(id), Number(service_id));
      res.status(200).json(product);
   },
};

export default productController;
