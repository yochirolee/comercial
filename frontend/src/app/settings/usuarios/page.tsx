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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { authApi, type Usuario } from "@/lib/api";
import { Users, Shield, ShieldOff, UserCheck, UserX, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function UsuariosPage(): React.ReactElement {
  const { usuario: currentUser } = useAuth();
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

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

  async function handleToggleRole(user: Usuario): Promise<void> {
    if (user.id === currentUser?.id) {
      toast.error("No puedes cambiar tu propio rol");
      return;
    }

    setUpdating(user.id);
    try {
      const newRole = user.rol === "admin" ? "comercial" : "admin";
      const updated = await authApi.updateUserRole(user.id, newRole);
      setUsuarios((prev) =>
        prev.map((u) => (u.id === user.id ? updated : u))
      );
      toast.success(`Rol actualizado a ${newRole}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar rol");
    } finally {
      setUpdating(null);
    }
  }

  async function handleToggleActive(user: Usuario): Promise<void> {
    if (user.id === currentUser?.id) {
      toast.error("No puedes desactivar tu propia cuenta");
      return;
    }

    setUpdating(user.id);
    try {
      const updated = await authApi.toggleUserActive(user.id);
      setUsuarios((prev) =>
        prev.map((u) => (u.id === user.id ? updated : u))
      );
      toast.success(updated.activo ? "Usuario activado" : "Usuario desactivado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar estado");
    } finally {
      setUpdating(null);
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

      <div className="p-8">
        <div className="mb-6">
          <Link href="/settings">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Configuración
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuarios del Sistema
            </CardTitle>
            <CardDescription>
              Gestiona los roles y estado de los usuarios. Los administradores tienen acceso completo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.map((user) => (
                    <TableRow key={user.id} className={!user.activo ? "opacity-50" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium">
                            {user.nombre.charAt(0)}{user.apellidos.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium">{user.nombre} {user.apellidos}</p>
                            {user.id === currentUser?.id && (
                              <span className="text-xs text-amber-600">(Tú)</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">{user.email}</TableCell>
                      <TableCell className="text-slate-600">{user.telefono || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={user.rol === "admin" ? "default" : "secondary"}>
                          {user.rol === "admin" ? "Admin" : "Comercial"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.activo ? "outline" : "destructive"}>
                          {user.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleRole(user)}
                            disabled={updating === user.id || user.id === currentUser?.id}
                            title={user.rol === "admin" ? "Cambiar a Comercial" : "Cambiar a Admin"}
                          >
                            {updating === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : user.rol === "admin" ? (
                              <ShieldOff className="h-4 w-4" />
                            ) : (
                              <Shield className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActive(user)}
                            disabled={updating === user.id || user.id === currentUser?.id}
                            title={user.activo ? "Desactivar usuario" : "Activar usuario"}
                          >
                            {updating === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : user.activo ? (
                              <UserX className="h-4 w-4" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
