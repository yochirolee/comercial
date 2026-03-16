import { readFileSync } from 'fs';
import { join } from 'path';

let _isPostgreSQL: boolean | null = null;

function detectPostgreSQL(): boolean {
  if (_isPostgreSQL !== null) return _isPostgreSQL;

  try {
    const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma');
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    const providerMatch = schemaContent.match(/datasource\s+db\s*\{[^}]*provider\s*=\s*["'](\w+)["']/s);
    _isPostgreSQL = providerMatch ? providerMatch[1] === 'postgresql' : false;
  } catch {
    const dbUrl = process.env.DATABASE_URL || '';
    _isPostgreSQL =
      dbUrl.includes('postgres') ||
      dbUrl.includes('supabase') ||
      dbUrl.includes('postgresql://');
  }

  return _isPostgreSQL;
}

export function createContainsFilter(term: string) {
  if (detectPostgreSQL()) {
    return { contains: term, mode: 'insensitive' as const };
  }
  return { contains: term };
}
