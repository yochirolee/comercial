import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Crear unidades de medida
  const unidades = await Promise.all([
    prisma.unidadMedida.upsert({
      where: { id: 'um-kg' },
      update: {},
      create: { id: 'um-kg', nombre: 'Kilogramo', abreviatura: 'kg', usaCajas: false },
    }),
    prisma.unidadMedida.upsert({
      where: { id: 'um-lb' },
      update: {},
      create: { id: 'um-lb', nombre: 'Libra', abreviatura: 'lb', usaCajas: false },
    }),
    prisma.unidadMedida.upsert({
      where: { id: 'um-saco' },
      update: {},
      create: { id: 'um-saco', nombre: 'Saco', abreviatura: 'saco', usaCajas: true },
    }),
    prisma.unidadMedida.upsert({
      where: { id: 'um-caja' },
      update: {},
      create: { id: 'um-caja', nombre: 'Caja', abreviatura: 'caja', usaCajas: true },
    }),
    prisma.unidadMedida.upsert({
      where: { id: 'um-pcs' },
      update: {},
      create: { id: 'um-pcs', nombre: 'Pieza', abreviatura: 'PCS', usaCajas: false },
    }),
    prisma.unidadMedida.upsert({
      where: { id: 'um-litro' },
      update: {},
      create: { id: 'um-litro', nombre: 'Litro', abreviatura: 'L', usaCajas: false },
    }),
  ]);
  console.log(`✅ Created ${unidades.length} units`);

  // Crear empresa de ejemplo
  const empresa = await prisma.empresa.upsert({
    where: { id: 'empresa-1' },
    update: {},
    create: {
      id: 'empresa-1',
      nombre: 'ZAS BY JMC CORP',
      direccion: '7081 NW 72 AVE MIAMI, FL 33166',
      telefono: '+1 786-636-4893',
      email: 'info@zasbyjmc.com',
      representante: 'LIC. BORIS LUIS CABRERA PEREZ',
      cargoRepresentante: 'PRESIDENTE',
      codigoMincex: 'US-0439',
    },
  });
  console.log(`✅ Created empresa: ${empresa.nombre}`);

  // Crear cliente de ejemplo
  const cliente = await prisma.cliente.upsert({
    where: { id: 'cliente-1' },
    update: {},
    create: {
      id: 'cliente-1',
      nombre: 'Juan',
      apellidos: 'Pérez',
      nombreCompania: 'PISOS DEL VALLE S.A.',
      direccion: 'Calle Principal #123, Ciudad',
      telefono: '+1 555-1234',
      email: 'contacto@pisosdelvalle.com',
      nit: '123456789-0',
    },
  });
  console.log(`✅ Created cliente: ${cliente.nombre} ${cliente.apellidos}`);

  // Crear productos de ejemplo
  const productos = await Promise.all([
    prisma.producto.upsert({
      where: { codigo: 'PROD-001' },
      update: {},
      create: {
        codigo: 'PROD-001',
        nombre: 'Frijol Negro',
        descripcion: 'Frijol negro de primera calidad',
        precioBase: 1.25,
        unidadMedidaId: 'um-lb',
        activo: true,
      },
    }),
    prisma.producto.upsert({
      where: { codigo: 'PROD-002' },
      update: {},
      create: {
        codigo: 'PROD-002',
        nombre: 'Arroz Grano Largo',
        descripcion: 'Arroz de grano largo premium',
        precioBase: 0.85,
        unidadMedidaId: 'um-lb',
        activo: true,
      },
    }),
    prisma.producto.upsert({
      where: { codigo: 'PROD-003' },
      update: {},
      create: {
        codigo: 'PROD-003',
        nombre: 'Azúcar Refinada',
        descripcion: 'Azúcar blanca refinada',
        precioBase: 0.65,
        unidadMedidaId: 'um-lb',
        activo: true,
      },
    }),
    prisma.producto.upsert({
      where: { codigo: 'PROD-004' },
      update: {},
      create: {
        codigo: 'PROD-004',
        nombre: 'Aceite Vegetal',
        descripcion: 'Aceite vegetal para cocina',
        precioBase: 3.50,
        unidadMedidaId: 'um-litro',
        activo: true,
      },
    }),
  ]);
  console.log(`✅ Created ${productos.length} products`);

  // Crear usuario de ejemplo (password: admin123)
  const bcrypt = await import('bcryptjs');
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const usuario = await prisma.usuario.upsert({
    where: { email: 'admin@zas.com' },
    update: {},
    create: {
      nombre: 'Admin',
      apellidos: 'Sistema',
      email: 'admin@zas.com',
      password: hashedPassword,
      activo: true,
    },
  });
  console.log(`✅ Created user: ${usuario.email} (password: admin123)`);

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
