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
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { clientesApi } from "@/lib/api";
import type { Cliente, ClienteInput } from "@/lib/api";

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

export default function ClientesPage(): JSX.Element {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ClienteInput>(emptyCliente);
  const [saving, setSaving] = useState(false);

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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="w-full max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Editar Cliente" : "Nuevo Cliente"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                    <Label htmlFor="contacto">Persona de Contacto (para firma)</Label>
                    <Input
                      id="contacto"
                      name="contacto"
                      value={formData.contacto}
                      onChange={handleChange}
                      placeholder="HECTOR LAZARO"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nombreCompania">Nombre de la Compañía</Label>
                    <Input
                      id="nombreCompania"
                      name="nombreCompania"
                      value={formData.nombreCompania}
                      onChange={handleChange}
                      placeholder="PISOS DEL VALLE"
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
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
                <div className="flex justify-end gap-2">
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
        }
      />

      <div className="p-8">
        <div className="mb-6 flex gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar clientes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Compañía</TableHead>
                <TableHead>NIT</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : clientes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    No hay clientes
                  </TableCell>
                </TableRow>
              ) : (
                clientes.map((cliente) => (
                  <TableRow key={cliente.id}>
                    <TableCell className="font-medium">
                      {cliente.nombre} {cliente.apellidos}
                    </TableCell>
                    <TableCell>{cliente.nombreCompania || "-"}</TableCell>
                    <TableCell>{cliente.nit || "-"}</TableCell>
                    <TableCell>{cliente.telefono || "-"}</TableCell>
                    <TableCell>{cliente.email || "-"}</TableCell>
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
        </div>
      </div>
    </div>
  );
}

