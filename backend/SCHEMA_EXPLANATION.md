# Explicación del Sistema de Schemas de Prisma

## ¿Por qué hay 3 archivos de schema?

Tienes **3 archivos de schema** porque necesitas **dos bases de datos diferentes**:
- **Local**: SQLite (archivo `dev.db`)
- **Producción**: PostgreSQL (Supabase)

## Los 3 Archivos

### 1. `schema.local.prisma` 📝 **PLANTILLA para Local**
- **Propósito**: Schema para desarrollo local con SQLite
- **Base de datos**: `file:./dev.db` (SQLite)
- **Cuándo se usa**: Cuando trabajas en tu máquina local
- **NO se usa directamente**: Es una plantilla que se copia a `schema.prisma`

### 2. `schema.prod.prisma` 📝 **PLANTILLA para Producción**
- **Propósito**: Schema para producción con PostgreSQL
- **Base de datos**: PostgreSQL (Supabase) via `DATABASE_URL`
- **Cuándo se usa**: Cuando se despliega a producción (Render)
- **NO se usa directamente**: Es una plantilla que se copia a `schema.prisma`

### 3. `schema.prisma` ⚙️ **EL QUE PRISMA REALMENTE USA**
- **Propósito**: Este es el schema que Prisma lee realmente
- **Cómo se genera**: Se crea automáticamente copiando desde:
  - `schema.local.prisma` → si estás en local
  - `schema.prod.prisma` → si estás en producción
- **Cuándo se actualiza**: Cada vez que ejecutas `npm run setup` o cualquier script que lo incluya

## ¿Cómo Funciona?

### Proceso Automático

1. **Cuando ejecutas cualquier comando** (dev, build, db:push, etc.):
   ```bash
   npm run dev
   # ↓ Internamente ejecuta:
   npm run setup  # ← Detecta el entorno y copia el schema correcto
   ```

2. **El script `setup-schema.js` detecta el entorno**:
   ```javascript
   // Detecta si es producción:
   - NODE_ENV === 'production'
   - DATABASE_URL contiene 'postgres'
   - RENDER === 'true'
   
   // Si es producción → copia schema.prod.prisma → schema.prisma
   // Si es local → copia schema.local.prisma → schema.prisma
   ```

3. **Prisma usa `schema.prisma`** para generar el cliente y hacer migraciones

## Diferencias Clave Entre los Schemas

### `schema.local.prisma` (SQLite)
```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}
```

### `schema.prod.prisma` (PostgreSQL)
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Los modelos son **idénticos** en ambos, solo cambia el `datasource`

## Flujo de Trabajo

### En Local (Tu Máquina)
```bash
npm run dev
# ↓
# 1. setup-schema.js detecta: "Es local"
# 2. Copia schema.local.prisma → schema.prisma
# 3. Prisma genera el cliente desde schema.prisma
# 4. Usa SQLite (dev.db)
```

### En Producción (Render)
```bash
npm run build
# ↓
# 1. setup-schema.js detecta: "Es producción" (RENDER=true)
# 2. Copia schema.prod.prisma → schema.prisma
# 3. Prisma genera el cliente desde schema.prisma
# 4. Usa PostgreSQL (Supabase)
```

## ¿Cuál Está Usando Ahora?

Para verificar qué schema está activo:

```bash
cd backend
cat prisma/schema.prisma | head -10
```

Verás:
- `provider = "sqlite"` → Usando schema local
- `provider = "postgresql"` → Usando schema de producción

## ¿Por Qué Este Sistema?

### Ventajas:
1. ✅ **Mantiene los schemas sincronizados**: Los modelos son iguales en ambos
2. ✅ **Automático**: No necesitas cambiar nada manualmente
3. ✅ **Seguro**: Evita errores de usar el schema incorrecto
4. ✅ **Simple**: Un solo comando funciona en ambos entornos

### Alternativa (sin este sistema):
- Tendrías que cambiar manualmente el `datasource` cada vez
- Riesgo de olvidar cambiarlo y romper producción
- Más propenso a errores

## Comandos Importantes

```bash
# Desarrollo local
npm run dev          # Usa schema.local.prisma automáticamente

# Producción
npm run build        # Usa schema.prod.prisma automáticamente

# Forzar actualización del schema
npm run setup        # Detecta entorno y copia el schema correcto

# Ver qué schema está activo
cat prisma/schema.prisma | grep provider
```

## Resumen

| Archivo | Propósito | Se Usa Directamente? |
|---------|-----------|---------------------|
| `schema.local.prisma` | Plantilla para SQLite (local) | ❌ No, se copia |
| `schema.prod.prisma` | Plantilla para PostgreSQL (prod) | ❌ No, se copia |
| `schema.prisma` | **El que Prisma usa** | ✅ Sí, este es el activo |

**Regla de oro**: **NUNCA edites `schema.prisma` directamente**. Siempre edita `schema.local.prisma` o `schema.prod.prisma` según corresponda, y luego ejecuta `npm run setup`.
