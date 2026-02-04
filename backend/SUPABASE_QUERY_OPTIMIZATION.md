# Optimización de Queries Lentos en Supabase

## Análisis de Queries Lentos

Los queries reportados son principalmente del **sistema de Supabase** (dashboard, metadata), no de tu aplicación. Sin embargo, hay algunas optimizaciones posibles.

## Queries Más Lentos

### 1. `SELECT name FROM pg_timezone_names` (442ms promedio, 29% del tiempo)
- **Problema**: Query del sistema de Supabase para obtener zonas horarias
- **Impacto**: 34 llamadas, 15 segundos totales
- **Solución**: 
  - Este query es del sistema, no se puede optimizar directamente
  - Supabase debería cachear este resultado
  - **Recomendación**: Contactar a Supabase si es un problema recurrente

### 2. Query de Extensiones PostgreSQL (93ms promedio, 17% del tiempo)
- **Problema**: Query complejo para listar extensiones disponibles
- **Impacto**: 98 llamadas, 9 segundos totales
- **Solución**: Similar al anterior, es del sistema de Supabase

### 3. Query de Funciones PostgreSQL (136ms promedio, 9% del tiempo)
- **Problema**: Query muy complejo con múltiples CTEs y joins
- **Impacto**: 36 llamadas, 4.9 segundos totales
- **Solución**: Query del sistema de Supabase

### 4. `pgbouncer.get_auth` (0.4ms promedio, pero 7993 llamadas)
- **Problema**: Muchas llamadas de autenticación
- **Impacto**: 7993 llamadas, 3.4 segundos totales
- **Solución**: 
  - Esto es normal para conexiones de pool
  - Asegúrate de usar connection pooling correctamente

## Recomendaciones para Tu Aplicación

### 1. Verificar Queries de Tu Aplicación

Estos queries son del sistema de Supabase. Para ver los queries de **tu aplicación**, necesitas:

```sql
-- Ver queries lentos de tu aplicación (no del sistema)
SELECT 
  query,
  calls,
  mean_time,
  total_time
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_%'
  AND query NOT LIKE '%information_schema%'
  AND query NOT LIKE '%pgbouncer%'
ORDER BY total_time DESC
LIMIT 20;
```

### 2. Optimizar Conexiones

Asegúrate de usar **connection pooling** correctamente:

```typescript
// En tu código, usa el connection string con pooler
// En lugar de:
// postgresql://user:pass@host:5432/db

// Usa:
// postgresql://user:pass@host:6543/db (puerto del pooler)
```

### 3. Índices en Tu Base de Datos

Verifica que tus tablas principales tengan índices:

```sql
-- Verificar índices faltantes
SELECT
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.1
ORDER BY n_distinct DESC;
```

### 4. Analizar Queries de Tu Aplicación

Para ver los queries reales de tu aplicación:

1. **Habilitar logging en Prisma:**
```typescript
// backend/src/lib/prisma.ts
export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'stdout', level: 'error' },
    { emit: 'stdout', level: 'warn' },
  ],
});

prisma.$on('query' as never, (e: any) => {
  if (e.duration > 100) { // Log queries > 100ms
    console.log('Slow query:', e.query, e.duration + 'ms');
  }
});
```

2. **Usar EXPLAIN ANALYZE en queries específicos:**
```sql
EXPLAIN ANALYZE
SELECT * FROM "Producto" WHERE codigo = 'PROD-001';
```

## Acciones Inmediatas

1. **Verificar si estos queries afectan tu aplicación:**
   - Estos queries son del dashboard de Supabase
   - No deberían afectar el rendimiento de tu API
   - Si tu API es lenta, el problema está en otro lado

2. **Monitorear queries de tu aplicación:**
   - Usa el código de logging de Prisma arriba
   - Revisa los logs de tu aplicación en producción

3. **Contactar a Supabase:**
   - Si estos queries del sistema están causando problemas
   - Pueden optimizar sus queries internos

## Conclusión

Los queries mostrados son del **sistema de Supabase**, no de tu aplicación. Para optimizar tu aplicación, necesitas:

1. Ver los queries reales de tu aplicación (usando el logging de Prisma)
2. Agregar índices donde sea necesario
3. Optimizar queries específicos que sean lentos
4. Usar connection pooling correctamente
