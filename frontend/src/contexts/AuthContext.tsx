"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

interface Usuario {
  id: string;
  nombre: string;
  apellidos: string;
  telefono?: string;
  email: string;
  rol: string;
  activo: boolean;
}

interface AuthContextType {
  usuario: Usuario | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
}

interface RegisterData {
  nombre: string;
  apellidos: string;
  telefono?: string;
  email: string;
  password: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Verificar si hay token guardado al cargar
    const storedToken = localStorage.getItem("zas_token");
    const storedUser = localStorage.getItem("zas_user");

    if (storedToken && storedUser) {
      setToken(storedToken);
      const userData = JSON.parse(storedUser);
      // Asegurar que el rol tenga un valor por defecto
      if (!userData.rol) {
        userData.rol = 'comercial';
      }
      setUsuario(userData);
      // Verificar que el token siga siendo válido
      verifyToken(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  async function verifyToken(tokenToVerify: string): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${tokenToVerify}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        // Asegurar que el rol tenga un valor por defecto
        if (!userData.rol) {
          userData.rol = 'comercial';
        }
        setUsuario(userData);
        localStorage.setItem("zas_user", JSON.stringify(userData));
      } else {
        // Token inválido, limpiar
        logout();
      }
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string): Promise<void> {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al iniciar sesión");
    }

    const data = await response.json();
    
    // Asegurar que el rol tenga un valor por defecto
    if (!data.usuario.rol) {
      data.usuario.rol = 'comercial';
    }
    
    setToken(data.token);
    setUsuario(data.usuario);
    localStorage.setItem("zas_token", data.token);
    localStorage.setItem("zas_user", JSON.stringify(data.usuario));
    
    router.push("/");
  }

  async function register(registerData: RegisterData): Promise<void> {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registerData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al registrarse");
    }

    const data = await response.json();
    
    // Asegurar que el rol tenga un valor por defecto
    if (!data.usuario.rol) {
      data.usuario.rol = 'comercial';
    }
    
    setToken(data.token);
    setUsuario(data.usuario);
    localStorage.setItem("zas_token", data.token);
    localStorage.setItem("zas_user", JSON.stringify(data.usuario));
    
    router.push("/");
  }

  function logout(): void {
    setToken(null);
    setUsuario(null);
    localStorage.removeItem("zas_token");
    localStorage.removeItem("zas_user");
    router.push("/login");
  }

  async function refreshUser(): Promise<void> {
    const storedToken = localStorage.getItem("zas_token");
    if (storedToken) {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          // Asegurar que el rol tenga un valor por defecto y esté normalizado
          if (!userData.rol) {
            userData.rol = 'comercial';
          } else {
            userData.rol = userData.rol.trim().toLowerCase();
          }
          setUsuario(userData);
          localStorage.setItem("zas_user", JSON.stringify(userData));
        }
      } catch (error) {
        console.error("Error al refrescar usuario:", error);
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        usuario,
        token,
        loading,
        login,
        register,
        logout,
        refreshUser,
        isAuthenticated: !!token && !!usuario,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  }
  return context;
}

