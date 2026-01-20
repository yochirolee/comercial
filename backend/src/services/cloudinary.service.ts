import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const FOLDER = process.env.CLOUDINARY_FOLDER || 'zas';

export const cloudinaryService = {
  /**
   * Subir archivo a Cloudinary
   */
  async uploadFile(
    buffer: Buffer,
    filename: string,
    subfolder?: string
  ): Promise<string> {
    const folder = subfolder ? `${FOLDER}/${subfolder}` : FOLDER;
    
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: filename.replace(/\.[^/.]+$/, ''), // Sin extensión
          resource_type: 'image',
          overwrite: true,
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error) {
            console.error('Error uploading to Cloudinary:', error);
            reject(error);
          } else if (result) {
            resolve(result.secure_url);
          } else {
            reject(new Error('No result from Cloudinary'));
          }
        }
      );
      
      uploadStream.end(buffer);
    });
  },

  /**
   * Eliminar archivo de Cloudinary
   */
  async deleteFile(publicUrl: string): Promise<void> {
    try {
      // Extraer public_id de la URL
      const urlParts = publicUrl.split('/');
      const filenameWithExt = urlParts[urlParts.length - 1];
      const folderPart = urlParts[urlParts.length - 2];
      const publicId = `${FOLDER}/${folderPart}/${filenameWithExt.replace(/\.[^/.]+$/, '')}`;
      
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error('Error deleting from Cloudinary:', error);
    }
  },

  /**
   * Verificar si Cloudinary está configurado
   */
  isConfigured(): boolean {
    return !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
  },
};
