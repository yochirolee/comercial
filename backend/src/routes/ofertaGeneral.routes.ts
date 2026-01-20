import { Router } from 'express';
import { OfertaGeneralController } from '../controllers/ofertaGeneral.controller.js';

export const ofertaGeneralRouter = Router();

// GET /api/ofertas-generales - Listar todas las ofertas generales
ofertaGeneralRouter.get('/', OfertaGeneralController.getAll);

// GET /api/ofertas-generales/next-number - Obtener siguiente número disponible
ofertaGeneralRouter.get('/next-number', OfertaGeneralController.getNextNumber);

// GET /api/ofertas-generales/:id - Obtener oferta por ID
ofertaGeneralRouter.get('/:id', OfertaGeneralController.getById);

// POST /api/ofertas-generales - Crear nueva oferta general
ofertaGeneralRouter.post('/', OfertaGeneralController.create);

// PUT /api/ofertas-generales/:id - Actualizar oferta general
ofertaGeneralRouter.put('/:id', OfertaGeneralController.update);

// DELETE /api/ofertas-generales/:id - Eliminar oferta general
ofertaGeneralRouter.delete('/:id', OfertaGeneralController.delete);

// POST /api/ofertas-generales/:id/items - Agregar item a oferta
ofertaGeneralRouter.post('/:id/items', OfertaGeneralController.addItem);

// PUT /api/ofertas-generales/:id/items/:itemId - Actualizar item de oferta
ofertaGeneralRouter.put('/:id/items/:itemId', OfertaGeneralController.updateItem);

// DELETE /api/ofertas-generales/:id/items/:itemId - Eliminar item de oferta
ofertaGeneralRouter.delete('/:id/items/:itemId', OfertaGeneralController.removeItem);

// POST /api/ofertas-generales/:id/adjust-prices - Ajustar precios para llegar a un total deseado
ofertaGeneralRouter.post('/:id/adjust-prices', OfertaGeneralController.adjustPrices);
