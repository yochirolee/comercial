import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { sendPasswordResetEmail } from '../services/email.service.js';

const JWT_SECRET = process.env.JWT_SECRET || 'zas-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';
const RESET_TOKEN_EXPIRES_HOURS = 1;

const registerSchema = z.object({
  nombre: z.string().min(1, 'Nombre es requerido'),
  apellidos: z.string().min(1, 'Apellidos es requerido'),
  telefono: z.string().optional(),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña es requerida'),
});

export const AuthController = {
  async register(req: Request, res: Response): Promise<void> {
    const validation = registerSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const { nombre, apellidos, telefono, email, password } = validation.data;

    // Verificar si el email ya existe
    const existingUser = await prisma.usuario.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({ error: 'El email ya está registrado' });
      return;
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario
    const usuario = await prisma.usuario.create({
      data: {
        nombre,
        apellidos,
        telefono,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        telefono: true,
        email: true,
        activo: true,
        createdAt: true,
      },
    });

    // Generar token
    const token = jwt.sign(
      { userId: usuario.id, email: usuario.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      usuario,
      token,
    });
  },

  async login(req: Request, res: Response): Promise<void> {
    const validation = loginSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const { email, password } = validation.data;

    // Buscar usuario
    const usuario = await prisma.usuario.findUnique({
      where: { email },
    });

    if (!usuario) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    if (!usuario.activo) {
      res.status(401).json({ error: 'Usuario desactivado' });
      return;
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, usuario.password);

    if (!isValidPassword) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    // Generar token
    const token = jwt.sign(
      { userId: usuario.id, email: usuario.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Login exitoso',
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellidos: usuario.apellidos,
        telefono: usuario.telefono,
        email: usuario.email,
        activo: usuario.activo,
      },
      token,
    });
  },

  async me(req: Request, res: Response): Promise<void> {
    const userId = (req as any).userId;

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        telefono: true,
        email: true,
        activo: true,
        createdAt: true,
      },
    });

    if (!usuario) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    res.json(usuario);
  },

  async updateProfile(req: Request, res: Response): Promise<void> {
    const userId = (req as any).userId;
    
    const updateSchema = z.object({
      nombre: z.string().min(1).optional(),
      apellidos: z.string().min(1).optional(),
      telefono: z.string().optional(),
    });

    const validation = updateSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const usuario = await prisma.usuario.update({
      where: { id: userId },
      data: validation.data,
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        telefono: true,
        email: true,
        activo: true,
      },
    });

    res.json(usuario);
  },

  async changePassword(req: Request, res: Response): Promise<void> {
    const userId = (req as any).userId;
    
    const passwordSchema = z.object({
      currentPassword: z.string().min(1, 'Contraseña actual es requerida'),
      newPassword: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres'),
    });

    const validation = passwordSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const { currentPassword, newPassword } = validation.data;

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
    });

    if (!usuario) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    const isValidPassword = await bcrypt.compare(currentPassword, usuario.password);

    if (!isValidPassword) {
      res.status(401).json({ error: 'Contraseña actual incorrecta' });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.usuario.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Contraseña actualizada exitosamente' });
  },

  async forgotPassword(req: Request, res: Response): Promise<void> {
    const forgotSchema = z.object({
      email: z.string().email('Email inválido'),
    });

    const validation = forgotSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const { email } = validation.data;

    // Buscar usuario
    const usuario = await prisma.usuario.findUnique({
      where: { email },
    });

    // Siempre responder con éxito para no revelar si el email existe
    if (!usuario) {
      res.json({ message: 'Si el email existe, recibirás un correo con instrucciones' });
      return;
    }

    // Invalidar tokens anteriores
    await prisma.passwordResetToken.updateMany({
      where: { 
        usuarioId: usuario.id,
        used: false,
      },
      data: { used: true },
    });

    // Generar token único
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + RESET_TOKEN_EXPIRES_HOURS);

    // Guardar token
    await prisma.passwordResetToken.create({
      data: {
        token,
        usuarioId: usuario.id,
        expiresAt,
      },
    });

    // Enviar email
    const emailSent = await sendPasswordResetEmail(email, token, usuario.nombre);

    if (!emailSent) {
      res.status(500).json({ error: 'Error al enviar el correo. Intenta de nuevo.' });
      return;
    }

    res.json({ message: 'Si el email existe, recibirás un correo con instrucciones' });
  },

  async resetPassword(req: Request, res: Response): Promise<void> {
    const resetSchema = z.object({
      token: z.string().min(1, 'Token es requerido'),
      password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    });

    const validation = resetSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const { token, password } = validation.data;

    // Buscar token válido
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { usuario: true },
    });

    if (!resetToken) {
      res.status(400).json({ error: 'Enlace inválido o expirado' });
      return;
    }

    if (resetToken.used) {
      res.status(400).json({ error: 'Este enlace ya fue utilizado' });
      return;
    }

    if (new Date() > resetToken.expiresAt) {
      res.status(400).json({ error: 'El enlace ha expirado. Solicita uno nuevo.' });
      return;
    }

    // Hashear nueva contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Actualizar contraseña y marcar token como usado
    await prisma.$transaction([
      prisma.usuario.update({
        where: { id: resetToken.usuarioId },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
    ]);

    res.json({ message: 'Contraseña actualizada exitosamente. Ya puedes iniciar sesión.' });
  },

  async verifyResetToken(req: Request, res: Response): Promise<void> {
    const { token } = req.params;

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken || resetToken.used || new Date() > resetToken.expiresAt) {
      res.status(400).json({ valid: false, error: 'Enlace inválido o expirado' });
      return;
    }

    res.json({ valid: true });
  },
};

