"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Search,
  Building2,
  Package,
  Users,
  Receipt,
  Ship,
  TrendingUp,
  ArrowLeft,
  MapPin,
  X,
  FileText,
  ChevronRight,
  Activity,
  DollarSign,
  Hash,
  Download,
} from "lucide-react";
import { searchApi, importadorasApi } from "@/lib/api";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(dateString?: string): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

interface SearchResults {
  importadoras: Array<{ id: string; nombre: string; pais: string | null; contacto: string | null; puertoDestinoDefault: string | null }>;
  clientes: Array<{ id: string; nombre: string; apellidos: string | null; nombreCompania: string | null; email: string | null; telefono: string | null }>;
  productos: Array<{ id: string; nombre: string; codigo: string | null; precioBase: number; codigoArancelario: string | null }>;
  operaciones: Array<{ id: string; operationNo: string; operationType: string; status: string; currentLocation: string | null }>;
  facturas: Array<{ id: string; numero: string; fecha: string; total: number; estado: string }>;
  ofertasImportadora: Array<{ id: string; numero: string; fecha: string; estado: string; precioCIF: number | null; importadora?: { id: string; nombre: string } }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DetailData = any;

export default function BuscarUniversalPageWrapper(): React.ReactElement {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">Cargando...</div>}>
      <BuscarUniversalPage />
    </Suspense>
  );
}

