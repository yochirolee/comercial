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
import { Plus, Pencil, Trash2, Search, Eye } from "lucide-react";
import { importadorasApi } from "@/lib/api";
import type { Importadora, ImportadoraInput } from "@/lib/api";
import { useRouter } from "next/navigation";

const emptyImportadora: ImportadoraInput = {
  nombre: "",
  direccion: "",
  pais: "Cuba",
  puertoDestinoDefault: "MARIEL, Cuba",
  contacto: "",
  telefono: "",
  email: "",
  notas: "",
};

export default function ImportadorasPage() {
  const router = useRouter();
  const [importadoras, setImportadoras] = useState<Importadora[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ImportadoraInput>(emptyImportadora);
  const [saving, setSaving] = useState(false);

  async function loadImportadoras(): Promise<void> {
    try {
      setLoading(true);
      const data = await importadorasApi.getAll(search);
      setImportadoras(data);
    } catch (error) {
      toast.error("Error al cargar importadoras");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadImportadoras();
  }, [search]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function openNewDialog(): void {
    setEditingId(null);
    setFormData(emptyImportadora);
    setDialogOpen(true);
  }

  function openEditDialog(importadora: Importadora): void {
    setEditingId(importadora.id);
    setFormData({
      nombre: importadora.nombre,
      direccion: importadora.direccion || "",
      pais: importadora.pais || "Cuba",
      puertoDestinoDefault: importadora.puertoDestinoDefault || "MARIEL, Cuba",
      contacto: importadora.contacto || "",
      telefono: importadora.telefono || "",
      email: importadora.email || "",
      notas: importadora.notas || "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingId) {
        await importadorasApi.update(editingId, formData);
        toast.success("Importadora actualizada");
      } else {
        await importadorasApi.create(formData);
        toast.success("Importadora creada");
      }
      setDialogOpen(false);
      await loadImportadoras();
    } catch (error: any) {
      toast.error(error.message || "Error al guardar importadora");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (!window.confirm("¿Estás seguro de eliminar esta importadora?")) {
      return;
    }

    try {
      await importadorasApi.delete(id);
      toast.success("Importadora eliminada");
      await loadImportadoras();
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar importadora");
      console.error(error);
    }
  }

  function handleViewDetail(id: string): void {
    router.push(`/importadoras/${id}`);
  }

  return (
    <div>
      <Header
        title="Importadoras"
        description="Gestiona las importadoras (consignees)"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Importadora
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Editar Importadora" : "Nueva Importadora"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input
                      id="nombre"
                      name="nombre"
                      value={formData.nombre}
                      onChange={handleChange}
                      required
                      placeholder="Ej: Quimimport"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="direccion">Dirección</Label>
                    <Input
                      id="direccion"
                      name="direccion"
                      value={formData.direccion}
                      onChange={handleChange}
                      placeholder="Dirección completa"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pais">País</Label>
                    <Input
                      id="pais"
                      name="pais"
                      value={formData.pais}
                      onChange={handleChange}
                      placeholder="Cuba"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="puertoDestinoDefault">Puerto Destino Default</Label>
                    <Input
                      id="puertoDestinoDefault"
                      name="puertoDestinoDefault"
                      value={formData.puertoDestinoDefault}
                      onChange={handleChange}
                      placeholder="MARIEL, Cuba"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contacto">Contacto</Label>
                    <Input
                      id="contacto"
                      name="contacto"
                      value={formData.contacto}
                      onChange={handleChange}
                      placeholder="Nombre del contacto"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      name="telefono"
                      value={formData.telefono}
                      onChange={handleChange}
                      placeholder="+53..."
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
                      placeholder="email@ejemplo.com"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="notas">Notas</Label>
                    <textarea
                      id="notas"
                      name="notas"
                      value={formData.notas}
                      onChange={handleChange}
                      rows={3}
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Notas adicionales..."
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar importadoras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">Cargando...</div>
        ) : importadoras.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {search ? "No se encontraron importadoras" : "No hay importadoras registradas"}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>País</TableHead>
                  <TableHead>Puerto Destino</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importadoras.map((importadora) => (
                  <TableRow key={importadora.id}>
                    <TableCell className="font-medium">{importadora.nombre}</TableCell>
                    <TableCell>{importadora.pais || "-"}</TableCell>
                    <TableCell>{importadora.puertoDestinoDefault || "-"}</TableCell>
                    <TableCell>{importadora.contacto || "-"}</TableCell>
                    <TableCell>{importadora.telefono || "-"}</TableCell>
                    <TableCell>{importadora.email || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetail(importadora.id)}
                          title="Ver detalle"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(importadora)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(importadora.id)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
