-- Opcional: migrar estados de contenedores y operaciones de inglés → español (PostgreSQL).
-- Ejecutar después de backup. Ajustar nombres de tablas si difieren en tu schema.

UPDATE "OperationContainer" SET status = CASE status
  WHEN 'Draft' THEN 'Pendiente'
  WHEN 'Booking Confirmed' THEN 'Sellado'
  WHEN 'Container Assigned' THEN 'Sellado'
  WHEN 'Loaded' THEN 'Cargando'
  WHEN 'Gate In (Port)' THEN 'En puerto US'
  WHEN 'BL Final Issued' THEN 'En puerto US'
  WHEN 'Departed US' THEN 'En Tránsito al Puerto del Mariel'
  WHEN 'Departed Brazil' THEN 'En Tránsito al Puerto del Mariel'
  WHEN 'Arrived Cuba' THEN 'En Puerto del Mariel'
  WHEN 'Customs' THEN 'En Aduana'
  WHEN 'Released' THEN 'Liberado Aduana'
  WHEN 'Delivered' THEN 'Completado'
  WHEN 'Closed' THEN 'Completado'
  WHEN 'Cancelled' THEN 'Cancelado'
  ELSE status
END
WHERE status IN (
  'Draft', 'Booking Confirmed', 'Container Assigned', 'Loaded', 'Gate In (Port)', 'BL Final Issued',
  'Departed US', 'Departed Brazil', 'Arrived Cuba', 'Customs', 'Released',
  'Delivered', 'Closed', 'Cancelled'
);

UPDATE "Operation" SET status = CASE status
  WHEN 'Draft' THEN 'Pendiente'
  WHEN 'Booking Confirmed' THEN 'Sellado'
  WHEN 'Container Assigned' THEN 'Sellado'
  WHEN 'Loaded' THEN 'Cargando'
  WHEN 'Gate In (Port)' THEN 'En puerto US'
  WHEN 'BL Final Issued' THEN 'En puerto US'
  WHEN 'Departed US' THEN 'En Tránsito al Puerto del Mariel'
  WHEN 'Departed Brazil' THEN 'En Tránsito al Puerto del Mariel'
  WHEN 'Arrived Cuba' THEN 'En Puerto del Mariel'
  WHEN 'Customs' THEN 'En Aduana'
  WHEN 'Released' THEN 'Liberado Aduana'
  WHEN 'Delivered' THEN 'Completado'
  WHEN 'Closed' THEN 'Completado'
  WHEN 'Cancelled' THEN 'Cancelado'
  ELSE status
END
WHERE status IN (
  'Draft', 'Booking Confirmed', 'Container Assigned', 'Loaded', 'Gate In (Port)', 'BL Final Issued',
  'Departed US', 'Departed Brazil', 'Arrived Cuba', 'Customs', 'Released',
  'Delivered', 'Closed', 'Cancelled'
);

-- Si ya existían filas con “Transito” sin tilde:
UPDATE "OperationContainer" SET status = 'En Tránsito al Puerto del Mariel' WHERE status = 'En Transito al Puerto del Mariel';
UPDATE "Operation" SET status = 'En Tránsito al Puerto del Mariel' WHERE status = 'En Transito al Puerto del Mariel';
