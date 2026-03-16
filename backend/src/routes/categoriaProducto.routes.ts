import { Router } from 'express';
import { CategoriaProductoController } from '../controllers/categoriaProducto.controller.js';

export const categoriaProductoRouter = Router();

categoriaProductoRouter.get('/', CategoriaProductoController.getAll);
categoriaProductoRouter.post('/', CategoriaProductoController.create);
categoriaProductoRouter.put('/:id', CategoriaProductoController.update);
categoriaProductoRouter.delete('/:id', CategoriaProductoController.delete);
