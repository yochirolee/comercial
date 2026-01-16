"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";
import { Package, Loader2, ArrowLeft, CheckCircle, XCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

function ResetPasswordContent(): React.ReactElement {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (token) {
      verifyToken(token);
    } else {
      setVerifying(false);
    }
  }, [token]);

  async function verifyToken(tokenToVerify: string): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/auth/verify-reset-token/${tokenToVerify}`);
      const data = await response.json();
      setTokenValid(data.valid === true);
    } catch {
      setTokenValid(false);
    } finally {
      setVerifying(false);
    }
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al restablecer contraseña");
      }

      setSuccess(true);
      toast.success("¡Contraseña actualizada!");
      
      // Redirigir al login después de 3 segundos
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al restablecer contraseña");
    } finally {
      setLoading(false);
    }
  }

  // Verificando token
  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-gold-pale via-white to-brand-gold-pale/50 p-4">
        <Card className="w-full max-w-md shadow-xl border-brand-gold-pale">
          <CardContent className="py-12">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-brand-gold mx-auto" />
              <p className="mt-4 text-brand-black/60">Verificando enlace...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Token inválido o no proporcionado
  if (!token || !tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-gold-pale via-white to-brand-gold-pale/50 p-4">
        <Card className="w-full max-w-md shadow-xl border-brand-gold-pale">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-brand-black">Enlace inválido</CardTitle>
              <CardDescription className="text-brand-black/60">
                Este enlace ha expirado o ya fue utilizado. Solicita uno nuevo.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <Link href="/olvide-contrasena">
                <Button className="w-full">Solicitar nuevo enlace</Button>
              </Link>
              <Link href="/login">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver al inicio de sesión
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Éxito
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-gold-pale via-white to-brand-gold-pale/50 p-4">
        <Card className="w-full max-w-md shadow-xl border-brand-gold-pale">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-brand-black">¡Contraseña actualizada!</CardTitle>
              <CardDescription className="text-brand-black/60">
                Tu contraseña ha sido restablecida exitosamente. Serás redirigido al inicio de sesión...
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full">Ir al inicio de sesión</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Formulario
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-gold-pale via-white to-brand-gold-pale/50 p-4">
      <Card className="w-full max-w-md shadow-xl border-brand-gold-pale">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-brand-gold rounded-xl flex items-center justify-center">
            <Package className="w-8 h-8 text-brand-black" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-brand-black">Nueva contraseña</CardTitle>
            <CardDescription className="text-brand-black/60">
              Ingresa tu nueva contraseña
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nueva contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repite tu contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Restablecer contraseña"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage(): React.ReactElement {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-gold-pale via-white to-brand-gold-pale/50 p-4">
        <Loader2 className="w-12 h-12 animate-spin text-brand-gold" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}

