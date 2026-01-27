import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware.js';

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

// Rutas de administración (solo admin)
router.get('/users', authMiddleware, adminMiddleware, AuthController.getAllUsers);
router.put('/users/:id/role', authMiddleware, adminMiddleware, AuthController.updateUserRole);
router.put('/users/:id/toggle-active', authMiddleware, adminMiddleware, AuthController.toggleUserActive);
router.delete('/users/:id', authMiddleware, adminMiddleware, AuthController.deleteUser);

export default router;

