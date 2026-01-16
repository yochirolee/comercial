import { Router } from 'express';
import { ExportController } from '../controllers/export.controller.js';

export const exportRouter = Router();

// ==========================================
// EXPORTAR OFERTAS GENERALES (Lista de precios)
// ==========================================
exportRouter.get('/ofertas-generales/:id/pdf', ExportController.ofertaGeneralPdf);
exportRouter.get('/ofertas-generales/:id/excel', ExportController.ofertaGeneralExcel);

// ==========================================
// EXPORTAR OFERTAS A CLIENTE (Sin flete/seguro)
// ==========================================
exportRouter.get('/ofertas-cliente/:id/pdf', ExportController.ofertaClientePdf);
exportRouter.get('/ofertas-cliente/:id/excel', ExportController.ofertaClienteExcel);

// ==========================================
// EXPORTAR OFERTAS A IMPORTADORA (Con FOB ajustado + Flete + Seguro = CIF)
// ==========================================
exportRouter.get('/ofertas-importadora/:id/pdf', ExportController.ofertaImportadoraPdf);
exportRouter.get('/ofertas-importadora/:id/excel', ExportController.ofertaImportadoraExcel);

// ==========================================
// EXPORTAR FACTURAS
// ==========================================
exportRouter.get('/facturas/:id/pdf', ExportController.facturaPdf);
exportRouter.get('/facturas/:id/excel', ExportController.facturaExcel);
