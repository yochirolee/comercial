import { Router } from 'express';
import { CarrierController } from '../controllers/carrier.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

export const carrierRouter = Router();

carrierRouter.use(authMiddleware);

carrierRouter.get('/', CarrierController.getAll);
carrierRouter.post('/', CarrierController.create);
carrierRouter.put('/:id', CarrierController.update);
carrierRouter.delete('/:id', CarrierController.delete);

