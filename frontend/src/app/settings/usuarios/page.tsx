"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { authApi, type Usuario } from "@/lib/api";
import { Users, Trash2, Loader2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function UsuariosPage(): React.ReactElement {
  const { usuario: currentUser, refreshUser } = useAuth();
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<Usuario | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Estado para crear usuario
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    nombre: "",
    apellidos: "",
    email: "",
    telefono: "",
    password: "",
    rol: "comercial" as "admin" | "comercial",
  });

  // Verificar que el usuario es admin
  useEffect(() => {
    if (currentUser && currentUser.rol !== "admin") {
      toast.error("Acceso denegado. Se requiere rol de administrador.");
      router.push("/settings");
    }
  }, [currentUser, router]);

  // Cargar usuarios
  useEffect(() => {
    if (currentUser?.rol === "admin") {
      loadUsuarios();
    }
  }, [currentUser?.rol]);

  async function loadUsuarios(): Promise<void> {
    try {
      const data = await authApi.getAllUsers();
      setUsuarios(data);
    } catch (error) {
      toast.error("Error al cargar usuarios");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(user: Usuario, newRole: string): Promise<void> {
    if (newRole === user.rol) return;

    setUpdating(user.id);
    try {
      const updated = await authApi.updateUserRole(user.id, newRole as "admin" | "comercial");
      setUsuarios((prev) =>
        prev.map((u) => (u.id === user.id ? updated : u))
      );
      toast.success(`Rol de ${user.nombre} actualizado a ${newRole === "admin" ? "Administrador" : "Comercial"}`);
      
      // Si el usuario cambió su propio rol, actualizar el contexto
      if (user.id === currentUser?.id) {
        await refreshUser();
        // Si ya no es admin, redirigir
        if (newRole !== "admin") {
          router.push("/settings");
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar rol");
    } finally {
      setUpdating(null);
    }
  }

  function openDeleteDialog(user: Usuario): void {
    if (user.id === currentUser?.id) {
      toast.error("No puedes eliminar tu propia cuenta");
      return;
    }
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  }

  async function handleDeleteUser(): Promise<void> {
    if (!userToDelete) return;

    setDeleting(true);
    try {
      await authApi.deleteUser(userToDelete.id);
      setUsuarios((prev) => prev.filter((u) => u.id !== userToDelete.id));
      toast.success(`Usuario ${userToDelete.nombre} eliminado`);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al eliminar usuario");
    } finally {
      setDeleting(false);
    }
  }

  async function handleCreateUser(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    
    if (!newUser.nombre || !newUser.apellidos || !newUser.email || !newUser.password) {
      toast.error("Por favor completa todos los campos requeridos");
      return;
    }

    setCreating(true);
    try {
      const created = await authApi.createUser(newUser);
      setUsuarios((prev) => [...prev, created]);
      toast.success(`Usuario ${created.nombre} creado exitosamente`);
      setCreateDialogOpen(false);
      setNewUser({
        nombre: "",
        apellidos: "",
        email: "",
        telefono: "",
        password: "",
        rol: "comercial",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al crear usuario");
    } finally {
      setCreating(false);
    }
  }

  if (!currentUser || currentUser.rol !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Gestión de Usuarios"
        description="Administra los usuarios del sistema y sus roles"
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-6">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                Usuarios del Sistema
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">
                Gestiona los roles de los usuarios.
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Usuario
            </Button>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : (
              <>
                {/* Vista móvil: Cards */}
                <div className="block md:hidden space-y-3">
                  {usuarios.map((user) => (
                    <div key={user.id} className="border rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                            user.rol === "admin" ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-700"
                          }`}>
                            {user.nombre.charAt(0)}{user.apellidos.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{user.nombre} {user.apellidos}</p>
                            {user.id === currentUser?.id && (
                              <span className="text-xs text-amber-600 font-medium">(Tú)</span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(user)}
                          disabled={user.id === currentUser?.id}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="text-xs text-slate-500 space-y-1">
                        <p>✉️ {user.email}</p>
                        {user.telefono && <p>📞 {user.telefono}</p>}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <Select
                          value={user.rol}
                          onValueChange={(value) => handleRoleChange(user, value)}
                          disabled={updating === user.id}
                        >
                          <SelectTrigger className="w-full h-8 text-xs">
                            {updating === user.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <SelectValue />
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="comercial">Comercial</SelectItem>
                          </SelectContent>
                        </Select>
                        <Badge variant={user.activo ? "outline" : "destructive"} className="text-xs shrink-0">
                          {user.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Vista desktop: Tabla */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="hidden lg:table-cell">Teléfono</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usuarios.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                user.rol === "admin" ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-700"
                              }`}>
                                {user.nombre.charAt(0)}{user.apellidos.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium">{user.nombre} {user.apellidos}</p>
                                {user.id === currentUser?.id && (
                                  <span className="text-xs text-amber-600 font-medium">(Tú)</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-600">{user.email}</TableCell>
                          <TableCell className="text-slate-600 hidden lg:table-cell">{user.telefono || "-"}</TableCell>
                          <TableCell>
                            <Select
                              value={user.rol}
                              onValueChange={(value) => handleRoleChange(user, value)}
                              disabled={updating === user.id}
                            >
                              <SelectTrigger className="w-[140px]">
                                {updating === user.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <SelectValue />
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">
                                  <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                    Administrador
                                  </span>
                                </SelectItem>
                                <SelectItem value="comercial">
                                  <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                    Comercial
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.activo ? "outline" : "destructive"}>
                              {user.activo ? "Activo" : "Inactivo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDeleteDialog(user)}
                              disabled={user.id === currentUser?.id}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Eliminar usuario"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de confirmación para eliminar */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar Usuario</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar a <strong>{userToDelete?.nombre} {userToDelete?.apellidos}</strong>?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={deleting} className="w-full sm:w-auto">
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para crear nuevo usuario */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Usuario</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Completa los datos para crear un nuevo usuario.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  value={newUser.nombre}
                  onChange={(e) => setNewUser({ ...newUser, nombre: e.target.value })}
                  placeholder="Juan"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apellidos">Apellidos *</Label>
                <Input
                  id="apellidos"
                  value={newUser.apellidos}
                  onChange={(e) => setNewUser({ ...newUser, apellidos: e.target.value })}
                  placeholder="Pérez"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico *</Label>
              <Input
                id="email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="usuario@empresa.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                value={newUser.telefono}
                onChange={(e) => setNewUser({ ...newUser, telefono: e.target.value })}
                placeholder="+1 234 567 8900"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña *</Label>
              <Input
                id="password"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="••••••••"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rol">Rol</Label>
              <Select
                value={newUser.rol}
                onValueChange={(value) => setNewUser({ ...newUser, rol: value as "admin" | "comercial" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comercial">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Comercial
                    </span>
                  </SelectItem>
                  <SelectItem value="admin">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Administrador
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={creating} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button type="submit" disabled={creating} className="w-full sm:w-auto">
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Crear Usuario"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
