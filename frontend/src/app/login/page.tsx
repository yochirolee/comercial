"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";
import { Package, Loader2 } from "lucide-react";
import { empresaApi, Empresa } from "@/lib/api";

export default function LoginPage(): React.ReactElement {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [loadingEmpresa, setLoadingEmpresa] = useState(true);

  useEffect(() => {
    empresaApi.get()
      .then(setEmpresa)
      .catch(() => {})
      .finally(() => setLoadingEmpresa(false));
  }, []);

  // Construir URL del logo
  function getLogoUrl(): string | null {
    if (!empresa?.logo) return null;
    // Si es URL completa (Cloudinary)
    if (empresa.logo.startsWith('http')) return empresa.logo;
    // Si es ruta local, construir URL del backend
    const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3001';
    return `${apiBase}${empresa.logo.startsWith('/') ? '' : '/'}${empresa.logo}`;
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      toast.success("¡Bienvenido!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-gold-pale via-white to-brand-gold-pale/50 p-4">
      <Card className="w-full max-w-md shadow-xl border-brand-gold-pale mx-2">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex items-center justify-center h-[70px]">
            {!loadingEmpresa && (
              empresa?.logo && !logoError ? (
                <img
                  src={getLogoUrl() || ''}
                  alt="Logo"
                  className="max-w-[200px] max-h-[70px] object-contain"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="w-16 h-16 bg-brand-gold rounded-xl flex items-center justify-center">
                  <Package className="w-8 h-8 text-brand-black" />
                </div>
              )
            )}
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-brand-black">
              {empresa?.nombre || "ZAS BY JMC CORP"}
            </CardTitle>
            <CardDescription className="text-brand-black/60">
              Ingresa a tu cuenta para continuar
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                <Link href="/olvide-contrasena" className="text-xs text-brand-gold hover:text-brand-gold-hover">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ingresando...
                </>
              ) : (
                "Ingresar"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

