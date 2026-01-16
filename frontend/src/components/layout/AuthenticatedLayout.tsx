"use client";

import { useAuth } from "@/contexts/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Loader2 } from "lucide-react";

const PUBLIC_ROUTES = ["/login", "/registro", "/olvide-contrasena", "/reset-password"];

export function AuthenticatedLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  const { isAuthenticated, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated && !isPublicRoute) {
        router.push("/login");
      } else if (isAuthenticated && isPublicRoute) {
        router.push("/");
      }
    }
  }, [isAuthenticated, loading, isPublicRoute, router]);

  // Mostrar loading mientras se verifica la autenticación
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-gold-pale/30">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-brand-gold mx-auto" />
          <p className="mt-4 text-brand-black/60">Cargando...</p>
        </div>
      </div>
    );
  }

  // Rutas públicas (login, registro) - sin sidebar
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Rutas protegidas - con sidebar
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-gold-pale/30">
        <Loader2 className="w-12 h-12 animate-spin text-brand-gold" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

