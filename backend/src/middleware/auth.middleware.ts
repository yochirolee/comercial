import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || 'zas-secret-key-change-in-production';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRol?: string;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: 'Token no proporcionado' });
    return;
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2) {
    res.status(401).json({ error: 'Token mal formateado' });
    return;
  }

  const [scheme, token] = parts;

  if (!/^Bearer$/i.test(scheme)) {
    res.status(401).json({ error: 'Token mal formateado' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    
    (req as AuthRequest).userId = decoded.userId;
    (req as AuthRequest).userEmail = decoded.email;
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido o expirado' });
    return;
  }
}

// Middleware para verificar que el usuario es admin
export async function adminMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = (req as AuthRequest).userId;
  
  if (!userId) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { rol: true },
    });

    if (!usuario || usuario.rol !== 'admin') {
      res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
      return;
    }

    (req as AuthRequest).userRol = usuario.rol;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Error al verificar permisos' });
    return;
  }
}
