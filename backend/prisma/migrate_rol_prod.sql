-- Script SQL para agregar el campo 'rol' a la tabla Usuario en PostgreSQL
-- Ejecutar este script en la base de datos de producción

-- Agregar columna 'rol' si no existe
ALTER TABLE "Usuario" 
ADD COLUMN IF NOT EXISTS "rol" TEXT DEFAULT 'comercial';

-- Actualizar usuarios existentes a 'comercial' si el campo es NULL
UPDATE "Usuario" 
SET "rol" = 'comercial' 
WHERE "rol" IS NULL;

-- Agregar constraint para asegurar que solo acepte 'admin' o 'comercial'
-- Nota: PostgreSQL no tiene CHECK constraints en TEXT por defecto, pero podemos usar un trigger o simplemente validar en la aplicación
-- Por ahora, la validación se hace en la aplicación con Zod
