# ZAS Backend - Sistema de Gestión de Ofertas y Facturas

Backend desarrollado con Express.js y TypeScript para el sistema de gestión de ofertas y facturas.

## Requisitos

- Node.js 18+
- npm o yarn

## Instalación

```bash
# Instalar dependencias
npm install

# Crear archivo .env (copiar de .env.example)
cp .env.example .env

# Generar cliente de Prisma
npm run db:generate

# Crear base de datos y tablas
npm run db:push

# (Opcional) Cargar datos de prueba
npm run db:seed
```

## Ejecutar

```bash
# Modo desarrollo
npm run dev

# Modo producción
npm run build
npm start
```

## API Endpoints

### Empresa
- `GET /api/empresa` - Obtener info de la empresa
- `POST /api/empresa` - Crear/actualizar empresa

### Clientes
- `GET /api/clientes` - Listar clientes
- `GET /api/clientes/:id` - Obtener cliente
- `POST /api/clientes` - Crear cliente
- `PUT /api/clientes/:id` - Actualizar cliente
- `DELETE /api/clientes/:id` - Eliminar cliente

### Productos
- `GET /api/productos` - Listar productos
- `GET /api/productos/:id` - Obtener producto
- `POST /api/productos` - Crear producto
- `PUT /api/productos/:id` - Actualizar producto
- `DELETE /api/productos/:id` - Desactivar producto

### Unidades de Medida
- `GET /api/unidades-medida` - Listar unidades
- `POST /api/unidades-medida` - Crear unidad
- `PUT /api/unidades-medida/:id` - Actualizar unidad
- `DELETE /api/unidades-medida/:id` - Eliminar unidad

### Ofertas Generales (Lista de precios sin cliente)
- `GET /api/ofertas-generales` - Listar ofertas
- `POST /api/ofertas-generales` - Crear oferta
- `PUT /api/ofertas-generales/:id` - Actualizar oferta
- `POST /api/ofertas-generales/:id/items` - Agregar producto
- `DELETE /api/ofertas-generales/:id/items/:itemId` - Quitar producto

### Ofertas a Cliente
- `GET /api/ofertas-cliente` - Listar ofertas
- `POST /api/ofertas-cliente` - Crear oferta
- `PUT /api/ofertas-cliente/:id` - Actualizar oferta
- `POST /api/ofertas-cliente/:id/items` - Agregar producto

### Ofertas a Importadora (CIF)
- `GET /api/ofertas-importadora` - Listar ofertas
- `POST /api/ofertas-importadora` - Crear oferta
- `PUT /api/ofertas-importadora/:id` - Actualizar (incluye flete, seguro)
- `POST /api/ofertas-importadora/:id/items` - Agregar producto

### Ofertas a Comercializadora (Precio pactado con desglose)
- `GET /api/ofertas-comercializadora` - Listar ofertas
- `POST /api/ofertas-comercializadora` - Crear oferta
- `PUT /api/ofertas-comercializadora/:id` - Actualizar
- `POST /api/ofertas-comercializadora/:id/ajustar-precios` - Ajustar precios según flete/seguro

### Facturas
- `GET /api/facturas` - Listar facturas
- `POST /api/facturas` - Crear factura
- `POST /api/facturas/desde-oferta` - Crear desde oferta existente
- `PUT /api/facturas/:id/estado` - Cambiar estado

### Exportación
- `GET /api/export/ofertas-generales/:id/pdf` - Exportar PDF
- `GET /api/export/ofertas-generales/:id/excel` - Exportar Excel
- `GET /api/export/ofertas-cliente/:id/pdf`
- `GET /api/export/ofertas-cliente/:id/excel`
- `GET /api/export/ofertas-importadora/:id/pdf`
- `GET /api/export/ofertas-importadora/:id/excel`
- `GET /api/export/ofertas-comercializadora/:id/pdf`
- `GET /api/export/ofertas-comercializadora/:id/excel`
- `GET /api/export/facturas/:id/pdf`
- `GET /api/export/facturas/:id/excel`

## Estructura de Base de Datos

### Tablas principales:
- **Empresa**: Información de tu empresa
- **Cliente**: Clientes con nombre, apellidos, NIT, TC Cuba, etc.
- **UnidadMedida**: libras, kilos, unidades, etc.
- **Producto**: Productos con precio base y unidad de medida
- **OfertaGeneral**: Lista de precios sin cliente específico
- **OfertaCliente**: Oferta con precios específicos para un cliente
- **OfertaImportadora**: Incluye flete, seguro y precio CIF
- **OfertaComercializadora**: Precio pactado con desglose de flete/seguro
- **Factura**: Facturas generadas desde ofertas

Cada tabla incluye 4 campos extra (`campoExtra1-4`) para uso futuro.

## Lógica de Negocio

### Oferta a Comercializadora
Cuando se pacta un precio final con el cliente, la oferta a comercializadora permite:
1. Establecer el `precioPactadoTotal`
2. Definir `fleteDesglosado` y `seguroDesglosado`
3. El sistema ajusta automáticamente los precios de productos (`precioUnitarioAjustado`)
4. El total final es igual al precio pactado, pero desglosado para la comercializadora

Esto permite que a vista del facturador, el cliente pague menos por producto y pague flete/seguro por separado, pero el total sea el mismo precio acordado.

