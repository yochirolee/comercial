# ZAS Backend

Sistema de gestión de ofertas y facturas - Backend API

## 🚀 Inicio Rápido

### Requisitos Previos

- Node.js 18+ 
- npm o yarn
- Para desarrollo local: SQLite (incluido)
- Para producción: PostgreSQL

### Instalación

```bash
# Instalar dependencias
npm install

# Configurar base de datos local (SQLite)
npm run local:setup

# (Opcional) Poblar con datos de ejemplo
npm run local:seed
```

## 📋 Scripts Disponibles

### Desarrollo Local

```bash
# Iniciar servidor en modo desarrollo (con hot-reload)
npm run dev

# O usar el comando completo
npm run local:dev

# Resetear base de datos local y poblar con datos de ejemplo
npm run local:reset

# Abrir Prisma Studio (interfaz visual para la BD)
npm run db:studio
```

### Producción

```bash
# Compilar para producción
npm run build

# Iniciar servidor en producción
npm start
```

### Utilidades

```bash
# Configurar schema según entorno (automático)
npm run setup

# Regenerar Prisma Client
npm run db:generate

# Aplicar cambios de schema a la BD (solo local)
npm run db:push
```

## 🔧 Configuración de Entornos

El sistema detecta automáticamente el entorno:

- **Local**: Usa `schema.local.prisma` (SQLite)
- **Producción**: Usa `schema.prod.prisma` (PostgreSQL)

La detección se basa en:
- `NODE_ENV=production`
- `DATABASE_URL` contiene "postgres"
- `RENDER=true` (para Render.com)

### Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# Base de datos
DATABASE_URL="file:./prisma/dev.db"  # Local (SQLite)
# DATABASE_URL="postgresql://..."     # Producción (PostgreSQL)

# JWT
JWT_SECRET="tu-secret-key-aqui"

# Email (Resend)
RESEND_API_KEY="tu-api-key"
FROM_EMAIL="noreply@tudominio.com"

# Cloudinary (opcional)
CLOUDINARY_CLOUD_NAME="tu-cloud-name"
CLOUDINARY_API_KEY="tu-api-key"
CLOUDINARY_API_SECRET="tu-api-secret"
```

## 📁 Estructura del Proyecto

```
backend/
├── src/
│   ├── controllers/    # Controladores de las rutas
│   ├── routes/          # Definición de rutas
│   ├── middleware/       # Middlewares (auth, etc.)
│   ├── services/        # Servicios (email, cloudinary)
│   └── lib/             # Utilidades (prisma client)
├── prisma/
│   ├── schema.prisma           # Schema activo (generado automáticamente)
│   ├── schema.local.prisma     # Schema para desarrollo (SQLite)
│   ├── schema.prod.prisma      # Schema para producción (PostgreSQL)
│   └── migrate_*.sql           # Scripts de migración SQL
├── scripts/
│   └── setup-schema.js         # Script de configuración automática
└── dist/                        # Código compilado (generado)
```

## 🗄️ Base de Datos

### Desarrollo Local (SQLite)

El schema se configura automáticamente al ejecutar cualquier comando. Los cambios se aplican con:

```bash
npm run db:push
```

### Producción (PostgreSQL)

**IMPORTANTE**: Antes de desplegar, ejecuta los scripts SQL de migración:

1. Verifica que todos los campos existan en la BD
2. Ejecuta los scripts en `prisma/migrate_*.sql`
3. El build en Render ejecutará `npm run build` que automáticamente:
   - Detecta el entorno de producción
   - Copia `schema.prod.prisma` a `schema.prisma`
   - Genera el Prisma Client
   - Compila TypeScript

## 🔐 Autenticación

El sistema usa JWT para autenticación. Los tokens se generan en el login y deben incluirse en las peticiones:

```
Authorization: Bearer <token>
```

## 📝 Notas de Despliegue

Para instrucciones detalladas de despliegue, ver [DEPLOY_NOTES.md](../DEPLOY_NOTES.md)

## 🐛 Troubleshooting

### Error: "Schema not found"
Ejecuta `npm run setup` para configurar el schema correcto.

### Error: "Prisma Client not generated"
Ejecuta `npm run db:generate` para regenerar el cliente.

### Error en producción: "Unknown field"
Asegúrate de:
1. Ejecutar los scripts SQL de migración
2. Que el Build Command en Render use `npm run build` (detecta automáticamente)
