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
  UserCog,
  FileCheck,
  MapPin,
  Search,
} from "lucide-react";

interface NavItem {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { name: string; href: string; icon: React.ComponentType<{ className?: string }>; adminOnly?: boolean }[];
  adminOnly?: boolean;
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Empresa", href: "/empresa", icon: Building2 },
  { name: "Clientes", href: "/clientes", icon: Users },
  { name: "Importadoras", href: "/importadoras", icon: Ship },
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
  { name: "Operations", href: "/operations", icon: MapPin },
  { name: "Buscar", href: "/importadoras/buscar", icon: Search },
  { name: "Documentación", href: "/documentacion", icon: FileCheck, adminOnly: true },
  { 
    name: "Configuración", 
    icon: Settings,
    children: [
      { name: "Mi Perfil", href: "/settings", icon: User },
      { name: "Usuarios", href: "/settings/usuarios", icon: UserCog, adminOnly: true },
    ]
  },
];

interface SidebarProps {
  onNavigate?: () => void;
  isMobile?: boolean;
}

export function Sidebar({ onNavigate, isMobile }: SidebarProps): React.ReactElement {
  const pathname = usePathname();
  const { usuario, logout } = useAuth();

  function handleLinkClick(): void {
    if (onNavigate) onNavigate();
  }

  return (
    <aside className={cn(
      "bg-[#0C0A04] text-white flex flex-col",
      isMobile ? "w-full h-full max-h-screen" : "w-64 h-screen"
    )}>
      {/* Logo Header */}
      <div className="p-6 border-b border-white/10 flex-shrink-0">
        <Link href="/" onClick={handleLinkClick} className="block">
          <h1 className="text-2xl font-bold tracking-tight cursor-pointer hover:opacity-80 transition-opacity">
            <span className="text-[#F3B450]">ZAS</span>
            <span className="text-gray-400 text-sm ml-2">by JMC</span>
          </h1>
        </Link>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          if (item.children) {
            // Filtrar children según permisos de admin
            const visibleChildren = item.children.filter(
              (child) => !child.adminOnly || usuario?.rol === "admin"
            );

            if (visibleChildren.length === 0) return null;

            return (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center gap-3 px-3 py-2 text-gray-500 text-sm font-medium uppercase tracking-wider">
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </div>
                <div className="ml-4 space-y-1">
                  {visibleChildren.map((child) => {
                    const isActive = pathname === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={handleLinkClick}
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

          // Filtrar items según permisos de admin
          if (item.adminOnly && usuario?.rol !== "admin") {
            return null;
          }

          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href!}
              onClick={handleLinkClick}
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
      <div className="p-4 border-t border-white/10 space-y-3 flex-shrink-0">
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
