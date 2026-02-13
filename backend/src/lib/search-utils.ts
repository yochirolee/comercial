import { readFileSync } from 'fs';
import { join } from 'path';

// Helper para crear filtro case-insensitive según la base de datos
export function createContainsFilter(term: string) {
  // Detectar el provider del schema activo
  let isPostgreSQL = false;
  
  try {
    // Intentar leer el schema.prisma activo
    const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma');
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    
    // Buscar el provider en el datasource
    const providerMatch = schemaContent.match(/datasource\s+db\s*\{[^}]*provider\s*=\s*["'](\w+)["']/s);
    if (providerMatch) {
      isPostgreSQL = providerMatch[1] === 'postgresql';
    }
  } catch (error) {
    // Si no se puede leer el schema, usar detección por DATABASE_URL
    const dbUrl = process.env.DATABASE_URL || '';
    isPostgreSQL = 
      dbUrl.includes('postgres') || 
      dbUrl.includes('supabase') ||
      dbUrl.includes('postgresql://');
  }
  
  if (isPostgreSQL) {
    return { contains: term, mode: 'insensitive' as const };
  } else {
    // SQLite: no soporta mode: 'insensitive'
    return { contains: term };
  }
}
