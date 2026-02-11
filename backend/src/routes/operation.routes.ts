import { Router } from 'express';
import { OperationController } from '../controllers/operation.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

export const operationRouter = Router();

// Todas las rutas requieren autenticación
operationRouter.use(authMiddleware);

// POST /api/operations/from-offer - Crear operación desde Oferta a Cliente
operationRouter.post('/from-offer', OperationController.createFromOffer);

// GET /api/operations - Listar operaciones (con filtros: ?type=COMMERCIAL&status=Draft&search=Z20006)
operationRouter.get('/', OperationController.getAll);

// POST /api/operations - Crear operación manual (PARCEL o COMMERCIAL)
operationRouter.post('/', OperationController.create);

// GET /api/operations/:id - Obtener operación por ID con detalles
operationRouter.get('/:id', OperationController.getById);

// PATCH /api/operations/:id - Actualizar operación
operationRouter.patch('/:id', OperationController.update);

// DELETE /api/operations/:id - Eliminar operación
operationRouter.delete('/:id', OperationController.delete);

// POST /api/operations/:id/containers - Agregar contenedor a operación
operationRouter.post('/:id/containers', OperationController.addContainer);

// PATCH /api/operations/:id/containers/:containerId - Actualizar contenedor
operationRouter.patch('/:id/containers/:containerId', OperationController.updateContainer);

// DELETE /api/operations/:id/containers/:containerId - Eliminar contenedor
operationRouter.delete('/:id/containers/:containerId', OperationController.deleteContainer);

// POST /api/operations/:id/events - Agregar evento a operación
operationRouter.post('/:id/events', OperationController.addEvent);

// POST /api/operations/:id/containers/:containerId/events - Agregar evento a contenedor
operationRouter.post('/:id/containers/:containerId/events', OperationController.addContainerEvent);
