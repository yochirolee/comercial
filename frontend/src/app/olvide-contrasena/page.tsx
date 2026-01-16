"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";
import { Package, Loader2, ArrowLeft, Mail, CheckCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export default function OlvideContrasenaPage(): React.ReactElement {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al enviar solicitud");
      }

      setSent(true);
      toast.success("Revisa tu correo electrónico");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al enviar solicitud");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-gold-pale via-white to-brand-gold-pale/50 p-4">
        <Card className="w-full max-w-md shadow-xl border-brand-gold-pale">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-brand-black">¡Correo enviado!</CardTitle>
              <CardDescription className="text-brand-black/60 mt-2">
                Si <strong>{email}</strong> está registrado, recibirás un correo con instrucciones para restablecer tu contraseña.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-brand-gold-pale/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-brand-gold mt-0.5" />
                <div className="text-sm text-brand-black/70">
                  <p className="font-medium">Revisa tu bandeja de entrada</p>
                  <p className="mt-1">El enlace expirará en 1 hora. Si no ves el correo, revisa tu carpeta de spam.</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button 
                variant="outline" 
                onClick={() => setSent(false)}
                className="w-full"
              >
                Enviar a otro correo
              </Button>
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-gold-pale via-white to-brand-gold-pale/50 p-4">
      <Card className="w-full max-w-md shadow-xl border-brand-gold-pale">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-brand-gold rounded-xl flex items-center justify-center">
            <Package className="w-8 h-8 text-brand-black" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-brand-black">¿Olvidaste tu contraseña?</CardTitle>
            <CardDescription className="text-brand-black/60">
              Ingresa tu correo y te enviaremos un enlace para restablecerla
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar enlace de recuperación"
              )}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm text-brand-gold hover:text-brand-gold-hover font-medium inline-flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio de sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

