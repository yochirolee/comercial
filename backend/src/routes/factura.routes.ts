import { Router } from 'express';
import { FacturaController } from '../controllers/factura.controller.js';

export const facturaRouter = Router();

// GET /api/facturas - Listar todas las facturas
facturaRouter.get('/', FacturaController.getAll);

// GET /api/facturas/:id - Obtener factura por ID
facturaRouter.get('/:id', FacturaController.getById);

// POST /api/facturas - Crear nueva factura
facturaRouter.post('/', FacturaController.create);

// POST /api/facturas/desde-oferta - Crear factura desde una oferta
facturaRouter.post('/desde-oferta', FacturaController.createFromOferta);

// PUT /api/facturas/:id - Actualizar factura
facturaRouter.put('/:id', FacturaController.update);

// DELETE /api/facturas/:id - Eliminar factura
facturaRouter.delete('/:id', FacturaController.delete);

// POST /api/facturas/:id/items - Agregar item a factura
facturaRouter.post('/:id/items', FacturaController.addItem);

// PUT /api/facturas/:id/items/:itemId - Actualizar item de factura
facturaRouter.put('/:id/items/:itemId', FacturaController.updateItem);

// DELETE /api/facturas/:id/items/:itemId - Eliminar item de factura
facturaRouter.delete('/:id/items/:itemId', FacturaController.removeItem);

// PUT /api/facturas/:id/estado - Cambiar estado de factura
facturaRouter.put('/:id/estado', FacturaController.updateEstado);

