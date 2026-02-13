// Helper para crear filtro case-insensitive según la base de datos
export function createContainsFilter(term: string) {
  // Detectar si es PostgreSQL (producción) o SQLite (local)
  const isPostgreSQL = process.env.DATABASE_URL?.includes('postgres') || 
                       process.env.DATABASE_URL?.includes('supabase');
  
  if (isPostgreSQL) {
    return { contains: term, mode: 'insensitive' as const };
  } else {
    // SQLite: no soporta mode: 'insensitive', pero SQLite es case-insensitive por defecto
    // para comparaciones de texto, así que solo usamos contains
    return { contains: term };
  }
}
