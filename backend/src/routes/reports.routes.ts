import { Router } from 'express';
import { ReportsController } from '../controllers/reports.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

export const reportsRouter = Router();

reportsRouter.use(authMiddleware);

reportsRouter.get('/ofertas-cliente', ReportsController.ofertasCliente);
reportsRouter.get('/productos-precios', ReportsController.productosPrecios);
reportsRouter.get('/clientes-con-facturas', ReportsController.clientesConFacturas);
reportsRouter.get('/productos-en-ofertas', ReportsController.productosEnOfertas);
