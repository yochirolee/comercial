"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { ArrowLeft, Package, Users, Receipt, Ship, TrendingUp } from "lucide-react";
import { importadorasApi } from "@/lib/api";
import type { Importadora } from "@/lib/api";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CU", {
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

export default function ImportadoraDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [importadora, setImportadora] = useState<Importadora | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadImportadora(): Promise<void> {
    try {
      setLoading(true);
      const data = await importadorasApi.getById(id);
      setImportadora(data);
    } catch (error) {
      toast.error("Error al cargar importadora");
      console.error(error);
      router.back();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) {
      loadImportadora();
    }
  }, [id]);

  if (loading) {
    return (
      <div>
        <Header title="Cargando..." description="" />
        <div className="p-6 text-center text-gray-500">Cargando información...</div>
      </div>
    );
  }

  if (!importadora) {
    return null;
  }

  const stats = importadora.estadisticas;

  return (
    <div>
      <Header
        title={importadora.nombre}
        description="Detalle de Importadora"
        actions={
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Información General */}
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Dirección</p>
                <p className="font-medium">{importadora.direccion || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">País</p>
                <p className="font-medium">{importadora.pais || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Puerto Destino Default</p>
                <p className="font-medium">{importadora.puertoDestinoDefault || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Contacto</p>
                <p className="font-medium">{importadora.contacto || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Teléfono</p>
                <p className="font-medium">{importadora.telefono || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{importadora.email || "-"}</p>
              </div>
              {importadora.notas && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500">Notas</p>
                  <p className="font-medium whitespace-pre-wrap">{importadora.notas}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Estadísticas */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clientes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalClientes}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ofertas</CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalOfertas}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Facturas</CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalFacturas}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Operaciones</CardTitle>
                <Ship className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalOperaciones}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Contenedores */}
        {stats && (
          <Card>
            <CardHeader>
              <CardTitle>Estado de Contenedores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">En Tránsito</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.containersEnTransito}</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-gray-600">En Aduana</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.containersEnAduana}</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Entregados</p>
                  <p className="text-2xl font-bold text-green-600">{stats.containersEntregados}</p>
                </div>
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-500">Total de Contenedores: {stats.totalContainers}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Clientes Asociados */}
        {importadora.clientes && importadora.clientes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Clientes Asociados ({importadora.clientes.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Compañía</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Teléfono</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importadora.clientes.map((relacion) => (
                      <TableRow key={relacion.id}>
                        <TableCell className="font-medium">
                          {relacion.cliente.nombre} {relacion.cliente.apellidos || ""}
                        </TableCell>
                        <TableCell>{relacion.cliente.nombreCompania || "-"}</TableCell>
                        <TableCell>{relacion.cliente.email || "-"}</TableCell>
                        <TableCell>{relacion.cliente.telefono || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Productos */}
        {importadora.productos && importadora.productos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Top Productos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Importe Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importadora.productos.map((item, index) => (
                      <TableRow key={item.producto.id}>
                        <TableCell className="font-medium">{item.producto.nombre}</TableCell>
                        <TableCell>{item.producto.codigo || "-"}</TableCell>
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

        {/* Últimas Facturas */}
        {importadora.facturas && importadora.facturas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Últimas Facturas ({importadora.facturas.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
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
                    {importadora.facturas.map((factura) => (
                      <TableRow key={factura.id}>
                        <TableCell className="font-medium">{factura.numero}</TableCell>
                        <TableCell>{formatDate(factura.fecha)}</TableCell>
                        <TableCell>
                          {factura.cliente.nombre} {factura.cliente.apellidos || ""}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              factura.estado === "pagada"
                                ? "default"
                                : factura.estado === "vencida"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {factura.estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(factura.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Últimas Ofertas */}
        {importadora.ofertasImportadora && importadora.ofertasImportadora.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Últimas Ofertas ({importadora.ofertasImportadora.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">CIF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importadora.ofertasImportadora.map((oferta) => (
                      <TableRow key={oferta.id}>
                        <TableCell className="font-medium">{oferta.numero}</TableCell>
                        <TableCell>{formatDate(oferta.fecha)}</TableCell>
                        <TableCell>
                          {oferta.cliente.nombre} {oferta.cliente.apellidos || ""}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{oferta.estado}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(oferta.precioCIF || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Últimas Operaciones */}
        {importadora.operaciones && importadora.operaciones.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Últimas Operaciones ({importadora.operaciones.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead>Contenedores</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importadora.operaciones.map((operacion) => (
                      <TableRow key={operacion.id}>
                        <TableCell className="font-medium">{operacion.operationNo}</TableCell>
                        <TableCell>
                          <Badge
                            variant={operacion.operationType === "COMMERCIAL" ? "default" : "secondary"}
                          >
                            {operacion.operationType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{operacion.status}</Badge>
                        </TableCell>
                        <TableCell>{operacion.currentLocation || "-"}</TableCell>
                        <TableCell>{operacion.containers?.length || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
