import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seeding database...');

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
    prisma.unidadMedida.upsert({
      where: { id: 'um-gal' },
      update: {},
      create: { id: 'um-gal', nombre: 'Galón', abreviatura: 'GAL', usaCajas: false },
    }),
  ]);
  console.log(`✅ Unidades de medida: ${unidades.length}`);

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
  console.log(`✅ Empresa: ${empresa.nombre}`);

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
  console.log(`✅ Cliente: ${cliente.nombre} ${cliente.apellidos}`);

  const importadora = await prisma.importadora.upsert({
    where: { id: 'importadora-1' },
    update: {},
    create: {
      id: 'importadora-1',
      nombre: 'Importadora Ejemplo S.A.',
      direccion: 'Zona industrial, La Habana',
      pais: 'Cuba',
      puertoDestinoDefault: 'MARIEL, Cuba',
      contacto: 'María García',
      telefono: '+53 5 1234567',
      email: 'ops@importadora-ejemplo.cu',
    },
  });
  console.log(`✅ Importadora: ${importadora.nombre}`);

  await prisma.clienteImportadora.upsert({
    where: {
      clienteId_importadoraId: { clienteId: cliente.id, importadoraId: importadora.id },
    },
    update: {},
    create: { clienteId: cliente.id, importadoraId: importadora.id },
  });
  console.log('✅ Relación cliente ↔ importadora');

  const categoria = await prisma.categoriaProducto.upsert({
    where: { nombre: 'Alimentos básicos' },
    update: {},
    create: { nombre: 'Alimentos básicos' },
  });
  console.log(`✅ Categoría: ${categoria.nombre}`);

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
        categoriaId: categoria.id,
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
        categoriaId: categoria.id,
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
        categoriaId: categoria.id,
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
        precioBase: 3.5,
        unidadMedidaId: 'um-litro',
        categoriaId: categoria.id,
        activo: true,
      },
    }),
  ]);
  console.log(`✅ Productos: ${productos.length}`);

  const hashedPassword = await bcrypt.hash('admin123', 10);
  const usuario = await prisma.usuario.upsert({
    where: { email: 'admin@zas.com' },
    update: { password: hashedPassword, rol: 'admin', activo: true },
    create: {
      nombre: 'Admin',
      apellidos: 'Sistema',
      email: 'admin@zas.com',
      password: hashedPassword,
      rol: 'admin',
      activo: true,
    },
  });
  console.log(`✅ Usuario: ${usuario.email} (rol: admin, password: admin123)`);

  console.log('');
  console.log('🎉 Seed completed.');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