function BuscarUniversalPage(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Para detalle expandido
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [detail, setDetail] = useState<DetailData>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Restaurar estado desde URL al cargar
  useEffect(() => {
    const type = searchParams.get("type");
    const id = searchParams.get("id");
    const label = searchParams.get("label");
    const q = searchParams.get("q");
    
    if (q) {
      setSearchTerm(q);
    }
    
    if (type && id && label) {
      selectEntity(type, id, decodeURIComponent(label));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalResults = results ? (
    results.importadoras.length +
    results.clientes.length +
    results.productos.length +
    results.operaciones.length +
    results.facturas.length +
    results.ofertasImportadora.length
  ) : 0;

  const handleSearch = useCallback(async (term: string): Promise<void> => {
    if (!term.trim() || term.trim().length < 2) {
      setResults(null);
      setHasSearched(false);
      return;
    }
    setSearching(true);
    setHasSearched(true);
    try {
      const data = await searchApi.search(term);
      setResults(data);
    } catch (error) {
      toast.error("Error al buscar");
      console.error(error);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchTerm);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm, handleSearch]);

  async function selectEntity(type: string, id: string, label: string): Promise<void> {
    setSelectedType(type);
    setSelectedId(id);
    setSelectedLabel(label);
    setLoadingDetail(true);
    
    // Actualizar URL para que el botón atrás del navegador funcione
    const params = new URLSearchParams();
    params.set("type", type);
    params.set("id", id);
    params.set("label", encodeURIComponent(label));
    if (searchTerm) params.set("q", searchTerm);
    router.push(`/importadoras/buscar?${params.toString()}`);
    
    try {
      const data = await searchApi.detail(type, id);
      setDetail(data);
    } catch (error) {
      toast.error("Error al cargar detalle");
      console.error(error);
    } finally {
      setLoadingDetail(false);
    }
  }

  function clearSelection(): void {
    setSelectedType(null);
    setSelectedId(null);
    setSelectedLabel("");
    setDetail(null);
    // Volver a la URL limpia con el término de búsqueda
    if (searchTerm) {
      router.push(`/importadoras/buscar?q=${encodeURIComponent(searchTerm)}`);
    } else {
      router.push("/importadoras/buscar");
    }
  }

  // ====================== RENDER ======================

  // Si hay un detalle seleccionado, mostrar dashboard
  if (selectedType && (loadingDetail || detail)) {
    const typeLabel = selectedType === 'importadora' ? 'Importadora' :
      selectedType === 'cliente' ? 'Cliente' :
      selectedType === 'producto' ? 'Producto' :
      selectedType === 'operacion' ? 'Operación' : 'Factura';

    return (
      <div>
        <Header
          title={selectedLabel}
          description={typeLabel}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={clearSelection}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
              {selectedType === 'importadora' && selectedId && (
                <>
                  <Button onClick={() => router.push(`/importadoras/${selectedId}`)}>
                    Ver detalle
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={async () => {
                      if (!selectedId) return;
                      try {
                        await importadorasApi.downloadExpediente(selectedId);
                        toast.success("Expediente descargado correctamente");
                      } catch (error) {
                        toast.error("Error al descargar expediente");
                        console.error(error);
                      }
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Expediente
                  </Button>
                </>
              )}
              {selectedType === 'operacion' && selectedId && (
                <Button onClick={() => selectedId && router.push(`/operations/${selectedId}`)}>
                  Ver detalle
                </Button>
              )}
            </div>
          }
        />

        {loadingDetail && (
          <div className="text-center py-16 text-gray-500">
            <div className="animate-pulse text-lg">Cargando información...</div>
          </div>
        )}

        {detail && !loadingDetail && (
          <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            {selectedType === 'importadora' && <DetailImportadora data={detail} router={router} />}
            {selectedType === 'cliente' && <DetailCliente data={detail} router={router} />}
            {selectedType === 'producto' && <DetailProducto data={detail} router={router} />}
            {selectedType === 'operacion' && <DetailOperacion data={detail} router={router} />}
            {selectedType === 'factura' && <DetailFactura data={detail} router={router} />}
          </div>
        )}
      </div>
    );
  }

  // ====================== VISTA DE BÚSQUEDA ======================
  return (
    <div>
      <Header
        title="Buscar"
        description="Busca por importadora, cliente, producto, factura u operación."
      />

      <div className="p-4 sm:p-6 lg:p-8">
        {/* Buscador */}
        <div className="mb-6">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Escribe nombre, número, código..."
              className="pl-10 pr-10"
              autoFocus
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(""); setResults(null); setHasSearched(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <X className="h-3 w-3 text-gray-500" />
              </button>
            )}
          </div>

          {/* Hints */}
          {!hasSearched && !searchTerm && (
            <div className="flex flex-wrap items-center gap-2 mt-3 text-sm text-gray-400">
              <span>Ejemplos:</span>
              {["Quimimport", "Juan", "Arroz", "FAC-001", "OP-001"].map(hint => (
                <button
                  key={hint}
                  onClick={() => setSearchTerm(hint)}
                  className="px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors text-xs"
                >
                  {hint}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Resultados */}
        {searching && (
          <div className="text-center text-gray-500 py-8">Buscando en todo el sistema...</div>
        )}

        {!searching && hasSearched && totalResults === 0 && (
          <div className="py-12 text-center text-gray-400">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-base">No se encontraron resultados</p>
            <p className="text-sm mt-1">Intenta con otro término</p>
          </div>
        )}

        {!searching && results && totalResults > 0 && (
          <div className="space-y-6">
            <p className="text-sm text-gray-500">{totalResults} resultados encontrados</p>

            {/* Importadoras */}
            {results.importadoras.length > 0 && (
              <ResultSection title="Importadoras" icon={<Building2 className="h-4 w-4 text-muted-foreground" />} count={results.importadoras.length}>
                {results.importadoras.map((imp) => (
                  <div key={imp.id} className="flex items-center gap-2">
                    <div className="flex-1">
                      <ResultItem
                        onClick={() => selectEntity('importadora', imp.id, imp.nombre)}
                        title={imp.nombre}
                        subtitle={[imp.pais, imp.contacto, imp.puertoDestinoDefault].filter(Boolean).join(' • ')}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await importadorasApi.downloadExpediente(imp.id);
                          toast.success("Expediente descargado correctamente");
                        } catch (error) {
                          toast.error("Error al descargar expediente");
                          console.error(error);
                        }
                      }}
                      title="Descargar expediente"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </ResultSection>
            )}

            {/* Clientes */}
            {results.clientes.length > 0 && (
              <ResultSection title="Clientes" icon={<Users className="h-4 w-4 text-muted-foreground" />} count={results.clientes.length}>
                {results.clientes.map((cli) => (
                  <ResultItem
                    key={cli.id}
                    onClick={() => selectEntity('cliente', cli.id, `${cli.nombre} ${cli.apellidos || ''}`)}
                    title={`${cli.nombre} ${cli.apellidos || ''}`}
                    subtitle={[cli.nombreCompania, cli.email, cli.telefono].filter(Boolean).join(' • ')}
                  />
                ))}
              </ResultSection>
            )}

            {/* Productos */}
            {results.productos.length > 0 && (
              <ResultSection title="Productos" icon={<Package className="h-4 w-4 text-muted-foreground" />} count={results.productos.length}>
                {results.productos.map((prod) => (
                  <ResultItem
                    key={prod.id}
                    onClick={() => selectEntity('producto', prod.id, prod.nombre)}
                    title={prod.nombre}
                    subtitle={[prod.codigo, prod.codigoArancelario ? `Arancel: ${prod.codigoArancelario}` : null, formatCurrency(prod.precioBase)].filter(Boolean).join(' • ')}
                  />
                ))}
              </ResultSection>
            )}

            {/* Operaciones */}
            {results.operaciones.length > 0 && (
              <ResultSection title="Operaciones" icon={<Ship className="h-4 w-4 text-muted-foreground" />} count={results.operaciones.length}>
                {results.operaciones.map((op) => (
                  <ResultItem
                    key={op.id}
                    onClick={() => selectEntity('operacion', op.id, op.operationNo)}
                    title={op.operationNo}
                    subtitle={[op.operationType, op.status, op.currentLocation].filter(Boolean).join(' • ')}
                    badge={<Badge variant="outline" className="text-xs">{op.status}</Badge>}
                  />
                ))}
              </ResultSection>
            )}

            {/* Facturas */}
            {results.facturas.length > 0 && (
              <ResultSection title="Facturas" icon={<Receipt className="h-4 w-4 text-muted-foreground" />} count={results.facturas.length}>
                {results.facturas.map((fac) => (
                  <ResultItem
                    key={fac.id}
                    onClick={() => selectEntity('factura', fac.id, fac.numero)}
                    title={fac.numero}
                    subtitle={`${formatDate(fac.fecha)} • ${formatCurrency(fac.total)}`}
                    badge={<Badge variant={fac.estado === 'pagada' ? 'default' : 'secondary'} className="text-xs">{fac.estado}</Badge>}
                  />
                ))}
              </ResultSection>
            )}

            {/* Ofertas a Importadora */}
            {results.ofertasImportadora.length > 0 && (
              <ResultSection title="Ofertas a Importadora" icon={<FileText className="h-4 w-4 text-muted-foreground" />} count={results.ofertasImportadora.length}>
                {results.ofertasImportadora.map((of) => (
                  <ResultItem
                    key={of.id}
                    onClick={() => router.push(`/ofertas/importadora`)}
                    title={of.numero}
                    subtitle={`${of.importadora?.nombre || ''} • ${formatDate(of.fecha)} ${of.precioCIF ? '• CIF ' + formatCurrency(of.precioCIF) : ''}`}
                    badge={<Badge variant="outline" className="text-xs">{of.estado}</Badge>}
                  />
                ))}
              </ResultSection>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Componentes de resultado ====================

function ResultSection({ title, icon, count, children }: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        {icon}
        <h3 className="font-semibold text-gray-700 text-sm">{title}</h3>
        <Badge variant="secondary" className="text-xs">{count}</Badge>
      </div>
      <div className="divide-y">
        {children}
      </div>
    </div>
  );
}

function ResultItem({ onClick, title, subtitle, badge }: {
  onClick: () => void;
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-3 text-left group"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate text-sm">{title}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {badge}
        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-600 transition-colors" />
      </div>
    </button>
  );
}

// ==================== Componentes de detalle ====================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DetailImportadora({ data, router }: { data: any; router: any }): React.ReactElement {
  const rel = data.relaciones;
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Clientes" value={rel.clientes?.length || 0} icon={<Users className="h-4 w-4 text-slate-400" />} />
        <KpiCard title="Ofertas" value={rel.ofertas?.length || 0} icon={<FileText className="h-4 w-4 text-slate-400" />} />
        <KpiCard title="Facturas" value={rel.facturas?.length || 0} icon={<Receipt className="h-4 w-4 text-slate-400" />} />
        <KpiCard title="Operaciones" value={rel.operaciones?.length || 0} icon={<Ship className="h-4 w-4 text-slate-400" />} />
      </div>

      {/* Contenedores */}
      {rel.containers && (
        <Card className="bg-white/80 backdrop-blur border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" /> Contenedores
              <Badge variant="outline" className="ml-2">{rel.containers.total} total</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatBox label="En Tránsito" value={rel.containers.enTransito} color="blue" icon={<Ship />} />
              <StatBox label="En Aduana" value={rel.containers.enAduana} color="amber" icon={<Package />} />
              <StatBox label="Entregados" value={rel.containers.entregados} color="green" icon={<MapPin />} />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clientes */}
        {rel.clientes?.length > 0 && (
          <Card className="bg-white/80 backdrop-blur border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" /> Clientes
                <Badge variant="outline" className="ml-2">{rel.clientes.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {rel.clientes.map((cli: { id: string; nombre: string; apellidos?: string; nombreCompania?: string }) => (
                  <div key={cli.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="font-medium text-slate-900">{cli.nombre} {cli.apellidos || ''}</p>
                    {cli.nombreCompania && <p className="text-sm text-slate-500">{cli.nombreCompania}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Productos Top */}
        {rel.productos?.length > 0 && (
          <Card className="bg-white/80 backdrop-blur border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" /> Top Productos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rel.productos.map((item: { producto: { id: string; nombre: string }; cantidad: number; importe: number }) => (
                      <TableRow key={item.producto.id}>
                        <TableCell className="font-medium max-w-[180px] truncate">{item.producto.nombre}</TableCell>
                        <TableCell className="text-right">{item.cantidad.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.importe)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Facturas */}
      {rel.facturas?.length > 0 && (
        <Card className="bg-white/80 backdrop-blur border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" /> Facturas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rel.facturas.map((f: { id: string; numero: string; fecha: string; estado: string; total: number; cliente?: { nombre: string; apellidos?: string } }) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.numero}</TableCell>
                      <TableCell>{formatDate(f.fecha)}</TableCell>
                      <TableCell>{f.cliente ? `${f.cliente.nombre} ${f.cliente.apellidos || ''}` : '-'}</TableCell>
                      <TableCell>
                        <Badge variant={f.estado === 'pagada' ? 'default' : f.estado === 'vencida' ? 'destructive' : 'secondary'} className="text-xs">
                          {f.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(f.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Operaciones */}
      {rel.operaciones?.length > 0 && (
        <Card className="bg-white/80 backdrop-blur border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ship className="h-5 w-5" /> Operaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operación</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Contenedores</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rel.operaciones.map((op: { id: string; operationNo: string; operationType: string; status: string; containers?: { id: string }[] }) => (
                    <TableRow key={op.id} className="cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/operations/${op.id}`)}>
                      <TableCell className="font-medium">{op.operationNo}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={op.operationType === 'COMMERCIAL' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}>
                          {op.operationType}
                        </Badge>
                      </TableCell>
                      <TableCell><Badge variant="outline">{op.status}</Badge></TableCell>
                      <TableCell>{op.containers?.length || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DetailCliente({ data, router }: { data: any; router: any }): React.ReactElement {
  const rel = data.relaciones;
  const entity = data.entity;
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Info del cliente */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {entity.email && (
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-400 mb-1">Email</p>
            <p className="text-sm font-medium text-slate-700">{entity.email}</p>
          </div>
        )}
        {entity.telefono && (
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-400 mb-1">Teléfono</p>
            <p className="text-sm font-medium text-slate-700">{entity.telefono}</p>
          </div>
        )}
        {entity.nombreCompania && (
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-400 mb-1">Compañía</p>
            <p className="text-sm font-medium text-slate-700">{entity.nombreCompania}</p>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard title="Importadoras" value={rel.importadoras?.length || 0} icon={<Building2 className="h-4 w-4 text-slate-400" />} />
        <KpiCard title="Ofertas Cliente" value={rel.ofertasCliente?.length || 0} icon={<FileText className="h-4 w-4 text-slate-400" />} />
        <KpiCard title="Ofertas Import." value={rel.ofertasImportadora?.length || 0} icon={<Ship className="h-4 w-4 text-slate-400" />} />
        <KpiCard title="Facturas" value={rel.facturas?.length || 0} icon={<Receipt className="h-4 w-4 text-slate-400" />} />
        <KpiCard title="Operaciones" value={rel.operaciones?.length || 0} icon={<Activity className="h-4 w-4 text-slate-400" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Importadoras con las que trabaja */}
        {rel.importadoras?.length > 0 && (
          <Card className="bg-white/80 backdrop-blur border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" /> Importadoras
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {rel.importadoras.map((imp: { id: string; nombre: string; pais?: string; puertoDestinoDefault?: string }) => (
                  <div key={imp.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{imp.nombre}</p>
                      <p className="text-sm text-slate-500">{[imp.pais, imp.puertoDestinoDefault].filter(Boolean).join(' • ')}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/importadoras/${imp.id}`)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Productos */}
        {rel.productos?.length > 0 && (
          <Card className="bg-white/80 backdrop-blur border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" /> Top Productos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rel.productos.map((item: { producto: { id: string; nombre: string }; cantidad: number; importe: number }) => (
                      <TableRow key={item.producto.id}>
                        <TableCell className="font-medium">{item.producto.nombre}</TableCell>
                        <TableCell className="text-right">{item.cantidad.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.importe)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Facturas */}
      {rel.facturas?.length > 0 && (
        <Card className="bg-white/80 backdrop-blur border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" /> Facturas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Importadora</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rel.facturas.map((f: { id: string; numero: string; fecha: string; estado: string; total: number; importadora?: { nombre: string } }) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.numero}</TableCell>
                      <TableCell>{formatDate(f.fecha)}</TableCell>
                      <TableCell>{f.importadora?.nombre || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={f.estado === 'pagada' ? 'default' : 'secondary'} className="text-xs">{f.estado}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(f.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Operaciones */}
      {rel.operaciones?.length > 0 && (
        <Card className="bg-white/80 backdrop-blur border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ship className="h-5 w-5" /> Operaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operación</TableHead>
                    <TableHead>Importadora</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Contenedores</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rel.operaciones.map((op: { id: string; operationNo: string; status: string; importadora?: { nombre: string }; containers?: { id: string }[] }) => (
                    <TableRow key={op.id} className="cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/operations/${op.id}`)}>
                      <TableCell className="font-medium">{op.operationNo}</TableCell>
                      <TableCell>{op.importadora?.nombre || '-'}</TableCell>
                      <TableCell><Badge variant="outline">{op.status}</Badge></TableCell>
                      <TableCell>{op.containers?.length || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DetailProducto({ data, router }: { data: any; router: any }): React.ReactElement {
  const rel = data.relaciones;
  const entity = data.entity;
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Info del producto */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {entity.codigo && (
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-400 mb-1">Código</p>
            <p className="text-sm font-medium text-slate-700">{entity.codigo}</p>
          </div>
        )}
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-400 mb-1">Precio Base</p>
          <p className="text-sm font-medium text-slate-700">{formatCurrency(entity.precioBase)}</p>
        </div>
        {entity.unidadMedida && (
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-400 mb-1">Unidad</p>
            <p className="text-sm font-medium text-slate-700">{entity.unidadMedida.nombre}</p>
          </div>
        )}
        {entity.codigoArancelario && (
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-400 mb-1">Cód. Arancelario</p>
            <p className="text-sm font-medium text-slate-700">{entity.codigoArancelario}</p>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Total Vendido" value={rel.totalVendido?.toLocaleString() || 0} icon={<Hash className="h-4 w-4 text-slate-400" />} />
        <KpiCard title="Total Importe" value={formatCurrency(rel.totalImporte || 0)} icon={<DollarSign className="h-4 w-4 text-slate-400" />} isText />
        <KpiCard title="Importadoras" value={rel.importadoras?.length || 0} icon={<Building2 className="h-4 w-4 text-slate-400" />} />
        <KpiCard title="Clientes" value={rel.clientes?.length || 0} icon={<Users className="h-4 w-4 text-slate-400" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Importadoras que compran este producto */}
        {rel.importadoras?.length > 0 && (
          <Card className="bg-white/80 backdrop-blur border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" /> Importadoras
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Importadora</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rel.importadoras.map((imp: { id: string; nombre: string; cantidad: number; importe: number }) => (
                      <TableRow key={imp.id} className="cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/importadoras/${imp.id}`)}>
                        <TableCell className="font-medium">{imp.nombre}</TableCell>
                        <TableCell className="text-right">{imp.cantidad.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatCurrency(imp.importe)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Clientes que compran este producto */}
        {rel.clientes?.length > 0 && (
          <Card className="bg-white/80 backdrop-blur border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" /> Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rel.clientes.map((cli: { id: string; nombre: string; apellidos?: string; cantidad: number; importe: number }) => (
                      <TableRow key={cli.id}>
                        <TableCell className="font-medium">{cli.nombre} {cli.apellidos || ''}</TableCell>
                        <TableCell className="text-right">{cli.cantidad.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatCurrency(cli.importe)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Facturas con este producto */}
      {rel.facturas?.length > 0 && (
        <Card className="bg-white/80 backdrop-blur border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" /> Facturas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Importadora</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rel.facturas.map((f: { id: string; numero: string; fecha: string; cantidad: number; subtotal: number; cliente?: { nombre: string; apellidos?: string }; importadora?: { nombre: string } }) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.numero}</TableCell>
                      <TableCell>{formatDate(f.fecha)}</TableCell>
                      <TableCell>{f.cliente ? `${f.cliente.nombre} ${f.cliente.apellidos || ''}` : '-'}</TableCell>
                      <TableCell>{f.importadora?.nombre || '-'}</TableCell>
                      <TableCell className="text-right">{f.cantidad?.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatCurrency(f.subtotal || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Operaciones */}
      {rel.operaciones?.length > 0 && (
        <Card className="bg-white/80 backdrop-blur border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ship className="h-5 w-5" /> Operaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operación</TableHead>
                    <TableHead>Importadora</TableHead>
                    <TableHead>Contenedores</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rel.operaciones.map((op: { id: string; operationNo: string; importadora?: { nombre: string }; containers?: { id: string }[] }) => (
                    <TableRow key={op.id} className="cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/operations/${op.id}`)}>
                      <TableCell className="font-medium">{op.operationNo}</TableCell>
                      <TableCell>{op.importadora?.nombre || '-'}</TableCell>
                      <TableCell>{op.containers?.length || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DetailOperacion({ data, router }: { data: any; router: any }): React.ReactElement {
  const rel = data.relaciones;
  const entity = data.entity;
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-400 mb-1">Tipo</p>
          <Badge variant="outline" className={entity.operationType === 'COMMERCIAL' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}>
            {entity.operationType}
          </Badge>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-400 mb-1">Estado</p>
          <Badge variant="outline">{entity.status}</Badge>
        </div>
        {entity.currentLocation && (
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-400 mb-1">Ubicación</p>
            <p className="text-sm font-medium text-slate-700">{entity.currentLocation}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Importadora */}
        {rel.importadora && (
          <Card className="bg-white/80 backdrop-blur border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" /> Importadora
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{rel.importadora.nombre}</p>
                  <p className="text-sm text-slate-500">{rel.importadora.pais || ''}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => router.push(`/importadoras/${rel.importadora.id}`)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cliente */}
        {rel.cliente && (
          <Card className="bg-white/80 backdrop-blur border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" /> Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="font-semibold text-slate-900">{rel.cliente.nombre} {rel.cliente.apellidos || ''}</p>
                {rel.cliente.nombreCompania && <p className="text-sm text-slate-500">{rel.cliente.nombreCompania}</p>}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Contenedores */}
      {rel.containers?.length > 0 && (
        <Card className="bg-white/80 backdrop-blur border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" /> Contenedores
              <Badge variant="outline" className="ml-2">{rel.containers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Container No</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Ubicación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rel.containers.map((c: { id: string; sequenceNo: number; containerNo: string; status: string; currentLocation?: string }) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.sequenceNo}</TableCell>
                      <TableCell className="font-medium">{c.containerNo}</TableCell>
                      <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                      <TableCell>{c.currentLocation || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Eventos */}
      {rel.eventos?.length > 0 && (
        <Card className="bg-white/80 backdrop-blur border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" /> Últimos Eventos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rel.eventos.map((ev: { id: string; eventType: string; eventDate: string; notes?: string }) => (
                <div key={ev.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Activity className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{ev.eventType}</p>
                    <p className="text-sm text-slate-500">{formatDate(ev.eventDate)}</p>
                    {ev.notes && <p className="text-sm text-slate-600 mt-1">{ev.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DetailFactura({ data, router }: { data: any; router: any }): React.ReactElement {
  const rel = data.relaciones;
  const entity = data.entity;
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-400 mb-1">Fecha</p>
          <p className="text-sm font-medium text-slate-700">{formatDate(entity.fecha)}</p>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-400 mb-1">Estado</p>
          <Badge variant={entity.estado === 'pagada' ? 'default' : entity.estado === 'vencida' ? 'destructive' : 'secondary'}>
            {entity.estado}
          </Badge>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-400 mb-1">Total</p>
          <p className="text-lg font-bold text-slate-900">{formatCurrency(entity.total)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cliente */}
        {rel.cliente && (
          <Card className="bg-white/80 backdrop-blur border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" /> Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="font-semibold text-slate-900">{rel.cliente.nombre} {rel.cliente.apellidos || ''}</p>
                {rel.cliente.nombreCompania && <p className="text-sm text-slate-500">{rel.cliente.nombreCompania}</p>}
                {rel.cliente.email && <p className="text-sm text-slate-500">{rel.cliente.email}</p>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Importadora */}
        {rel.importadora && (
          <Card className="bg-white/80 backdrop-blur border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" /> Importadora
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{rel.importadora.nombre}</p>
                  <p className="text-sm text-slate-500">{rel.importadora.pais || ''}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => router.push(`/importadoras/${rel.importadora.id}`)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Productos de la factura */}
      {rel.productos?.length > 0 && (
        <Card className="bg-white/80 backdrop-blur border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" /> Productos
              <Badge variant="outline" className="ml-2">{rel.productos.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rel.productos.map((item: { id: string; producto: { nombre: string; codigo?: string }; cantidad: number; precioUnitario: number; subtotal: number }) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.producto?.nombre || '-'}</TableCell>
                      <TableCell className="text-right">{item.cantidad?.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.precioUnitario || 0)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.subtotal || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Operación asociada */}
      {rel.operacion && (
        <Card className="bg-white/80 backdrop-blur border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ship className="h-5 w-5" /> Operación Asociada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => router.push(`/operations/${rel.operacion.id}`)}>
              <div>
                <p className="font-semibold text-slate-900">{rel.operacion.operationNo}</p>
                <p className="text-sm text-slate-500">{rel.operacion.containers?.length || 0} contenedores</p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ==================== Componentes reutilizables ====================

function KpiCard({ title, value, icon, isText }: { title: string; value: string | number; icon: React.ReactNode; isText?: boolean }): React.ReactElement {
  return (
    <Card className="bg-white/80 backdrop-blur border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`${isText ? 'text-xl' : 'text-3xl'} font-bold text-slate-900`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function StatBox({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }): React.ReactElement {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-50 to-blue-100 border-blue-200',
    amber: 'from-amber-50 to-amber-100 border-amber-200',
    green: 'from-green-50 to-green-100 border-green-200',
  };
  const textMap: Record<string, string> = {
    blue: 'text-blue-700',
    amber: 'text-amber-700',
    green: 'text-green-700',
  };
  const numMap: Record<string, string> = {
    blue: 'text-blue-900',
    amber: 'text-amber-900',
    green: 'text-green-900',
  };
  const iconMap: Record<string, string> = {
    blue: 'text-blue-200',
    amber: 'text-amber-200',
    green: 'text-green-200',
  };
  return (
    <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${colorMap[color]} p-5 border`}>
      <div className={`absolute -right-2 -bottom-2 h-16 w-16 ${iconMap[color]} opacity-50`}>
        {icon}
      </div>
      <p className={`text-sm font-medium ${textMap[color]}`}>{label}</p>
      <p className={`text-4xl font-bold ${numMap[color]} mt-1`}>{value}</p>
    </div>
  );
}
