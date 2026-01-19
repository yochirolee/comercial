import { Router } from 'express';
import { ProductoController } from '../controllers/producto.controller.js';

export const productoRouter = Router();

// GET /api/productos - Listar todos los productos
productoRouter.get('/', ProductoController.getAll);

// GET /api/productos/next-code - Obtener siguiente código disponible
productoRouter.get('/next-code', ProductoController.getNextCode);

// GET /api/productos/:id - Obtener producto por ID
productoRouter.get('/:id', ProductoController.getById);

// POST /api/productos - Crear nuevo producto
productoRouter.post('/', ProductoController.create);

// PUT /api/productos/:id - Actualizar producto
productoRouter.put('/:id', ProductoController.update);

// DELETE /api/productos/:id - Eliminar producto
productoRouter.delete('/:id', ProductoController.delete);

