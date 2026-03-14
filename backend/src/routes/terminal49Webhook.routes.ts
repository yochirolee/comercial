import { Router } from 'express';
import { handleWebhook, handleGlobalSyncUpdate, handleGetActiveIds } from '../controllers/terminal49Webhook.controller.js';

export const terminal49WebhookRouter = Router();

// Sin auth: Terminal49 envía POST desde sus servidores
terminal49WebhookRouter.post('/webhook', handleWebhook);

// GET /api/terminal49/active-ids - Lista de terminal49RequestId y blNo de contenedores activos (para filtrar global-sync)
terminal49WebhookRouter.get('/active-ids', handleGetActiveIds);

// POST /api/terminal49/global-sync-update - Recibe datos del global-sync de Next.js y actualiza la BD
terminal49WebhookRouter.post('/global-sync-update', handleGlobalSyncUpdate);
