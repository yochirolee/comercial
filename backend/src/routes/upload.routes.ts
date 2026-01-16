import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

export const uploadRouter = Router();

// Configurar multer para guardar las imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'images');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo imágenes JPEG, PNG, GIF, WEBP.'));
    }
  },
});

// Subir una imagen (logo, firma, cuño)
uploadRouter.post('/:tipo', upload.single('image'), (req, res) => {
  const { tipo } = req.params;
  
  if (!['logo', 'firma', 'cuno'].includes(tipo)) {
    res.status(400).json({ error: 'Tipo de imagen no válido' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    return;
  }

  // Devolver el path relativo para guardar en la BD
  const relativePath = `images/${req.file.filename}`;
  
  res.json({
    success: true,
    path: relativePath,
    filename: req.file.filename,
  });
});

// Servir imágenes estáticas
uploadRouter.get('/images/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(process.cwd(), 'uploads', 'images', filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Imagen no encontrada' });
  }
});

