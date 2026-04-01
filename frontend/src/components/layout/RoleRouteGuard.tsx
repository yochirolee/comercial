"use client";

import { useAuth } from "@/contexts/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

/** Rutas permitidas para el rol `operador` (coincidencia exacta con pathname de Next). */
const OPERADOR_ALLOWED = [/^\/$/, /^\/operations$/, /^\/operations\/[^/]+$/, /^\/settings$/];

function isOperadorPathAllowed(pathname: string): boolean {
  return OPERADOR_ALLOWED.some((re) => re.test(pathname));
}

export function RoleRouteGuard({ children }: { children: React.ReactNode }): React.ReactElement {
  const { usuario, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (usuario?.rol?.toLowerCase() !== "operador") return;
    if (!isOperadorPathAllowed(pathname)) {
      router.replace("/");
    }
  }, [usuario?.rol, pathname, loading, router]);

  if (loading) {
    return <>{children}</>;
  }

  if (usuario?.rol?.toLowerCase() === "operador" && !isOperadorPathAllowed(pathname)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-brand-gold" />
        <p className="text-sm text-slate-600">Redirigiendo…</p>
      </div>
    );
  }

  return <>{children}</>;
}
