-- Migration: Add Operations tracking tables
-- Run this in production PostgreSQL database

-- Create Operation table
CREATE TABLE IF NOT EXISTS "Operation" (
    "id" TEXT NOT NULL,
    "operationNo" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "offerCustomerId" TEXT,
    "invoiceId" TEXT,
    "status" TEXT NOT NULL,
    "currentLocation" TEXT,
    "originPort" TEXT,
    "destinationPort" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Operation_pkey" PRIMARY KEY ("id")
);

-- Create unique index for operationNo
CREATE UNIQUE INDEX IF NOT EXISTS "Operation_operationNo_key" ON "Operation"("operationNo");

-- Create OperationContainer table
CREATE TABLE IF NOT EXISTS "OperationContainer" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "sequenceNo" INTEGER NOT NULL,
    "containerNo" TEXT,
    "bookingNo" TEXT,
    "blNo" TEXT,
    "originPort" TEXT,
    "destinationPort" TEXT,
    "etdEstimated" TIMESTAMP(3),
    "etaEstimated" TIMESTAMP(3),
    "etdActual" TIMESTAMP(3),
    "etaActual" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "currentLocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OperationContainer_pkey" PRIMARY KEY ("id")
);

-- Create OperationEvent table
CREATE TABLE IF NOT EXISTS "OperationEvent" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OperationEvent_pkey" PRIMARY KEY ("id")
);

-- Create ContainerEvent table
CREATE TABLE IF NOT EXISTS "ContainerEvent" (
    "id" TEXT NOT NULL,
    "operationContainerId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "location" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContainerEvent_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Operation_offerCustomerId_fkey'
    ) THEN
        ALTER TABLE "Operation" ADD CONSTRAINT "Operation_offerCustomerId_fkey" 
        FOREIGN KEY ("offerCustomerId") REFERENCES "OfertaCliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Operation_invoiceId_fkey'
    ) THEN
        ALTER TABLE "Operation" ADD CONSTRAINT "Operation_invoiceId_fkey" 
        FOREIGN KEY ("invoiceId") REFERENCES "Factura"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'OperationContainer_operationId_fkey'
    ) THEN
        ALTER TABLE "OperationContainer" ADD CONSTRAINT "OperationContainer_operationId_fkey" 
        FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'OperationEvent_operationId_fkey'
    ) THEN
        ALTER TABLE "OperationEvent" ADD CONSTRAINT "OperationEvent_operationId_fkey" 
        FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ContainerEvent_operationContainerId_fkey'
    ) THEN
        ALTER TABLE "ContainerEvent" ADD CONSTRAINT "ContainerEvent_operationContainerId_fkey" 
        FOREIGN KEY ("operationContainerId") REFERENCES "OperationContainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "Operation_operationType_idx" ON "Operation"("operationType");
CREATE INDEX IF NOT EXISTS "Operation_status_idx" ON "Operation"("status");
CREATE INDEX IF NOT EXISTS "Operation_offerCustomerId_idx" ON "Operation"("offerCustomerId");
CREATE INDEX IF NOT EXISTS "Operation_invoiceId_idx" ON "Operation"("invoiceId");
CREATE INDEX IF NOT EXISTS "OperationContainer_operationId_idx" ON "OperationContainer"("operationId");
CREATE INDEX IF NOT EXISTS "OperationContainer_status_idx" ON "OperationContainer"("status");
CREATE INDEX IF NOT EXISTS "OperationEvent_operationId_idx" ON "OperationEvent"("operationId");
CREATE INDEX IF NOT EXISTS "ContainerEvent_operationContainerId_idx" ON "ContainerEvent"("operationContainerId");
