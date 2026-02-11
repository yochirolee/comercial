import { Router } from 'express';
import { SearchController } from '../controllers/search.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

export const searchRouter = Router();

searchRouter.use(authMiddleware);

searchRouter.get('/', SearchController.search);
searchRouter.get('/:type/:id', SearchController.detail);
