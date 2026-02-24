"use client";

import { useAuth } from "@/contexts/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Loader2, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const PUBLIC_ROUTES = ["/login", "/registro", "/olvide-contrasena", "/reset-password"];

export function AuthenticatedLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  const { isAuthenticated, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  // Cerrar menú móvil cuando cambia la ruta
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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
      {/* Sidebar Desktop - oculto en móvil, sticky para que siga el scroll */}
      <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen">
        <Sidebar />
      </div>

      {/* Contenido principal */}
      <main className="flex-1 overflow-auto">
        {/* Header móvil con menú hamburguesa */}
        <div className="lg:hidden sticky top-0 z-40 bg-[#0C0A04] px-4 py-3 flex items-center justify-between">
          <Link href="/" className="block">
            <h1 className="text-xl font-bold cursor-pointer hover:opacity-80 transition-opacity">
              <span className="text-[#F3B450]">ZAS</span>
              <span className="text-gray-400 text-sm ml-2">by JMC</span>
            </h1>
          </Link>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-[#0C0A04] border-none overflow-hidden">
              <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
              <Sidebar isMobile onNavigate={() => setMobileMenuOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
        {children}
      </main>
    </div>
  );
}

