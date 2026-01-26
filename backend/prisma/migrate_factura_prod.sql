-- Script para agregar columnas faltantes a la tabla Factura en producción
-- Ejecutar este script directamente en la base de datos PostgreSQL de producción

-- Campos de costos
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "flete" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "seguro" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "tieneSeguro" BOOLEAN DEFAULT false;

-- Términos y condiciones
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "codigoMincex" TEXT;
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "puertoEmbarque" TEXT DEFAULT 'NEW ORLEANS, LA';
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "origen" TEXT DEFAULT 'ESTADOS UNIDOS';
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "moneda" TEXT DEFAULT 'USD';
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "terminosPago" TEXT DEFAULT 'PAGO 100% ANTES DEL EMBARQUE';

-- Firmas
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "incluyeFirmaCliente" BOOLEAN DEFAULT false;
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "firmaClienteNombre" TEXT;
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "firmaClienteCargo" TEXT;
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "firmaClienteEmpresa" TEXT;

-- Origen
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "tipoOfertaOrigen" TEXT;
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "ofertaOrigenId" TEXT;

-- Campos adicionales para ItemFactura
ALTER TABLE "ItemFactura" ADD COLUMN IF NOT EXISTS "cantidadCajas" DOUBLE PRECISION;
ALTER TABLE "ItemFactura" ADD COLUMN IF NOT EXISTS "cantidadSacos" DOUBLE PRECISION;
ALTER TABLE "ItemFactura" ADD COLUMN IF NOT EXISTS "pesoNeto" DOUBLE PRECISION;
ALTER TABLE "ItemFactura" ADD COLUMN IF NOT EXISTS "pesoBruto" DOUBLE PRECISION;
ALTER TABLE "ItemFactura" ADD COLUMN IF NOT EXISTS "pesoXSaco" DOUBLE PRECISION;
ALTER TABLE "ItemFactura" ADD COLUMN IF NOT EXISTS "precioXSaco" DOUBLE PRECISION;
ALTER TABLE "ItemFactura" ADD COLUMN IF NOT EXISTS "pesoXCaja" DOUBLE PRECISION;
ALTER TABLE "ItemFactura" ADD COLUMN IF NOT EXISTS "precioXCaja" DOUBLE PRECISION;
ALTER TABLE "ItemFactura" ADD COLUMN IF NOT EXISTS "codigoArancelario" TEXT;
ALTER TABLE "ItemFactura" ADD COLUMN IF NOT EXISTS "descripcion" TEXT;

-- Verificar que codigoArancelario existe en otras tablas (por si acaso)
ALTER TABLE "ItemOfertaCliente" ADD COLUMN IF NOT EXISTS "codigoArancelario" TEXT;
ALTER TABLE "ItemOfertaImportadora" ADD COLUMN IF NOT EXISTS "codigoArancelario" TEXT;
