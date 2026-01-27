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
import { Save, User, Shield } from "lucide-react";

export default function SettingsPage(): React.ReactElement {
  const { usuario, token, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    apellidos: "",
    telefono: "",
    rol: "comercial" as "admin" | "comercial",
  });

  useEffect(() => {
    if (usuario) {
      // Normalizar el rol: trim y lowercase para asegurar consistencia
      let rolNormalizado = usuario.rol 
        ? String(usuario.rol).trim().toLowerCase() 
        : "comercial";
      
      // Asegurar que sea uno de los valores válidos
      if (rolNormalizado !== "admin" && rolNormalizado !== "comercial") {
        rolNormalizado = "comercial";
      }
      
      const rolValido = rolNormalizado as "admin" | "comercial";
      
      // Actualizar formData con todos los valores del usuario
      setFormData({
        nombre: usuario.nombre || "",
        apellidos: usuario.apellidos || "",
        telefono: usuario.telefono || "",
        rol: rolValido,
      });
    }
  }, [usuario?.id, usuario?.rol]); // Depender específicamente del id y rol para detectar cambios

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
        rol: formData.rol.trim().toLowerCase() as "admin" | "comercial", // Asegurar lowercase
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

          {/* Rol */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Rol de Usuario
              </CardTitle>
              <CardDescription>
                Selecciona tu rol en el sistema. Los administradores tienen acceso completo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="rol">Rol *</Label>
                <select
                  id="rol"
                  value={formData.rol}
                  onChange={(e) => {
                    const normalizedValue = e.target.value.trim().toLowerCase() as "admin" | "comercial";
                    setFormData((p) => ({ ...p, rol: normalizedValue }));
                  }}
                  className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="admin">Admin - Acceso completo al sistema</option>
                  <option value="comercial">Comercial - Acceso completo (por ahora)</option>
                </select>
                <p className="text-xs text-slate-500">
                  {formData.rol === "admin" 
                    ? "Tienes acceso completo a todas las funcionalidades del sistema."
                    : "Tienes acceso completo. Las restricciones se implementarán más adelante."}
                </p>
              </div>
            </CardContent>
          </Card>

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
