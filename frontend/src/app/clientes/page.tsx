"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { clientesApi, exportApi } from "@/lib/api";
import type { Cliente, ClienteInput } from "@/lib/api";

const PAGE_SIZE = 10;

const emptyCliente: ClienteInput = {
  nombre: "",
  apellidos: "",
  contacto: "",
  nombreCompania: "",
  direccion: "",
  telefono: "",
  email: "",
  nit: "",
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ClienteInput>(emptyCliente);
  const [saving, setSaving] = useState(false);

  const totalPages = Math.max(1, Math.ceil(clientes.length / PAGE_SIZE));
  const start = (currentPage - 1) * PAGE_SIZE;
  const paginatedClientes = clientes.slice(start, start + PAGE_SIZE);

  async function loadClientes(): Promise<void> {
    try {
      const data = await clientesApi.getAll(search);
      setClientes(data);
    } catch (error) {
      toast.error("Error al cargar clientes");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setCurrentPage(1);
    loadClientes();
  }, [search]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function openNewDialog(): void {
    setEditingId(null);
    setFormData(emptyCliente);
    setDialogOpen(true);
  }

  function openEditDialog(cliente: Cliente): void {
    setEditingId(cliente.id);
    setFormData({
      nombre: cliente.nombre,
      apellidos: cliente.apellidos || "",
      contacto: cliente.contacto || "",
      nombreCompania: cliente.nombreCompania || "",
      direccion: cliente.direccion || "",
      telefono: cliente.telefono || "",
      email: cliente.email || "",
      nit: cliente.nit || "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingId) {
        await clientesApi.update(editingId, formData);
        toast.success("Cliente actualizado");
      } else {
        await clientesApi.create(formData);
        toast.success("Cliente creado");
      }
      setDialogOpen(false);
      loadClientes();
    } catch (error) {
      toast.error("Error al guardar cliente");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (!confirm("¿Estás seguro de eliminar este cliente?")) return;

    try {
      await clientesApi.delete(id);
      toast.success("Cliente eliminado");
      loadClientes();
    } catch (error) {
      toast.error("Error al eliminar cliente");
      console.error(error);
    }
  }

  return (
    <div>
      <Header
        title="Clientes"
        description="Gestiona tus clientes"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await exportApi.exportAllClientes(search);
                  toast.success("Clientes exportados correctamente");
                } catch (error) {
                  toast.error("Error al exportar clientes");
                  console.error(error);
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar Excel
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNewDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Cliente
                </Button>
              </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Editar Cliente" : "Nuevo Cliente"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input
                      id="nombre"
                      name="nombre"
                      value={formData.nombre}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apellidos">Apellidos</Label>
                    <Input
                      id="apellidos"
                      name="apellidos"
                      value={formData.apellidos}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contacto">Persona de Contacto</Label>
                    <Input
                      id="contacto"
                      name="contacto"
                      value={formData.contacto}
                      onChange={handleChange}
                      placeholder="Nombre"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nombreCompania">Compañía</Label>
                    <Input
                      id="nombreCompania"
                      name="nombreCompania"
                      value={formData.nombreCompania}
                      onChange={handleChange}
                      placeholder="Nombre de la Compañía"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="direccion">Dirección</Label>
                    <Input
                      id="direccion"
                      name="direccion"
                      value={formData.direccion}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      name="telefono"
                      value={formData.telefono}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nit">NIT</Label>
                    <Input
                      id="nit"
                      name="nit"
                      value={formData.nit}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-4 sm:mb-6">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar clientes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Vista móvil: Cards */}
        <div className="block sm:hidden space-y-3">
          {loading ? (
            <div className="text-center py-8 text-slate-500">Cargando...</div>
          ) : clientes.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No hay clientes</div>
          ) : (
            paginatedClientes.map((cliente) => (
              <div key={cliente.id} className="bg-white rounded-lg border shadow-sm p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium text-sm">{cliente.nombre} {cliente.apellidos}</p>
                    {cliente.nombreCompania && (
                      <p className="text-xs text-slate-500">{cliente.nombreCompania}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(cliente)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(cliente.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  {cliente.telefono && <p>📞 {cliente.telefono}</p>}
                  {cliente.email && <p>✉️ {cliente.email}</p>}
                  {cliente.nit && <p>NIT: {cliente.nit}</p>}
                </div>
              </div>
            ))
          )}
          {!loading && clientes.length > 0 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-xs sm:text-sm text-slate-500">
                {start + 1}-{Math.min(start + PAGE_SIZE, clientes.length)} de {clientes.length}
              </p>
              <div className="flex gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 sm:h-9"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 sm:h-9"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Vista desktop: Tabla */}
        <div className="hidden sm:block bg-white rounded-lg border shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Compañía</TableHead>
                <TableHead className="hidden md:table-cell">NIT</TableHead>
                <TableHead className="hidden lg:table-cell">Teléfono</TableHead>
                <TableHead className="hidden lg:table-cell">Email</TableHead>
                <TableHead className="w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : clientes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    No hay clientes
                  </TableCell>
                </TableRow>
              ) : (
                paginatedClientes.map((cliente) => (
                  <TableRow key={cliente.id}>
                    <TableCell className="font-medium">
                      {cliente.nombre} {cliente.apellidos}
                    </TableCell>
                    <TableCell>{cliente.nombreCompania || "-"}</TableCell>
                    <TableCell className="hidden md:table-cell">{cliente.nit || "-"}</TableCell>
                    <TableCell className="hidden lg:table-cell">{cliente.telefono || "-"}</TableCell>
                    <TableCell className="hidden lg:table-cell">{cliente.email || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(cliente)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(cliente.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {!loading && clientes.length > 0 && (
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-t bg-slate-50/50">
              <p className="text-xs sm:text-sm text-slate-500">
                <span className="hidden sm:inline">Mostrando </span>
                {start + 1}-{Math.min(start + PAGE_SIZE, clientes.length)} de {clientes.length}
              </p>
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 sm:h-9"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Anterior</span>
                </Button>
                <span className="hidden sm:inline text-xs sm:text-sm text-slate-600">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 sm:h-9"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  <span className="hidden sm:inline">Siguiente</span>
                  <ChevronRight className="h-4 w-4 sm:ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

