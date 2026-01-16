import { Router } from 'express';
import { UnidadMedidaController } from '../controllers/unidadMedida.controller.js';

export const unidadMedidaRouter = Router();

// GET /api/unidades-medida - Listar todas las unidades de medida
unidadMedidaRouter.get('/', UnidadMedidaController.getAll);

// GET /api/unidades-medida/:id - Obtener unidad por ID
unidadMedidaRouter.get('/:id', UnidadMedidaController.getById);

// POST /api/unidades-medida - Crear nueva unidad de medida
unidadMedidaRouter.post('/', UnidadMedidaController.create);

// PUT /api/unidades-medida/:id - Actualizar unidad de medida
unidadMedidaRouter.put('/:id', UnidadMedidaController.update);

// DELETE /api/unidades-medida/:id - Eliminar unidad de medida
unidadMedidaRouter.delete('/:id', UnidadMedidaController.delete);

