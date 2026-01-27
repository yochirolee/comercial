"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
// Usando select HTML nativo para mayor compatibilidad
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { authApi, type UsuarioUpdateInput } from "@/lib/api";
import { Save, User, Shield, Users, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function SettingsPage(): React.ReactElement {
  const { usuario, token, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    apellidos: "",
    telefono: "",
  });

  useEffect(() => {
    if (usuario) {
      setFormData({
        nombre: usuario.nombre || "",
        apellidos: usuario.apellidos || "",
        telefono: usuario.telefono || "",
      });
    }
  }, [usuario?.id]);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!token) {
      toast.error("No estás autenticado");
      return;
    }

    setLoading(true);
    try {
      const updateData: UsuarioUpdateInput = {
        nombre: formData.nombre,
        apellidos: formData.apellidos,
        telefono: formData.telefono || undefined,
      };

      await authApi.updateProfile(updateData);
      toast.success("Perfil actualizado exitosamente");
      
      // Actualizar el contexto sin recargar la página
      await refreshUser();
      
      // El useEffect detectará el cambio en usuario y actualizará formData automáticamente
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar perfil");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  if (!usuario) {
    return (
      <div>
        <Header title="Configuración" description="Gestiona tu información personal" />
        <div className="p-8">
          <p className="text-slate-500">Cargando información del usuario...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Configuración"
        description="Gestiona tu información personal y preferencias"
      />

      <div className="p-8">
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
          {/* Información Personal */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Información Personal
              </CardTitle>
              <CardDescription>
                Actualiza tu información personal. Todos los campos son editables.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData((p) => ({ ...p, nombre: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apellidos">Apellidos *</Label>
                  <Input
                    id="apellidos"
                    value={formData.apellidos}
                    onChange={(e) => setFormData((p) => ({ ...p, apellidos: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={formData.telefono}
                  onChange={(e) => setFormData((p) => ({ ...p, telefono: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={usuario.email}
                  disabled
                  className="bg-slate-50"
                />
                <p className="text-xs text-slate-500">El email no se puede modificar</p>
              </div>
            </CardContent>
          </Card>

          {/* Información del Rol (solo lectura) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Rol de Usuario
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  usuario.rol === "admin" 
                    ? "bg-amber-100 text-amber-800" 
                    : "bg-blue-100 text-blue-800"
                }`}>
                  {usuario.rol === "admin" ? "Administrador" : "Comercial"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {usuario.rol === "admin" 
                  ? "Tienes acceso completo a todas las funcionalidades del sistema."
                  : "Tienes acceso a las funcionalidades comerciales del sistema."}
              </p>
            </CardContent>
          </Card>

          {/* Sección de Administración (solo para admins) */}
          {usuario.rol === "admin" && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-800">
                  <Users className="h-5 w-5" />
                  Administración
                </CardTitle>
                <CardDescription>
                  Opciones disponibles solo para administradores.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/settings/usuarios">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-white hover:bg-amber-50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-100">
                        <Users className="h-5 w-5 text-amber-700" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">Gestión de Usuarios</p>
                        <p className="text-sm text-slate-500">Administra usuarios y asigna roles</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </div>
                </Link>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
