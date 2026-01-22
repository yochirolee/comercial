import { Router } from 'express';
import { OfertaImportadoraController } from '../controllers/ofertaImportadora.controller.js';

export const ofertaImportadoraRouter = Router();

// GET /api/ofertas-importadora/next-number - Obtener siguiente número de oferta
ofertaImportadoraRouter.get('/next-number', OfertaImportadoraController.getNextNumber);

ofertaImportadoraRouter.get('/', OfertaImportadoraController.getAll);
ofertaImportadoraRouter.get('/:id', OfertaImportadoraController.getById);
ofertaImportadoraRouter.post('/', OfertaImportadoraController.create);
ofertaImportadoraRouter.post('/desde-oferta-cliente', OfertaImportadoraController.createFromOfertaCliente);
ofertaImportadoraRouter.put('/:id', OfertaImportadoraController.update);
ofertaImportadoraRouter.delete('/:id', OfertaImportadoraController.delete);

// Items
ofertaImportadoraRouter.post('/:id/items', OfertaImportadoraController.addItem);
ofertaImportadoraRouter.put('/:id/items/:itemId', OfertaImportadoraController.updateItem);
ofertaImportadoraRouter.delete('/:id/items/:itemId', OfertaImportadoraController.removeItem);

// Ajustar precios para llegar a un total CIF deseado
ofertaImportadoraRouter.post('/:id/adjust-prices', OfertaImportadoraController.adjustPrices);
