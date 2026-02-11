import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Configurar Prisma con logging solo para errores y warnings
const prismaClientOptions: ConstructorParameters<typeof PrismaClient>[0] = {
  log: process.env.NODE_ENV === 'production' 
    ? [{ emit: 'event', level: 'query' }]
    : ['error', 'warn'], // Solo errores y warnings, no queries
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient(prismaClientOptions);

// Log queries lentos en producción (> 100ms)
if (process.env.NODE_ENV === 'production') {
  prisma.$on('query' as never, (e: any) => {
    if (e.duration > 100) {
      console.warn(`[SLOW QUERY] ${e.duration}ms: ${e.query.substring(0, 200)}...`);
    }
  });
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

