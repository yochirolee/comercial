import { Router } from 'express';
import { OfertaClienteController } from '../controllers/ofertaCliente.controller.js';

export const ofertaClienteRouter = Router();

// GET /api/ofertas-cliente/next-number - Obtener siguiente número de oferta
ofertaClienteRouter.get('/next-number', OfertaClienteController.getNextNumber);

// GET /api/ofertas-cliente - Listar todas las ofertas a clientes
ofertaClienteRouter.get('/', OfertaClienteController.getAll);

// GET /api/ofertas-cliente/:id - Obtener oferta por ID
ofertaClienteRouter.get('/:id', OfertaClienteController.getById);

// POST /api/ofertas-cliente - Crear nueva oferta al cliente
ofertaClienteRouter.post('/', OfertaClienteController.create);

// PUT /api/ofertas-cliente/:id - Actualizar oferta al cliente
ofertaClienteRouter.put('/:id', OfertaClienteController.update);

// DELETE /api/ofertas-cliente/:id - Eliminar oferta al cliente
ofertaClienteRouter.delete('/:id', OfertaClienteController.delete);

// POST /api/ofertas-cliente/:id/items - Agregar item a oferta
ofertaClienteRouter.post('/:id/items', OfertaClienteController.addItem);

// PUT /api/ofertas-cliente/:id/items/:itemId - Actualizar item de oferta
ofertaClienteRouter.put('/:id/items/:itemId', OfertaClienteController.updateItem);

// DELETE /api/ofertas-cliente/:id/items/:itemId - Eliminar item de oferta
ofertaClienteRouter.delete('/:id/items/:itemId', OfertaClienteController.removeItem);

// POST /api/ofertas-cliente/:id/adjust-prices - Ajustar precios para llegar a un total deseado
ofertaClienteRouter.post('/:id/adjust-prices', OfertaClienteController.adjustPrices);
