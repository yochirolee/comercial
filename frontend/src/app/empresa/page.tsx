"use client";

import { useEffect, useState, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Save, Building2, Upload, Image, Signature, Stamp, X } from "lucide-react";
import { empresaApi } from "@/lib/api";
import type { EmpresaInput } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function EmpresaPage(): JSX.Element {
  const [empresa, setEmpresa] = useState<EmpresaInput>({
    nombre: "",
    direccion: "",
    telefono: "",
    email: "",
    nit: "",
    representante: "",
    cargoRepresentante: "",
    codigoMincex: "",
    logo: "",
    firmaPresidente: "",
    cunoEmpresa: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const firmaInputRef = useRef<HTMLInputElement>(null);
  const cunoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadEmpresa(): Promise<void> {
      try {
        const data = await empresaApi.get();
        if (data) {
          setEmpresa({
            nombre: data.nombre || "",
            direccion: data.direccion || "",
            telefono: data.telefono || "",
            email: data.email || "",
            nit: data.nit || "",
            representante: data.representante || "",
            cargoRepresentante: data.cargoRepresentante || "",
            codigoMincex: data.codigoMincex || "",
            logo: data.logo || "",
            firmaPresidente: data.firmaPresidente || "",
            cunoEmpresa: data.cunoEmpresa || "",
          });
        }
      } catch (error) {
        console.error("Error loading empresa:", error);
      } finally {
        setLoading(false);
      }
    }

    loadEmpresa();
  }, []);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);

    try {
      await empresaApi.upsert(empresa);
      toast.success("Información guardada correctamente");
    } catch (error) {
      toast.error("Error al guardar la información");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const { name, value } = e.target;
    setEmpresa((prev) => ({ ...prev, [name]: value }));
  }

  async function handleImageUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    tipo: 'logo' | 'firma' | 'cuno',
    campo: 'logo' | 'firmaPresidente' | 'cunoEmpresa'
  ): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(tipo);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch(`${API_URL}/api/upload/${tipo}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Error al subir imagen');
      }

      const data = await response.json();
      setEmpresa((prev) => ({ ...prev, [campo]: data.path }));
      toast.success('Imagen subida correctamente');
    } catch (error) {
      toast.error('Error al subir la imagen');
      console.error(error);
    } finally {
      setUploading(null);
    }
  }

  function clearImage(campo: 'logo' | 'firmaPresidente' | 'cunoEmpresa'): void {
    setEmpresa((prev) => ({ ...prev, [campo]: "" }));
  }

  function getImageUrl(path: string | undefined): string {
    if (!path) return '';
    return `${API_URL}/uploads/${path}`;
  }

  if (loading) {
    return (
      <div>
        <Header title="Empresa" description="Información de tu empresa" />
        <div className="p-8">
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header 
        title="Empresa" 
        description="Configura la información de tu empresa"
      />
      
      <div className="p-8 space-y-6">
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Datos de la Empresa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre de la Empresa *</Label>
                  <Input
                    id="nombre"
                    name="nombre"
                    value={empresa.nombre}
                    onChange={handleChange}
                    placeholder="ZAS BY JMC CORP."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nit">NIT</Label>
                  <Input
                    id="nit"
                    name="nit"
                    value={empresa.nit}
                    onChange={handleChange}
                    placeholder="123456789-0"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="direccion">Dirección</Label>
                  <Input
                    id="direccion"
                    name="direccion"
                    value={empresa.direccion}
                    onChange={handleChange}
                    placeholder="123 Main Street, New Orleans, LA"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    name="telefono"
                    value={empresa.telefono}
                    onChange={handleChange}
                    placeholder="+1 234 567 890"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={empresa.email}
                    onChange={handleChange}
                    placeholder="info@zasbyjmc.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="representante">Representante Legal</Label>
                  <Input
                    id="representante"
                    name="representante"
                    value={empresa.representante}
                    onChange={handleChange}
                    placeholder="LIC. BORIS CABRERA"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cargoRepresentante">Cargo</Label>
                  <Input
                    id="cargoRepresentante"
                    name="cargoRepresentante"
                    value={empresa.cargoRepresentante}
                    onChange={handleChange}
                    placeholder="PRESIDENTE"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="codigoMincex">Código MINCEX</Label>
                  <Input
                    id="codigoMincex"
                    name="codigoMincex"
                    value={empresa.codigoMincex}
                    onChange={handleChange}
                    placeholder="US-0439"
                  />
                </div>
              </div>

              <Separator />

              {/* Sección de Imágenes */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Image className="h-5 w-5" />
                  Imágenes para Documentos
                </h3>
                <p className="text-sm text-slate-500">
                  Estas imágenes aparecerán en los PDF y Excel de ofertas y facturas
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Logo */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Logo de la Empresa
                    </Label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center min-h-[150px] flex flex-col items-center justify-center">
                      {empresa.logo ? (
                        <div className="relative">
                          <img 
                            src={getImageUrl(empresa.logo)} 
                            alt="Logo" 
                            className="max-h-24 max-w-full object-contain"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6"
                            onClick={() => clearImage('logo')}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-slate-400 mb-2" />
                          <p className="text-sm text-slate-500">Sin logo</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, 'logo', 'logo')}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={uploading === 'logo'}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {uploading === 'logo' ? 'Subiendo...' : 'Subir Logo'}
                    </Button>
                  </div>

                  {/* Firma del Presidente */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Signature className="h-4 w-4" />
                      Firma del Presidente
                    </Label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center min-h-[150px] flex flex-col items-center justify-center">
                      {empresa.firmaPresidente ? (
                        <div className="relative">
                          <img 
                            src={getImageUrl(empresa.firmaPresidente)} 
                            alt="Firma" 
                            className="max-h-24 max-w-full object-contain"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6"
                            onClick={() => clearImage('firmaPresidente')}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Signature className="h-8 w-8 text-slate-400 mb-2" />
                          <p className="text-sm text-slate-500">Sin firma</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={firmaInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, 'firma', 'firmaPresidente')}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={uploading === 'firma'}
                      onClick={() => firmaInputRef.current?.click()}
                    >
                      {uploading === 'firma' ? 'Subiendo...' : 'Subir Firma'}
                    </Button>
                  </div>

                  {/* Cuño/Sello */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Stamp className="h-4 w-4" />
                      Cuño/Sello de la Empresa
                    </Label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center min-h-[150px] flex flex-col items-center justify-center">
                      {empresa.cunoEmpresa ? (
                        <div className="relative">
                          <img 
                            src={getImageUrl(empresa.cunoEmpresa)} 
                            alt="Cuño" 
                            className="max-h-24 max-w-full object-contain"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6"
                            onClick={() => clearImage('cunoEmpresa')}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Stamp className="h-8 w-8 text-slate-400 mb-2" />
                          <p className="text-sm text-slate-500">Sin cuño</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={cunoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, 'cuno', 'cunoEmpresa')}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={uploading === 'cuno'}
                      onClick={() => cunoInputRef.current?.click()}
                    >
                      {uploading === 'cuno' ? 'Subiendo...' : 'Subir Cuño'}
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Guardando..." : "Guardar Todo"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
