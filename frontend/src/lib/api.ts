const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(error.error || `Error ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

// ==========================================
// EMPRESA
// ==========================================
export const empresaApi = {
  get: () => fetchApi<Empresa | null>('/empresa'),
  upsert: (data: EmpresaInput) => fetchApi<Empresa>('/empresa', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// ==========================================
// CLIENTES
// ==========================================
export const clientesApi = {
  getAll: (search?: string) => fetchApi<Cliente[]>(`/clientes${search ? `?search=${search}` : ''}`),
  getById: (id: string) => fetchApi<Cliente>(`/clientes/${id}`),
  create: (data: ClienteInput) => fetchApi<Cliente>('/clientes', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: Partial<ClienteInput>) => fetchApi<Cliente>(`/clientes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => fetchApi<void>(`/clientes/${id}`, { method: 'DELETE' }),
};

// ==========================================
// UNIDADES DE MEDIDA
// ==========================================
export const unidadesApi = {
  getAll: () => fetchApi<UnidadMedida[]>('/unidades-medida'),
  create: (data: UnidadMedidaInput) => fetchApi<UnidadMedida>('/unidades-medida', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: Partial<UnidadMedidaInput>) => fetchApi<UnidadMedida>(`/unidades-medida/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => fetchApi<void>(`/unidades-medida/${id}`, { method: 'DELETE' }),
};

// ==========================================
// PRODUCTOS
// ==========================================
export const productosApi = {
  getAll: (search?: string) => fetchApi<Producto[]>(`/productos${search ? `?search=${search}` : ''}`),
  getById: (id: string) => fetchApi<Producto>(`/productos/${id}`),
  getNextCode: () => fetchApi<{ codigo: string }>('/productos/next-code'),
  create: (data: ProductoInput) => fetchApi<Producto>('/productos', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: Partial<ProductoInput>) => fetchApi<Producto>(`/productos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => fetchApi<void>(`/productos/${id}`, { method: 'DELETE' }),
};

// ==========================================
// OFERTAS GENERALES (Lista de precios)
// ==========================================
export const ofertasGeneralesApi = {
  getAll: () => fetchApi<OfertaGeneral[]>('/ofertas-generales'),
  getById: (id: string) => fetchApi<OfertaGeneral>(`/ofertas-generales/${id}`),
  getNextNumber: () => fetchApi<{ numero: string }>('/ofertas-generales/next-number'),
  create: (data: OfertaGeneralInputWithItems) => fetchApi<OfertaGeneral>('/ofertas-generales', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: Partial<OfertaGeneralInput>) => fetchApi<OfertaGeneral>(`/ofertas-generales/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => fetchApi<void>(`/ofertas-generales/${id}`, { method: 'DELETE' }),
  addItem: (id: string, data: ItemOfertaGeneralInput) => fetchApi<ItemOfertaGeneral>(`/ofertas-generales/${id}/items`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateItem: (id: string, itemId: string, data: Partial<ItemOfertaGeneralInput>) => fetchApi<ItemOfertaGeneral>(`/ofertas-generales/${id}/items/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  removeItem: (id: string, itemId: string) => fetchApi<void>(`/ofertas-generales/${id}/items/${itemId}`, {
    method: 'DELETE',
  }),
  adjustPrices: (id: string, totalDeseado: number) => fetchApi<OfertaGeneral>(`/ofertas-generales/${id}/adjust-prices`, {
    method: 'POST',
    body: JSON.stringify({ totalDeseado }),
  }),
};

// ==========================================
// OFERTAS A CLIENTE (Sin flete/seguro)
// ==========================================
export const ofertasClienteApi = {
  getAll: (clienteId?: string) => fetchApi<OfertaCliente[]>(`/ofertas-cliente${clienteId ? `?clienteId=${clienteId}` : ''}`),
  getById: (id: string) => fetchApi<OfertaCliente>(`/ofertas-cliente/${id}`),
  getNextNumber: () => fetchApi<{ numero: string }>('/ofertas-cliente/next-number'),
  create: (data: OfertaClienteInputWithItems) => fetchApi<OfertaCliente>('/ofertas-cliente', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: Partial<OfertaClienteInput>) => fetchApi<OfertaCliente>(`/ofertas-cliente/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => fetchApi<void>(`/ofertas-cliente/${id}`, { method: 'DELETE' }),
  addItem: (id: string, data: ItemOfertaClienteInput) => fetchApi<ItemOfertaCliente>(`/ofertas-cliente/${id}/items`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateItem: (id: string, itemId: string, data: Partial<ItemOfertaClienteInput>) => fetchApi<ItemOfertaCliente>(`/ofertas-cliente/${id}/items/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  removeItem: (id: string, itemId: string) => fetchApi<void>(`/ofertas-cliente/${id}/items/${itemId}`, {
    method: 'DELETE',
  }),
  adjustPrices: (id: string, totalDeseado: number) => fetchApi<OfertaCliente>(`/ofertas-cliente/${id}/adjust-prices`, {
    method: 'POST',
    body: JSON.stringify({ totalDeseado }),
  }),
};

// ==========================================
// OFERTAS A IMPORTADORA (Con FOB ajustado + Flete + Seguro = CIF)
// ==========================================
export const ofertasImportadoraApi = {
  getAll: (clienteId?: string) => fetchApi<OfertaImportadora[]>(`/ofertas-importadora${clienteId ? `?clienteId=${clienteId}` : ''}`),
  getById: (id: string) => fetchApi<OfertaImportadora>(`/ofertas-importadora/${id}`),
  getNextNumber: () => fetchApi<{ numero: string }>('/ofertas-importadora/next-number'),
  create: (data: OfertaImportadoraInput) => fetchApi<OfertaImportadora>('/ofertas-importadora', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  // Crear desde una oferta al cliente (ajusta precios automáticamente)
  createFromOfertaCliente: (data: CrearDesdeOfertaClienteInput) => 
    fetchApi<OfertaImportadora>('/ofertas-importadora/desde-oferta-cliente', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<OfertaImportadoraInput>) => fetchApi<OfertaImportadora>(`/ofertas-importadora/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => fetchApi<void>(`/ofertas-importadora/${id}`, { method: 'DELETE' }),
  addItem: (id: string, data: ItemOfertaImportadoraInput) => fetchApi<OfertaImportadora>(`/ofertas-importadora/${id}/items`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateItem: (id: string, itemId: string, data: Partial<ItemOfertaImportadoraInput>) => fetchApi<OfertaImportadora>(`/ofertas-importadora/${id}/items/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  removeItem: (id: string, itemId: string) => fetchApi<void>(`/ofertas-importadora/${id}/items/${itemId}`, {
    method: 'DELETE',
  }),
  // Recalcular precios ajustados
  recalcular: (id: string) => fetchApi<OfertaImportadora>(`/ofertas-importadora/${id}/recalcular`, {
    method: 'POST',
  }),
  // Ajustar precios para llegar a un total CIF deseado
  adjustPrices: (id: string, totalDeseado: number) => fetchApi<OfertaImportadora>(`/ofertas-importadora/${id}/adjust-prices`, {
    method: 'POST',
    body: JSON.stringify({ totalDeseado }),
  }),
};

// ==========================================
// FACTURAS
// ==========================================
export const facturasApi = {
  getAll: (clienteId?: string) => fetchApi<Factura[]>(`/facturas${clienteId ? `?clienteId=${clienteId}` : ''}`),
  getById: (id: string) => fetchApi<Factura>(`/facturas/${id}`),
  create: (data: FacturaInput) => fetchApi<Factura>('/facturas', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  createFromOferta: (data: FacturaFromOfertaInput) => fetchApi<Factura>('/facturas/desde-oferta', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: Partial<FacturaInput>) => fetchApi<Factura>(`/facturas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => fetchApi<void>(`/facturas/${id}`, { method: 'DELETE' }),
  updateEstado: (id: string, estado: string) => fetchApi<Factura>(`/facturas/${id}/estado`, {
    method: 'PUT',
    body: JSON.stringify({ estado }),
  }),
  addItem: (id: string, data: ItemFacturaInput) => fetchApi<ItemFactura>(`/facturas/${id}/items`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateItem: (id: string, itemId: string, data: Partial<ItemFacturaInput>) => fetchApi<ItemFactura>(`/facturas/${id}/items/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  removeItem: (id: string, itemId: string) => fetchApi<void>(`/facturas/${id}/items/${itemId}`, {
    method: 'DELETE',
  }),
};

// ==========================================
// EXPORTACIÓN
// ==========================================
export const exportApi = {
  downloadPdf: (tipo: string, id: string) => {
    window.open(`${API_URL}/export/${tipo}/${id}/pdf`, '_blank');
  },
  downloadExcel: (tipo: string, id: string) => {
    window.open(`${API_URL}/export/${tipo}/${id}/excel`, '_blank');
  },
};

// ==========================================
// TYPES
// ==========================================
export interface Empresa {
  id: string;
  nombre: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  nit?: string;
  representante?: string;
  cargoRepresentante?: string;
  codigoMincex?: string;
  logo?: string;
  firmaPresidente?: string;
  cunoEmpresa?: string;
  campoExtra1?: string;
  campoExtra2?: string;
  campoExtra3?: string;
  campoExtra4?: string;
}

export interface EmpresaInput {
  nombre: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  nit?: string;
  representante?: string;
  cargoRepresentante?: string;
  codigoMincex?: string;
  logo?: string;
  firmaPresidente?: string;
  cunoEmpresa?: string;
}

export interface Cliente {
  id: string;
  nombre: string;
  apellidos?: string;
  contacto?: string;  // Persona de contacto para firma
  nombreCompania?: string;  // Nombre de la compañía del cliente
  direccion?: string;
  telefono?: string;
  email?: string;
  nit?: string;
  campoExtra1?: string;
  campoExtra2?: string;
  campoExtra3?: string;
  campoExtra4?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClienteInput {
  nombre: string;
  apellidos?: string;
  contacto?: string;
  nombreCompania?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  nit?: string;
}

export interface UnidadMedida {
  id: string;
  nombre: string;
  abreviatura: string;
  usaCajas?: boolean;
}

export interface UnidadMedidaInput {
  nombre: string;
  abreviatura: string;
  usaCajas?: boolean;
}

export interface Producto {
  id: string;
  codigo?: string;
  nombre: string;
  descripcion?: string;
  precioBase: number;
  unidadMedidaId: string;
  unidadMedida: UnidadMedida;
  activo: boolean;
  campoExtra1?: string;
  campoExtra2?: string;
  campoExtra3?: string;
  campoExtra4?: string;
}

export interface ProductoInput {
  codigo?: string;
  nombre: string;
  descripcion?: string;
  precioBase: number;
  unidadMedidaId: string;
}

export interface OfertaGeneral {
  id: string;
  numero: string;
  fecha: string;
  vigenciaHasta?: string;
  observaciones?: string;
  estado: string;
  items: ItemOfertaGeneral[];
}

export interface OfertaGeneralInput {
  numero?: string;
  fecha?: string;
  vigenciaHasta?: string;
  observaciones?: string;
  estado?: string;
}

export interface OfertaGeneralInputWithItems extends OfertaGeneralInput {
  items?: ItemOfertaGeneralInput[];
}

export interface ItemOfertaGeneral {
  id: string;
  productoId: string;
  producto: Producto;
  cantidad: number;
  precioUnitario: number;
  // Campos informativos opcionales
  cantidadCajas?: number;
  cantidadSacos?: number;
  pesoXSaco?: number;
  precioXSaco?: number;
  pesoXCaja?: number;
  precioXCaja?: number;
}

export interface ItemOfertaGeneralInput {
  productoId: string;
  cantidad: number;
  precioUnitario: number;
  // Campos informativos opcionales
  cantidadCajas?: number;
  cantidadSacos?: number;
  pesoXSaco?: number;
  precioXSaco?: number;
  pesoXCaja?: number;
  precioXCaja?: number;
}

// ==========================================
// OFERTA A CLIENTE (Sin flete/seguro)
// ==========================================
export interface OfertaCliente {
  id: string;
  numero: string;
  fecha: string;
  vigenciaHasta?: string;
  clienteId: string;
  cliente: Cliente;
  observaciones?: string;
  estado: string;
  // Información de envío
  codigoMincex?: string;
  puertoEmbarque?: string;
  origen?: string;
  moneda?: string;
  terminosPago?: string;
  // Firma del cliente
  incluyeFirmaCliente?: boolean;
  // Total acordado (sin desglose)
  total: number;
  subtotal?: number;
  descuento?: number;
  items: ItemOfertaCliente[];
}

export interface OfertaClienteInput {
  numero?: string;
  fecha?: string;
  vigenciaHasta?: string;
  clienteId: string;
  observaciones?: string;
  estado?: string;
  codigoMincex?: string;
  puertoEmbarque?: string;
  origen?: string;
  moneda?: string;
  terminosPago?: string;
  incluyeFirmaCliente?: boolean;
}

export interface OfertaClienteInputWithItems extends OfertaClienteInput {
  items?: ItemOfertaClienteInput[];
}

export interface ItemOfertaCliente {
  id: string;
  productoId: string;
  producto: Producto;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  // Campos informativos opcionales
  cantidadCajas?: number;
  cantidadSacos?: number;
  pesoNeto?: number;
  pesoBruto?: number;
  pesoXSaco?: number;
  precioXSaco?: number;
  pesoXCaja?: number;
  precioXCaja?: number;
}

export interface ItemOfertaClienteInput {
  productoId: string;
  cantidad: number;
  precioUnitario: number;
  // Campos informativos opcionales
  cantidadCajas?: number;
  cantidadSacos?: number;
  pesoNeto?: number;
  pesoBruto?: number;
  pesoXSaco?: number;
  precioXSaco?: number;
  pesoXCaja?: number;
  precioXCaja?: number;
}

// ==========================================
// OFERTA A IMPORTADORA (FOB ajustado + Flete + Seguro = CIF)
// ==========================================
export interface OfertaImportadora {
  id: string;
  numero: string;
  fecha: string;
  vigenciaHasta?: string;
  clienteId: string;
  cliente: Cliente;
  observaciones?: string;
  estado: string;
  // Referencia a oferta cliente origen
  ofertaClienteId?: string;
  ofertaCliente?: OfertaCliente;
  // Información de envío
  codigoMincex?: string;
  puertoEmbarque?: string;
  origen?: string;
  moneda?: string;
  terminosPago?: string;
  // Firma del cliente
  incluyeFirmaCliente?: boolean;
  // Ajuste de precios
  ajustarPrecios?: boolean;
  // Precio acordado con el cliente
  precioAcordado: number;
  // Desglose
  flete: number;
  seguro: number;
  tieneSeguro: boolean;
  // FOB ajustado = precioAcordado - flete - seguro
  subtotalProductos: number;
  // CIF = subtotalProductos + flete + seguro = precioAcordado
  precioCIF: number;
  items: ItemOfertaImportadora[];
}

export interface OfertaImportadoraInput {
  numero?: string;
  fecha?: string;
  vigenciaHasta?: string;
  clienteId?: string;
  observaciones?: string;
  estado?: string;
  ofertaClienteId?: string;
  codigoMincex?: string;
  puertoEmbarque?: string;
  origen?: string;
  moneda?: string;
  terminosPago?: string;
  incluyeFirmaCliente?: boolean;
  ajustarPrecios?: boolean;
  precioAcordado?: number;
  flete?: number;
  seguro?: number;
  tieneSeguro?: boolean;
}

export interface CrearDesdeOfertaClienteInput {
  ofertaClienteId: string;
  numero?: string;
  flete: number;
  seguro?: number;
  tieneSeguro?: boolean;
  incluyeFirmaCliente?: boolean;
  ajustarPrecios?: boolean; // true = ajusta precios para que CIF = precio acordado, false = suma flete/seguro
}

export interface ItemOfertaImportadora {
  id: string;
  productoId: string;
  producto: Producto;
  cantidad: number;
  precioOriginal: number;     // Precio original (de oferta cliente)
  precioAjustado: number;     // Precio ajustado para que CIF = precio acordado
  subtotal: number;           // Con precio ajustado
  // Campos informativos opcionales
  cantidadCajas?: number;
  cantidadSacos?: number;
  pesoNeto?: number;
  pesoBruto?: number;
  pesoXSaco?: number;
  precioXSaco?: number;
  pesoXCaja?: number;
  precioXCaja?: number;
}

export interface ItemOfertaImportadoraInput {
  productoId: string;
  cantidad: number;
  precioOriginal: number;
  // Campos informativos opcionales
  cantidadCajas?: number;
  cantidadSacos?: number;
  pesoNeto?: number;
  pesoBruto?: number;
  pesoXSaco?: number;
  precioXSaco?: number;
  pesoXCaja?: number;
  precioXCaja?: number;
}

// ==========================================
// FACTURAS
// ==========================================
export interface Factura {
  id: string;
  numero: string;
  fecha: string;
  fechaVencimiento?: string;
  clienteId: string;
  cliente: Cliente;
  observaciones?: string;
  estado: string;
  subtotal: number;
  impuestos: number;
  descuento: number;
  total: number;
  tipoOfertaOrigen?: string;
  ofertaOrigenId?: string;
  items: ItemFactura[];
}

export interface FacturaInput {
  numero: string;
  fecha?: string;
  fechaVencimiento?: string;
  clienteId: string;
  observaciones?: string;
  impuestos?: number;
  descuento?: number;
}

export interface FacturaFromOfertaInput {
  tipoOferta: 'cliente' | 'importadora';
  ofertaId: string;
  numeroFactura: string;
}

export interface ItemFactura {
  id: string;
  productoId: string;
  producto: Producto;
  descripcion?: string;
  cantidad: number;
  cantidadCajas?: number;
  pesoNeto?: number;
  pesoBruto?: number;
  precioUnitario: number;
  subtotal: number;
}

export interface ItemFacturaInput {
  productoId: string;
  descripcion?: string;
  cantidad: number;
  cantidadCajas?: number;
  pesoNeto?: number;
  pesoBruto?: number;
  precioUnitario: number;
}
