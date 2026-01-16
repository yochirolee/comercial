import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seeding database...');

  // Crear unidades de medida
  const unidades = await Promise.all([
    prisma.unidadMedida.create({
      data: { nombre: 'Libras', abreviatura: 'lb' },
    }),
    prisma.unidadMedida.create({
      data: { nombre: 'Kilogramos', abreviatura: 'kg' },
    }),
    prisma.unidadMedida.create({
      data: { nombre: 'Unidades', abreviatura: 'und' },
    }),
    prisma.unidadMedida.create({
      data: { nombre: 'Cajas', abreviatura: 'caja' },
    }),
    prisma.unidadMedida.create({
      data: { nombre: 'Litros', abreviatura: 'lt' },
    }),
    prisma.unidadMedida.create({
      data: { nombre: 'Galones', abreviatura: 'gal' },
    }),
  ]);

  console.log(`✅ Created ${unidades.length} unidades de medida`);

  // Crear empresa de ejemplo
  const empresa = await prisma.empresa.create({
    data: {
      nombre: 'Mi Empresa S.A.',
      direccion: 'Calle Principal #123, Ciudad',
      telefono: '+1 234 567 890',
      email: 'info@miempresa.com',
      nit: '123456789-0',
      representante: 'Juan Pérez',
    },
  });

  console.log(`✅ Created empresa: ${empresa.nombre}`);

  // Crear algunos productos de ejemplo
  const productos = await Promise.all([
    prisma.producto.create({
      data: {
        codigo: 'PROD-001',
        nombre: 'Producto de ejemplo 1',
        descripcion: 'Descripción del producto 1',
        precioBase: 10.50,
        unidadMedidaId: unidades[0].id, // Libras
      },
    }),
    prisma.producto.create({
      data: {
        codigo: 'PROD-002',
        nombre: 'Producto de ejemplo 2',
        descripcion: 'Descripción del producto 2',
        precioBase: 25.00,
        unidadMedidaId: unidades[1].id, // Kilogramos
      },
    }),
    prisma.producto.create({
      data: {
        codigo: 'PROD-003',
        nombre: 'Producto de ejemplo 3',
        descripcion: 'Descripción del producto 3',
        precioBase: 5.00,
        unidadMedidaId: unidades[2].id, // Unidades
      },
    }),
  ]);

  console.log(`✅ Created ${productos.length} productos`);

  // Crear cliente de ejemplo
  const cliente = await prisma.cliente.create({
    data: {
      nombre: 'Cliente',
      apellidos: 'De Ejemplo',
      direccion: 'Av. Secundaria #456, Ciudad',
      telefono: '+1 987 654 321',
      email: 'cliente@ejemplo.com',
      nit: '987654321-0',
      nombreTcCuba: 'TC Cuba Ejemplo',
    },
  });

  console.log(`✅ Created cliente: ${cliente.nombre} ${cliente.apellidos}`);

  console.log('');
  console.log('🎉 Seed completed successfully!');
  console.log('');
  console.log('You can now start the server with: npm run dev');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

