import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'zas-secret-key-change-in-production';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
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

