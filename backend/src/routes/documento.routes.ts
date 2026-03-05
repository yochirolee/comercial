import { Router } from 'express';
import { DocumentoController } from '../controllers/documento.controller.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware.js';

export const documentoRouter = Router();

// Todas las rutas requieren autenticación y ser administrador
documentoRouter.use(authMiddleware);
documentoRouter.use(adminMiddleware);

// GET /api/documentos/enduser/:ofertaClienteId - Generar documento end user
documentoRouter.get('/enduser/:ofertaClienteId', DocumentoController.generateEndUserDocument);

// GET /api/documentos/cierre-expediente/:ofertaClienteId - Generar documento cierre de expediente
documentoRouter.get('/cierre-expediente/:ofertaClienteId', DocumentoController.generateCierreExpedienteDocument);

// GET /api/documentos/checklist/:ofertaClienteId - Generar documento checklist
documentoRouter.get('/checklist/:ofertaClienteId', DocumentoController.generateChecklistDocument);
