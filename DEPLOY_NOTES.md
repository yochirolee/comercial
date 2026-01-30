# Notas de Despliegue a Producción

## Resumen de Cambios

Los cambios realizados son **SOLO en la lógica de la aplicación** (código TypeScript/JavaScript). **NO se requieren cambios en la base de datos**.

### Cambios Realizados

1. **Backend - Controladores:**
   - `backend/src/controllers/ofertaGeneral.controller.ts`: Mejorado el manejo de campos opcionales para aceptar `null` y limpiar valores vacíos
   - `backend/src/controllers/ofertaCliente.controller.ts`: Mismo cambio para ofertas a cliente
   - `backend/src/controllers/producto.controller.ts`: Ordenamiento de productos por código descendente
   - `backend/src/controllers/export.controller.ts`: Cambios en generación de PDF/Excel para ofertas a cliente

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

1. **En producción, ejecutar:**
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
