import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || 'zas-secret-key-change-in-production';

/**
 * Si el usuario autenticado es `operador`, solo puede usar rutas de operaciones,
 * lectura de importadoras/carriers (dropdowns), listados GET de ofertas/facturas
 * para el dashboard, y perfil propio.
 */
export async function operadorApiGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);
  let userId: string;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    userId = decoded.userId;
  } catch {
    next();
    return;
  }

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { rol: true },
    });
    const rol = (usuario?.rol ?? 'comercial').trim().toLowerCase();
    if (rol !== 'operador') {
      next();
      return;
    }

    const path = req.originalUrl.split('?')[0];
    const method = req.method.toUpperCase();

    if (path.startsWith('/api/operations')) {
      if (method === 'POST' && (path === '/api/operations/from-offer' || path.endsWith('/from-offer'))) {
        res.status(403).json({ error: 'Los operadores no pueden crear operaciones comerciales desde oferta.' });
        return;
      }
      if (method === 'POST' && path === '/api/operations') {
        const opType = (req.body as { operationType?: string })?.operationType;
        if (opType === 'COMMERCIAL') {
          res.status(403).json({ error: 'Los operadores solo pueden crear operaciones Parcel.' });
          return;
        }
      }
      next();
      return;
    }
    if (path.startsWith('/api/importadoras') && method === 'GET') {
      next();
      return;
    }
    if (path.startsWith('/api/carriers') && method === 'GET') {
      next();
      return;
    }

    // Lectura de listados para el resumen del dashboard (funnel y antigüedad de facturas pendientes).
    if (method === 'GET') {
      if (
        path === '/api/ofertas-cliente' ||
        path === '/api/ofertas-importadora' ||
        path === '/api/facturas'
      ) {
        next();
        return;
      }
    }

    const allowedExact: Record<string, string[]> = {
      '/api/auth/me': ['GET'],
      '/api/auth/profile': ['PUT'],
      '/api/auth/change-password': ['PUT'],
    };
    const methods = allowedExact[path];
    if (methods?.includes(method)) {
      next();
      return;
    }

    res.status(403).json({ error: 'Acceso denegado para este rol.' });
  } catch {
    res.status(500).json({ error: 'Error al verificar permisos' });
  }
}
