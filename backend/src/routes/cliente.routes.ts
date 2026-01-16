import { Router } from 'express';
import { ClienteController } from '../controllers/cliente.controller.js';

export const clienteRouter = Router();

// GET /api/clientes - Listar todos los clientes
clienteRouter.get('/', ClienteController.getAll);

// GET /api/clientes/:id - Obtener cliente por ID
clienteRouter.get('/:id', ClienteController.getById);

// POST /api/clientes - Crear nuevo cliente
clienteRouter.post('/', ClienteController.create);

// PUT /api/clientes/:id - Actualizar cliente
clienteRouter.put('/:id', ClienteController.update);

// DELETE /api/clientes/:id - Eliminar cliente
clienteRouter.delete('/:id', ClienteController.delete);

