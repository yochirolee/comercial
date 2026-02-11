-- ==========================================
-- MIGRACIÓN: Importadora y relaciones
-- ==========================================

-- 1. Crear tabla Importadora
CREATE TABLE IF NOT EXISTS "Importadora" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "pais" TEXT DEFAULT 'Cuba',
    "puertoDestinoDefault" TEXT DEFAULT 'MARIEL, Cuba',
    "contacto" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Importadora_pkey" PRIMARY KEY ("id")
);

-- 2. Crear índice en nombre
CREATE INDEX IF NOT EXISTS "Importadora_nombre_idx" ON "Importadora"("nombre");

-- 3. Crear tabla puente ClienteImportadora
CREATE TABLE IF NOT EXISTS "ClienteImportadora" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "importadoraId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClienteImportadora_pkey" PRIMARY KEY ("id")
);

-- 4. Crear índices en ClienteImportadora
CREATE INDEX IF NOT EXISTS "ClienteImportadora_clienteId_idx" ON "ClienteImportadora"("clienteId");
CREATE INDEX IF NOT EXISTS "ClienteImportadora_importadoraId_idx" ON "ClienteImportadora"("importadoraId");

-- 5. Crear constraint único en ClienteImportadora
CREATE UNIQUE INDEX IF NOT EXISTS "ClienteImportadora_clienteId_importadoraId_key" ON "ClienteImportadora"("clienteId", "importadoraId");

-- 6. Agregar foreign keys a ClienteImportadora
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ClienteImportadora_clienteId_fkey'
    ) THEN
        ALTER TABLE "ClienteImportadora" 
        ADD CONSTRAINT "ClienteImportadora_clienteId_fkey" 
        FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ClienteImportadora_importadoraId_fkey'
    ) THEN
        ALTER TABLE "ClienteImportadora" 
        ADD CONSTRAINT "ClienteImportadora_importadoraId_fkey" 
        FOREIGN KEY ("importadoraId") REFERENCES "Importadora"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 7. Agregar columna importadoraId a OfertaImportadora (temporalmente nullable para migración)
ALTER TABLE "OfertaImportadora" 
ADD COLUMN IF NOT EXISTS "importadoraId" TEXT;

-- 8. Agregar foreign key a OfertaImportadora (después de crear algunas importadoras manualmente)
-- NOTA: Esta FK se agregará después de que se hayan creado importadoras y asignado a las ofertas existentes
-- ALTER TABLE "OfertaImportadora" 
-- ADD CONSTRAINT "OfertaImportadora_importadoraId_fkey" 
-- FOREIGN KEY ("importadoraId") REFERENCES "Importadora"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 9. Agregar columna importadoraId a Factura (temporalmente nullable para migración)
ALTER TABLE "Factura" 
ADD COLUMN IF NOT EXISTS "importadoraId" TEXT;

-- 10. Agregar foreign key a Factura (después de crear algunas importadoras manualmente)
-- NOTA: Esta FK se agregará después de que se hayan creado importadoras y asignado a las facturas existentes
-- ALTER TABLE "Factura" 
-- ADD CONSTRAINT "Factura_importadoraId_fkey" 
-- FOREIGN KEY ("importadoraId") REFERENCES "Importadora"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 11. Agregar columna importadoraId a Operation (temporalmente nullable para migración)
ALTER TABLE "Operation" 
ADD COLUMN IF NOT EXISTS "importadoraId" TEXT;

-- 12. Agregar foreign key a Operation (después de crear algunas importadoras manualmente)
-- NOTA: Esta FK se agregará después de que se hayan creado importadoras y asignado a las operaciones existentes
-- ALTER TABLE "Operation" 
-- ADD CONSTRAINT "Operation_importadoraId_fkey" 
-- FOREIGN KEY ("importadoraId") REFERENCES "Importadora"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==========================================
-- NOTAS IMPORTANTES:
-- ==========================================
-- 1. Después de ejecutar esta migración, crear al menos una Importadora manualmente
-- 2. Asignar importadoraId a todos los registros existentes de OfertaImportadora, Factura y Operation
-- 3. Una vez asignados, hacer las columnas NOT NULL y agregar las foreign keys
-- 4. Script de ejemplo para asignar una importadora por defecto:
--    UPDATE "OfertaImportadora" SET "importadoraId" = '<ID_IMPORTADORA_DEFAULT>' WHERE "importadoraId" IS NULL;
--    UPDATE "Factura" SET "importadoraId" = '<ID_IMPORTADORA_DEFAULT>' WHERE "importadoraId" IS NULL;
--    UPDATE "Operation" SET "importadoraId" = '<ID_IMPORTADORA_DEFAULT>' WHERE "importadoraId" IS NULL;
-- 5. Luego ejecutar:
--    ALTER TABLE "OfertaImportadora" ALTER COLUMN "importadoraId" SET NOT NULL;
--    ALTER TABLE "Factura" ALTER COLUMN "importadoraId" SET NOT NULL;
--    ALTER TABLE "Operation" ALTER COLUMN "importadoraId" SET NOT NULL;
--    Y agregar las foreign keys comentadas arriba
