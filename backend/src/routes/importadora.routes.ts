import { Router } from 'express';
import { ImportadoraController } from '../controllers/importadora.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

export const importadoraRouter = Router();

// Todas las rutas requieren autenticación
importadoraRouter.use(authMiddleware);

// GET /api/importadoras - Listar todas las importadoras
importadoraRouter.get('/', ImportadoraController.getAll);

// GET /api/importadoras/:id - Obtener importadora por ID con detalles
importadoraRouter.get('/:id', ImportadoraController.getById);

// POST /api/importadoras - Crear nueva importadora
importadoraRouter.post('/', ImportadoraController.create);

// PUT /api/importadoras/:id - Actualizar importadora
importadoraRouter.put('/:id', ImportadoraController.update);

// DELETE /api/importadoras/:id - Eliminar importadora
importadoraRouter.delete('/:id', ImportadoraController.delete);

// POST /api/importadoras/:id/clientes - Agregar cliente a importadora
importadoraRouter.post('/:id/clientes', ImportadoraController.addCliente);

// DELETE /api/importadoras/:id/clientes - Remover cliente de importadora
importadoraRouter.delete('/:id/clientes', ImportadoraController.removeCliente);
