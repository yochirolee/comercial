# ZAS Backend

Sistema de gestión de ofertas y facturas - Backend API

## 🚀 Inicio Rápido

### Requisitos Previos

- Node.js 18+ 
- npm o yarn
- PostgreSQL (local con Docker o instancia remota)

### Instalación

```bash
# Instalar dependencias
npm install

# Aplicar schema a PostgreSQL (DATABASE_URL en .env)
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
# Regenerar Prisma Client
npm run db:generate

# Aplicar cambios de schema a la BD
npm run db:push
```

## 🔧 Configuración de Entornos

El schema vive en un solo archivo: `prisma/schema.prisma` (PostgreSQL). Edítalo ahí y luego `npm run db:push` o migraciones según tu flujo.

### Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# Base de datos (PostgreSQL)
DATABASE_URL="postgresql://usuario:password@localhost:5432/nombre_bd"

# JWT
JWT_SECRET="tu-secret-key-aqui"

# Email (Resend) — recuperación de contraseña
RESEND_API_KEY="re_..."           # API key del panel de Resend
# Remitente: con dominio verificado en Resend (recomendado). Si omites, se usa onboarding@resend.dev (solo pruebas: destinatarios muy limitados).
FROM_EMAIL="noreply@tudominio.com"
# URL del front para el enlace del correo (debe coincidir con donde abres la app)
FRONTEND_URL="http://localhost:3000"

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
│   ├── schema.prisma           # Schema Prisma (PostgreSQL)
│   └── migrate_*.sql           # Scripts de migración SQL (si aplica)
└── dist/                        # Código compilado (generado)
```

## 🗄️ Base de Datos

Define `DATABASE_URL` apuntando a PostgreSQL. Para sincronizar el schema en desarrollo:

```bash
npm run db:push
```

**IMPORTANTE** en despliegues: si usas scripts SQL manuales, ejecuta los de `prisma/migrate_*.sql` según corresponda. El build (`npm run build`) ejecuta `prisma generate` y compila TypeScript.

## 🔐 Autenticación

El sistema usa JWT para autenticación. Los tokens se generan en el login y deben incluirse en las peticiones:

```
Authorization: Bearer <token>
```

## 📝 Notas de Despliegue

Para instrucciones detalladas de despliegue, ver [DEPLOY_NOTES.md](../DEPLOY_NOTES.md)

## 🐛 Troubleshooting

### Error: "Prisma Client not generated"
Ejecuta `npm run db:generate` para regenerar el cliente.

### Error en producción: "Unknown field"
Asegúrate de ejecutar los scripts SQL de migración y de que el build use `npm run build`.

### Recuperación de contraseña: no llega el correo o error 500
- Comprueba `RESEND_API_KEY` y `FRONTEND_URL` en `backend/.env`.
- En desarrollo, si el envío falla, el servidor imprime en consola el enlace `reset-password?token=...` para probar el flujo sin correo.
- Resend con remitente de prueba limita destinatarios; verifica un dominio y usa `FROM_EMAIL` de ese dominio para enviar a cualquier dirección.
