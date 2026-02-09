-- Migración: Agregar campo nroContrato a la tabla Factura
-- Fecha: 2025-01-XX
-- Descripción: Agrega el campo opcional nroContrato para almacenar el número de contrato en las facturas

-- Agregar columna nroContrato a la tabla Factura
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "nroContrato" TEXT;

-- La columna es opcional (nullable), por lo que no necesita valores por defecto
-- Los registros existentes tendrán NULL en este campo
