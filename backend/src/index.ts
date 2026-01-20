import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import authRouter from './routes/auth.routes.js';
import { empresaRouter } from './routes/empresa.routes.js';
import { clienteRouter } from './routes/cliente.routes.js';
import { unidadMedidaRouter } from './routes/unidadMedida.routes.js';
import { productoRouter } from './routes/producto.routes.js';
import { ofertaGeneralRouter } from './routes/ofertaGeneral.routes.js';
import { ofertaClienteRouter } from './routes/ofertaCliente.routes.js';
import { ofertaImportadoraRouter } from './routes/ofertaImportadora.routes.js';
import { facturaRouter } from './routes/factura.routes.js';
import { exportRouter } from './routes/export.routes.js';
import { uploadRouter } from './routes/upload.routes.js';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS - Allow all origins for now
app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json());

// Servir archivos estáticos (imágenes subidas)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/empresa', empresaRouter);
app.use('/api/clientes', clienteRouter);
app.use('/api/unidades-medida', unidadMedidaRouter);
app.use('/api/productos', productoRouter);
app.use('/api/ofertas-generales', ofertaGeneralRouter);
app.use('/api/ofertas-cliente', ofertaClienteRouter);
app.use('/api/ofertas-importadora', ofertaImportadoraRouter);
app.use('/api/facturas', facturaRouter);
app.use('/api/export', exportRouter);
app.use('/api/upload', uploadRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;
