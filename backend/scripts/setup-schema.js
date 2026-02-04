#!/usr/bin/env node

/**
 * Script para configurar el schema de Prisma según el entorno
 * Detecta automáticamente si es local (SQLite) o producción (PostgreSQL)
 */

const fs = require('fs');
const path = require('path');

const schemasDir = path.join(__dirname, '..', 'prisma');
const schemaPath = path.join(schemasDir, 'schema.prisma');
const localSchemaPath = path.join(schemasDir, 'schema.local.prisma');
const prodSchemaPath = path.join(schemasDir, 'schema.prod.prisma');

// Detectar entorno
const isProduction = process.env.NODE_ENV === 'production' || 
                     process.env.DATABASE_URL?.includes('postgres') ||
                     process.env.RENDER === 'true';

const targetSchema = isProduction ? prodSchemaPath : localSchemaPath;
const envName = isProduction ? 'producción (PostgreSQL)' : 'local (SQLite)';

console.log(`🔧 Configurando schema para entorno: ${envName}`);

// Verificar que el schema objetivo existe
if (!fs.existsSync(targetSchema)) {
  console.error(`❌ Error: No se encontró el schema ${targetSchema}`);
  process.exit(1);
}

// Copiar el schema correspondiente
try {
  const schemaContent = fs.readFileSync(targetSchema, 'utf8');
  fs.writeFileSync(schemaPath, schemaContent, 'utf8');
  console.log(`✅ Schema configurado correctamente desde ${path.basename(targetSchema)}`);
} catch (error) {
  console.error(`❌ Error al copiar el schema:`, error.message);
  process.exit(1);
}
