-- Agregar columna codigoArancelario a la tabla Producto
-- Ejecutar en PostgreSQL (producción)

ALTER TABLE "Producto" 
ADD COLUMN IF NOT EXISTS "codigoArancelario" TEXT;
