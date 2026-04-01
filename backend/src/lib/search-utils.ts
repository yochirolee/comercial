import { readFileSync } from 'fs';
import { join } from 'path';
import type { Prisma } from '@prisma/client';
import { LEGACY_STATUS_TO_CANONICAL, STATUS_ORDER } from './operation-status.js';

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

type ContainsFilter = ReturnType<typeof createContainsFilter>;

function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Valores de estado posibles en BD (español + legacy inglés) que coinciden con el término
 * (substring, sin depender de mayúsculas en SQLite).
 */
function expandStatusInMatches(term: string): string[] {
  const t = term.trim().toLowerCase();
  if (t.length < 2) return [];
  const tf = stripAccents(t);
  const seen = new Set<string>();
  const all = [
    ...STATUS_ORDER,
    ...Object.keys(LEGACY_STATUS_TO_CANONICAL),
    ...Object.values(LEGACY_STATUS_TO_CANONICAL),
  ];
  for (const st of all) {
    if (seen.has(st)) continue;
    const sl = st.toLowerCase();
    const sfn = stripAccents(sl);
    if (sl.includes(t) || sfn.includes(tf)) {
      seen.add(st);
    }
  }
  return [...seen];
}

/**
 * Condiciones OR para buscar operaciones por texto (GET /operations?search= y búsqueda global).
 */
export function buildOperationSearchOr(searchTerm: string): Prisma.OperationWhereInput[] {
  const trimmed = searchTerm.trim();
  if (!trimmed) return [];

  const s = createContainsFilter(trimmed);
  const or: Prisma.OperationWhereInput[] = [
    { operationNo: s },
    { status: s },
    { notes: s },
    { currentLocation: s },
    { originPort: s },
    { destinationPort: s },
    { referenciaOperacion: s },
    { importadora: { nombre: s } },
    { carrier: { OR: [{ name: s }, { scac: s }] } },
    { invoice: { numero: s } },
    { offerCustomer: { numero: s } },
    {
      offerCustomer: {
        cliente: {
          OR: [{ nombre: s }, { apellidos: s }, { nombreCompania: s }],
        },
      },
    },
    {
      offerCustomer: {
        items: {
          some: {
            OR: [
              { nombreProducto: s },
              { descripcion: s },
              { codigoProducto: s },
              {
                producto: {
                  OR: [
                    { nombre: s },
                    { codigo: s },
                    { descripcion: s },
                    { codigoArancelario: s },
                  ],
                },
              },
            ],
          },
        },
      },
    },
    { containers: { some: { containerNo: s } } },
    { containers: { some: { bookingNo: s } } },
    { containers: { some: { blNo: s } } },
    { containers: { some: { status: s } } },
    { containers: { some: { currentLocation: s } } },
    { containers: { some: { originPort: s } } },
    { containers: { some: { destinationPort: s } } },
    { containers: { some: { itn: s } } },
  ];

  const statusIn = expandStatusInMatches(trimmed);
  if (statusIn.length > 0) {
    or.push({ status: { in: statusIn } });
    or.push({ containers: { some: { status: { in: statusIn } } } });
  }

  // Tipo de operación (p. ej. "parcel" / "PARCEL" no coincide con contains en SQLite)
  if (/\bparcel\b|^pkg$|\bgift\b/i.test(trimmed)) {
    or.push({ operationType: 'PARCEL' });
  }
  if (/\bcomercial\b|\bcommercial\b/i.test(trimmed)) {
    or.push({ operationType: 'COMMERCIAL' });
  }

  return or;
}
