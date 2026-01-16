import { Router } from 'express';
import { EmpresaController } from '../controllers/empresa.controller.js';

export const empresaRouter = Router();

// GET /api/empresa - Obtener información de la empresa
empresaRouter.get('/', EmpresaController.get);

// POST /api/empresa - Crear/Actualizar información de la empresa
empresaRouter.post('/', EmpresaController.upsert);

// PUT /api/empresa/:id - Actualizar empresa específica
empresaRouter.put('/:id', EmpresaController.update);

