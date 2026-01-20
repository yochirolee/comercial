import { Router } from 'express';
import multer from 'multer';
import { cloudinaryService } from '../services/cloudinary.service';

export const uploadRouter = Router();

// Configurar multer para guardar en memoria (para subir a Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: parseInt(process.env.DELIVERY_MAX_MB || '6') * 1024 * 1024 
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo imágenes JPEG, PNG, GIF, WEBP.'));
    }
  },
});

// Subir una imagen (logo, firma, cuno) a Cloudinary
uploadRouter.post('/:tipo', upload.single('image'), async (req, res) => {
  const { tipo } = req.params;
  
  if (!['logo', 'firma', 'cuno'].includes(tipo)) {
    res.status(400).json({ error: 'Tipo de imagen no válido' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    return;
  }

  try {
    // Verificar si Cloudinary está configurado
    if (!cloudinaryService.isConfigured()) {
      res.status(500).json({ error: 'Cloudinary no está configurado' });
      return;
    }

    // Generar nombre único
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = `${tipo}-${uniqueSuffix}`;
    
    // Subir a Cloudinary con subfolder según el tipo
    const url = await cloudinaryService.uploadFile(
      req.file.buffer,
      filename,
      tipo // subfolder: logo, firma, cuno
    );

    res.json({
      success: true,
      url,
      path: url, // Para compatibilidad con el código existente
      filename,
    });
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    res.status(500).json({ 
      error: 'Error al subir imagen',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Ruta de compatibilidad para imágenes locales antiguas (redirect o 404)
uploadRouter.get('/images/:filename', (req, res) => {
  res.status(404).json({ 
    error: 'Las imágenes ahora se sirven desde Cloudinary',
    message: 'Por favor actualice la URL de la imagen'
  });
});
