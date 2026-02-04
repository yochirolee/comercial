# Notas de Despliegue a Producción

## ⚠️ IMPORTANTE: Migración de Base de Datos Requerida

**Este despliegue REQUIERE ejecutar una migración SQL en PostgreSQL antes de desplegar el código.**

### Migración SQL Requerida

Ejecutar el siguiente script SQL en la base de datos PostgreSQL de producción:

```sql
-- Agregar columna codigoArancelario a la tabla Producto
ALTER TABLE "Producto" 
ADD COLUMN IF NOT EXISTS "codigoArancelario" TEXT;
```

El archivo está en: `backend/prisma/migrate_codigo_arancelario_prod.sql`

## Resumen de Cambios

Se agregó el campo opcional `codigoArancelario` al modelo Producto y se implementó la funcionalidad para copiar automáticamente este código desde el producto a las ofertas.

### Cambios Realizados

1. **Base de Datos:**
   - Agregado campo `codigoArancelario` (TEXT, nullable) a la tabla `Producto`

2. **Backend - Schema:**
   - `backend/prisma/schema.prisma`: Agregado campo `codigoArancelario` al modelo Producto
   - `backend/prisma/schema.prod.prisma`: Agregado campo `codigoArancelario` al modelo Producto

3. **Backend - Controladores:**
   - `backend/src/controllers/producto.controller.ts`: Agregado soporte para `codigoArancelario` en create/update
   - `backend/src/controllers/ofertaCliente.controller.ts`: Copia automática de `codigoArancelario` del producto al agregar items
   - `backend/src/controllers/ofertaImportadora.controller.ts`: Copia automática de `codigoArancelario` del producto al agregar items
   - `backend/src/controllers/export.controller.ts`: Agregada columna UM en PDFs y Excels

2. **Frontend:**
   - `frontend/src/app/ofertas/generales/page.tsx`: Mejorado el envío de campos opcionales (envía `null` cuando están vacíos)
   - `frontend/src/app/ofertas/cliente/page.tsx`: Mismo cambio para ofertas a cliente

3. **Schema de Producción:**
   - `backend/prisma/schema.prod.prisma`: Actualizado para incluir el campo `rol` en el modelo `Usuario` (ya existe en la BD por migración anterior)

### Seguridad de los Cambios

✅ **NO se requieren migraciones de base de datos**
- Los campos opcionales ya existen en la base de datos (son nullable)
- Solo se cambió la lógica de cómo se procesan esos campos
- El campo `rol` ya existe en producción (fue agregado con `migrate_rol_prod.sql`)

✅ **Los cambios son retrocompatibles**
- La aplicación seguirá funcionando con datos existentes
- No se eliminan ni modifican columnas existentes
- Solo se mejora el manejo de valores `null` en campos opcionales

### Pasos para Desplegar

**IMPORTANTE: Producción usa PostgreSQL (no SQLite)**

1. **PRIMERO: Ejecutar migración SQL en PostgreSQL:**
   ```sql
   ALTER TABLE "Producto" 
   ADD COLUMN IF NOT EXISTS "codigoArancelario" TEXT;
   ```
   
   O ejecutar el archivo:
   ```bash
   psql -d tu_base_de_datos -f backend/prisma/migrate_codigo_arancelario_prod.sql
   ```

2. **Luego, en producción (Render), configurar el Build Command:**
   
   **Si el Root Directory en Render está configurado como `backend/`, usar:**
   ```bash
   npm install && cp prisma/schema.prod.prisma prisma/schema.prisma && npx prisma generate && npm run build
   ```
   
   **Si el Root Directory es la raíz del proyecto, usar:**
   ```bash
   npm install && cd backend && cp prisma/schema.prod.prisma prisma/schema.prisma && npx prisma generate && npm run build
   ```
   
   **IMPORTANTE:** La diferencia clave con el comando anterior es agregar `cp prisma/schema.prod.prisma prisma/schema.prisma &&` antes de `npx prisma generate` para asegurar que se use el schema correcto de PostgreSQL.
   
   Este proceso automáticamente:
   - Copia `schema.prod.prisma` a `schema.prisma`
   - Regenera el cliente de Prisma con el schema correcto
   - Compila TypeScript
   
   **O si prefieres hacerlo manualmente:**
   ```bash
   # Copiar el schema de producción (PostgreSQL)
   cp prisma/schema.prod.prisma prisma/schema.prisma
   
   # Regenerar el cliente de Prisma (IMPORTANTE: solo generate, NO db push)
   prisma generate
   
   # Compilar el código
   npm run build
   ```
   
   **O usar el script npm:**
   ```bash
   npm run prod:restore
   npm run build
   ```

3. **Reiniciar la aplicación:**
   - El servidor debería reiniciarse automáticamente si está configurado con auto-reload
   - Si no, reiniciar manualmente el proceso

### Verificación Post-Despliegue

1. Probar editar un producto en "Lista de Precios" (Ofertas Generales)
2. Probar editar un producto en "Oferta a Cliente"
3. Verificar que los cambios se guarden correctamente
4. Verificar que los campos opcionales se puedan limpiar (dejar vacíos)

### Archivos Modificados

- `backend/src/controllers/ofertaGeneral.controller.ts`
- `backend/src/controllers/ofertaCliente.controller.ts`
- `backend/src/controllers/producto.controller.ts`
- `backend/src/controllers/export.controller.ts`
- `backend/prisma/schema.prod.prisma`
- `frontend/src/app/ofertas/generales/page.tsx`
- `frontend/src/app/ofertas/cliente/page.tsx`

### Nota Importante

⚠️ **NO ejecutar `prisma db push` o `prisma migrate` en producción**
- La base de datos PostgreSQL ya está actualizada
- Solo se necesita regenerar el cliente de Prisma con `prisma generate`
- Los cambios son solo en la lógica de la aplicación
- **NO se modifica la estructura de la base de datos**
- Todos los campos opcionales ya existen en PostgreSQL (son nullable)
