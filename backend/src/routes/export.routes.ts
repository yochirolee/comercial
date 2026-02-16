import { Router } from 'express';
import { ExportController } from '../controllers/export.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

export const exportRouter = Router();

// Todas las rutas requieren autenticación
exportRouter.use(authMiddleware);

// ==========================================
// EXPORTAR OFERTAS GENERALES (Lista de precios) - Individual
// TODO: Implementar funciones PDF/Excel individuales si se necesitan
// ==========================================
// exportRouter.get('/ofertas-generales/:id/pdf', ExportController.ofertaGeneralPdf);
// exportRouter.get('/ofertas-generales/:id/excel', ExportController.ofertaGeneralExcel);

// ==========================================
// EXPORTAR OFERTAS A CLIENTE (Sin flete/seguro) - Individual
// TODO: Implementar funciones PDF/Excel individuales si se necesitan
// ==========================================
// exportRouter.get('/ofertas-cliente/:id/pdf', ExportController.ofertaClientePdf);
// exportRouter.get('/ofertas-cliente/:id/excel', ExportController.ofertaClienteExcel);

// ==========================================
// EXPORTAR OFERTAS A IMPORTADORA (Con FOB ajustado + Flete + Seguro = CIF) - Individual
// TODO: Implementar funciones PDF/Excel individuales si se necesitan
// ==========================================
// exportRouter.get('/ofertas-importadora/:id/pdf', ExportController.ofertaImportadoraPdf);
// exportRouter.get('/ofertas-importadora/:id/excel', ExportController.ofertaImportadoraExcel);

// ==========================================
// EXPORTAR FACTURAS - Individual
// TODO: Implementar funciones PDF/Excel individuales si se necesitan
// ==========================================
// exportRouter.get('/facturas/:id/pdf', ExportController.facturaPdf);
// exportRouter.get('/facturas/:id/excel', ExportController.facturaExcel);

// ==========================================
// EXPORTAR TODOS LOS DATOS (Listas completas)
// ==========================================
exportRouter.get('/clientes', ExportController.exportClientes);
exportRouter.get('/productos', ExportController.exportProductos);
exportRouter.get('/ofertas-cliente/all', ExportController.exportOfertasCliente);
exportRouter.get('/ofertas-generales/all', ExportController.exportOfertasGenerales);
exportRouter.get('/ofertas-importadora/all', ExportController.exportOfertasImportadora);
exportRouter.get('/facturas/all', ExportController.exportFacturas);
