import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// Rutas públicas
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);
router.get('/verify-reset-token/:token', AuthController.verifyResetToken);

// Rutas protegidas
router.get('/me', authMiddleware, AuthController.me);
router.put('/profile', authMiddleware, AuthController.updateProfile);
router.put('/change-password', authMiddleware, AuthController.changePassword);

export default router;

