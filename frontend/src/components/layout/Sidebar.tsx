"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  Building2,
  Users,
  Package,
  FileText,
  Receipt,
  Home,
  Ship,
  ClipboardList,
  LogOut,
  User,
  Settings,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Empresa", href: "/empresa", icon: Building2 },
  { name: "Clientes", href: "/clientes", icon: Users },
  { name: "Productos", href: "/productos", icon: Package },
  { 
    name: "Ofertas", 
    icon: FileText,
    children: [
      { name: "Lista de Precios", href: "/ofertas/generales", icon: ClipboardList },
      { name: "A Clientes", href: "/ofertas/cliente", icon: FileText },
      { name: "A Importadora", href: "/ofertas/importadora", icon: Ship },
    ]
  },
  { name: "Facturas", href: "/facturas", icon: Receipt },
  { name: "Configuración", href: "/settings", icon: Settings },
];

export function Sidebar(): React.ReactElement {
  const pathname = usePathname();
  const { usuario, logout } = useAuth();

  return (
    <aside className="w-64 bg-[#0C0A04] text-white min-h-screen flex flex-col">
      {/* Logo Header */}
      <div className="p-6 border-b border-white/10">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-[#F3B450]">ZAS</span>
          <span className="text-gray-400 text-sm ml-2">by JMC</span>
        </h1>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          if (item.children) {
            return (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center gap-3 px-3 py-2 text-gray-500 text-sm font-medium uppercase tracking-wider">
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </div>
                <div className="ml-4 space-y-1">
                  {item.children.map((child) => {
                    const isActive = pathname === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200",
                          isActive
                            ? "bg-[#F3B450] text-[#0C0A04] font-medium"
                            : "text-gray-400 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <child.icon className="h-4 w-4" />
                        {child.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          }

          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200",
                isActive
                  ? "bg-[#F3B450] text-[#0C0A04] font-medium"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-white/10 space-y-3">
        {usuario && (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-[#F3B450] flex items-center justify-center">
              <User className="w-4 h-4 text-[#0C0A04]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {usuario.nombre} {usuario.apellidos}
              </p>
              <p className="text-xs text-gray-500 truncate">{usuario.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all duration-200 w-full"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
        <p className="text-xs text-gray-600 text-center">
          © 2026 ZAS by JMC Corp.
        </p>
      </div>
    </aside>
  );
}
