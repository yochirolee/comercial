import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import fs from 'fs';
import path from 'path';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

export const DocumentoController = {
  async generateEndUserDocument(req: Request, res: Response): Promise<void> {
    try {
      const { ofertaClienteId } = req.params;

      if (!ofertaClienteId) {
        res.status(400).json({ error: 'ID de oferta es requerido' });
        return;
      }

      // Buscar la oferta con todos sus datos
      const oferta = await prisma.ofertaCliente.findUnique({
        where: { id: ofertaClienteId },
        include: {
          cliente: true,
          items: {
            include: {
              producto: {
                include: {
                  unidadMedida: true,
                },
              },
            },
          },
        },
      });

      if (!oferta) {
        res.status(404).json({ error: 'Oferta no encontrada' });
        return;
      }

      // Cargar la plantilla
      const templatePath = path.join(process.cwd(), 'templates', 'enduser_enduse_template.docx');
      
      console.log('Buscando plantilla en:', templatePath);
      console.log('Directorio actual:', process.cwd());
      
      if (!fs.existsSync(templatePath)) {
        console.error('Plantilla no encontrada en:', templatePath);
        // Intentar rutas alternativas
        const altPath1 = path.join(__dirname, '..', '..', 'templates', 'enduser_enduse_template.docx');
        const altPath2 = path.join(process.cwd(), 'backend', 'templates', 'enduser_enduse_template.docx');
        console.log('Rutas alternativas:', altPath1, altPath2);
        res.status(404).json({ 
          error: 'Plantilla no encontrada',
          searchedPath: templatePath 
        });
        return;
      }

      // Leer el archivo como buffer
      let content: Buffer;
      try {
        content = fs.readFileSync(templatePath);
      } catch (error) {
        console.error('Error al leer plantilla:', error);
        res.status(500).json({ error: 'Error al leer la plantilla' });
        return;
      }

      let zip: PizZip;
      let doc: Docxtemplater;
      try {
        zip = new PizZip(content);
        // Usar delimiters personalizados que Word no divide: [[variable]]
        // Esto evita el problema de tags divididos entre elementos XML
        doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          delimiters: {
            start: '[[',
            end: ']]',
          },
          nullGetter: (part: any) => {
            // Si una variable no existe, devolver string vacío en lugar de null
            return '';
          },
        });
      } catch (error) {
        console.error('Error al inicializar Docxtemplater:', error);
        if (error && typeof error === 'object' && 'properties' in error) {
          const props = (error as any).properties;
          if (props.errors && Array.isArray(props.errors)) {
            console.error('Errores en la plantilla:');
            props.errors.forEach((err: any, idx: number) => {
              console.error(`Error ${idx + 1}:`, err.message, err.properties);
            });
          }
        }
        res.status(500).json({ 
          error: 'Error al procesar la plantilla', 
          details: error instanceof Error ? error.message : 'Error desconocido',
          hint: 'La plantilla debe usar delimiters [[variable]] en lugar de {{variable}} para evitar que Word divida los tags entre elementos XML'
        });
        return;
      }

      // Preparar datos para reemplazar en la plantilla
      const fechaActual = new Date();
      // Formatear fecha como DD/MM/YYYY con ceros a la izquierda
      const dia = String(fechaActual.getDate()).padStart(2, '0');
      const mes = String(fechaActual.getMonth() + 1).padStart(2, '0');
      const año = fechaActual.getFullYear();
      const fechaActualES = `${dia}/${mes}/${año}`;
      const fechaActualEN = fechaActual.toLocaleDateString('en-US');
      
      // Construir nombre completo con apellidos si existen
      const nombreCompleto = oferta.cliente.apellidos 
        ? `${oferta.cliente.nombre || ''} ${oferta.cliente.apellidos}`.trim()
        : (oferta.cliente.nombre || '');
      
      const data = {
        // Datos del cliente (español)
        nombre_cliente: nombreCompleto, // Nombre completo con apellidos si tiene
        apellidos_cliente: oferta.cliente.apellidos || '',
        nombre_compania: oferta.cliente.nombreCompania || '',
        nombre_entidad: oferta.cliente.nombreCompania || '', // Alias para "Nombre entidad"
        nit_cliente: oferta.cliente.nit || '',
        identificacion: oferta.cliente.nit || '', // Alias para "identificacion" (NIT)
        identificacion_cliente: oferta.cliente.nit || '', // NIT del cliente
        direccion_cliente: oferta.cliente.direccion || '',
        telefono_cliente: oferta.cliente.telefono || '',
        email_cliente: oferta.cliente.email || '',
        
        // Datos del cliente (inglés)
        client_name: nombreCompleto, // Nombre completo con apellidos si tiene
        client_lastname: oferta.cliente.apellidos || '',
        company_name: oferta.cliente.nombreCompania || '',
        entity_name: oferta.cliente.nombreCompania || '',
        client_nit: oferta.cliente.nit || '',
        identification: oferta.cliente.nit || '',
        client_identification: oferta.cliente.nit || '', // NIT del cliente en inglés
        client_address: oferta.cliente.direccion || '',
        direccion_cliente_en: oferta.cliente.direccion || '', // Dirección en inglés (alias)
        client_phone: oferta.cliente.telefono || '',
        client_email: oferta.cliente.email || '',
        
        // Datos de la oferta (español)
        numero_oferta: oferta.numero || '',
        fecha: fechaActualES, // Fecha actual con formato DD/MM/YYYY
        fecha_actual: fechaActualES, // Fecha actual con formato DD/MM/YYYY
        vigencia_hasta: oferta.vigenciaHasta ? new Date(oferta.vigenciaHasta).toLocaleDateString('es-ES') : '',
        codigo_mincex: oferta.codigoMincex || '',
        puerto_embarque: oferta.puertoEmbarque || '',
        origen: oferta.origen || '',
        moneda: oferta.moneda || '',
        terminos_pago: oferta.terminosPago || '',
        observaciones: oferta.observaciones || '',
        total: oferta.total?.toLocaleString('es-ES', { style: 'currency', currency: 'USD' }) || '0.00',
        
        // Datos de la oferta (inglés)
        offer_number: oferta.numero || '',
        date: oferta.fecha ? new Date(oferta.fecha).toLocaleDateString('en-US') : '',
        current_date: fechaActualEN, // Fecha actual en inglés
        valid_until: oferta.vigenciaHasta ? new Date(oferta.vigenciaHasta).toLocaleDateString('en-US') : '',
        mincex_code: oferta.codigoMincex || '',
        port_of_loading: oferta.puertoEmbarque || '',
        origin: oferta.origen || '',
        currency: oferta.moneda || '',
        payment_terms: oferta.terminosPago || '',
        observations: oferta.observaciones || '',
        total_amount: oferta.total?.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) || '0.00',
        
        // Items de la oferta (español)
        items: oferta.items.map((item, index) => ({
          item_numero: index + 1,
          producto_nombre: item.producto.nombre || '',
          cantidad: (item.pesoNeto || item.cantidad)?.toLocaleString('es-ES') || '0',
          unidad_medida: item.producto.unidadMedida.abreviatura || '',
          precio_unitario: item.precioUnitario?.toLocaleString('es-ES', { style: 'currency', currency: 'USD' }) || '0.00',
          subtotal: item.subtotal?.toLocaleString('es-ES', { style: 'currency', currency: 'USD' }) || '0.00',
          codigo_arancelario: item.codigoArancelario || '',
          cantidad_cajas: item.cantidadCajas?.toString() || '',
          cantidad_sacos: item.cantidadSacos?.toString() || '',
          peso_neto: item.pesoNeto?.toLocaleString('es-ES') || '',
          peso_bruto: item.pesoBruto?.toLocaleString('es-ES') || '',
        })),
        
        // Items de la oferta (inglés)
        items_en: oferta.items.map((item, index) => ({
          item_number: index + 1,
          product_name: item.producto.nombre || '',
          quantity: (item.pesoNeto || item.cantidad)?.toLocaleString('en-US') || '0',
          unit_of_measure: item.producto.unidadMedida.abreviatura || '',
          unit_price: item.precioUnitario?.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) || '0.00',
          subtotal_amount: item.subtotal?.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) || '0.00',
          tariff_code: item.codigoArancelario || '',
          boxes_quantity: item.cantidadCajas?.toString() || '',
          bags_quantity: item.cantidadSacos?.toString() || '',
          net_weight: item.pesoNeto?.toLocaleString('en-US') || '',
          gross_weight: item.pesoBruto?.toLocaleString('en-US') || '',
        })),
      };

      // Reemplazar variables en la plantilla
      try {
        doc.render(data);
      } catch (error: any) {
        console.error('Error al renderizar plantilla:', error);
        console.error('Error properties:', error.properties);
        console.error('Error name:', error.name);
        res.status(500).json({ 
          error: 'Error al procesar la plantilla',
          details: error.message || 'Error desconocido',
          properties: error.properties || null
        });
        return;
      }

      // Generar el buffer del documento
      let buf: Buffer;
      try {
        buf = doc.getZip().generate({
          type: 'nodebuffer',
          compression: 'DEFLATE',
        });
      } catch (error) {
        console.error('Error al generar buffer:', error);
        res.status(500).json({ error: 'Error al generar el documento', details: error instanceof Error ? error.message : 'Error desconocido' });
        return;
      }

      // Configurar headers para descarga
      const safeFileName = `Oferta_${oferta.numero}.docx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
      res.setHeader('Content-Length', buf.length.toString());

      // Enviar el archivo
      res.send(buf);
    } catch (error) {
      console.error('Error al generar documento:', error);
      res.status(500).json({ 
        error: 'Error al generar el documento',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  },

  async generateCierreExpedienteDocument(req: Request, res: Response): Promise<void> {
    try {
      const { ofertaClienteId } = req.params;

      if (!ofertaClienteId) {
        res.status(400).json({ error: 'ID de oferta es requerido' });
        return;
      }

      // Buscar la oferta con todos sus datos
      const oferta = await prisma.ofertaCliente.findUnique({
        where: { id: ofertaClienteId },
        include: {
          cliente: true,
        },
      });

      if (!oferta) {
        res.status(404).json({ error: 'Oferta no encontrada' });
        return;
      }

      // Cargar la plantilla
      const templatePath = path.join(process.cwd(), 'templates', 'cierre_expediente_template.docx');
      
      console.log('Buscando plantilla en:', templatePath);
      
      if (!fs.existsSync(templatePath)) {
        console.error('Plantilla no encontrada en:', templatePath);
        res.status(404).json({ 
          error: 'Plantilla no encontrada',
          searchedPath: templatePath 
        });
        return;
      }

      // Leer el archivo como buffer
      let content: Buffer;
      try {
        content = fs.readFileSync(templatePath);
      } catch (error) {
        console.error('Error al leer plantilla:', error);
        res.status(500).json({ error: 'Error al leer la plantilla', details: error instanceof Error ? error.message : 'Error desconocido' });
        return;
      }

      let zip: PizZip;
      let doc: Docxtemplater;
      try {
        zip = new PizZip(content);
        doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          delimiters: {
            start: '[[',
            end: ']]',
          },
          nullGetter: (part: any) => {
            return '';
          },
        });
      } catch (error) {
        console.error('Error al inicializar Docxtemplater:', error);
        if (error && typeof error === 'object' && 'properties' in error) {
          const props = (error as any).properties;
          if (props.errors && Array.isArray(props.errors)) {
            console.error('Errores en la plantilla:');
            props.errors.forEach((err: any, idx: number) => {
              console.error(`Error ${idx + 1}:`, err.message, err.properties);
            });
          }
        }
        res.status(500).json({ 
          error: 'Error al procesar la plantilla', 
          details: error instanceof Error ? error.message : 'Error desconocido',
          hint: 'La plantilla debe usar delimiters [[variable]] en lugar de {{variable}} para evitar que Word divida los tags entre elementos XML'
        });
        return;
      }

      // Preparar datos para reemplazar en la plantilla
      const fechaActual = new Date();
      // Formatear fecha como DD/MM/YYYY con ceros a la izquierda
      const dia = String(fechaActual.getDate()).padStart(2, '0');
      const mes = String(fechaActual.getMonth() + 1).padStart(2, '0');
      const año = fechaActual.getFullYear();
      const fechaActualES = `${dia}/${mes}/${año}`;
      
      // Construir nombre completo con apellidos si existen
      const nombreCompleto = oferta.cliente.apellidos 
        ? `${oferta.cliente.nombre || ''} ${oferta.cliente.apellidos}`.trim()
        : (oferta.cliente.nombre || '');

      const data = {
        fecha: fechaActualES,
        numero_oferta: oferta.numero || '',
        nombre_cliente: nombreCompleto,
      };

      // Reemplazar variables en la plantilla
      try {
        doc.render(data);
      } catch (error: any) {
        console.error('Error al renderizar plantilla:', error);
        console.error('Error properties:', error.properties);
        res.status(500).json({ 
          error: 'Error al procesar la plantilla',
          details: error.message || 'Error desconocido',
          properties: error.properties || null
        });
        return;
      }

      // Generar el buffer del documento
      let buf: Buffer;
      try {
        buf = doc.getZip().generate({
          type: 'nodebuffer',
          compression: 'DEFLATE',
        });
      } catch (error) {
        console.error('Error al generar buffer:', error);
        res.status(500).json({ error: 'Error al generar el documento', details: error instanceof Error ? error.message : 'Error desconocido' });
        return;
      }

      // Configurar headers para descarga
      const safeFileName = `Cierre_Expediente_${oferta.numero}.docx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
      res.setHeader('Content-Length', buf.length.toString());

      // Enviar el archivo
      res.send(buf);
    } catch (error) {
      console.error('Error al generar documento:', error);
      res.status(500).json({ 
        error: 'Error al generar el documento',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  },

  async generateChecklistDocument(req: Request, res: Response): Promise<void> {
    try {
      const { ofertaClienteId } = req.params;

      if (!ofertaClienteId) {
        res.status(400).json({ error: 'ID de oferta es requerido' });
        return;
      }

      // Buscar la oferta con todos sus datos
      const oferta = await prisma.ofertaCliente.findUnique({
        where: { id: ofertaClienteId },
        include: {
          cliente: true,
          items: {
            include: {
              producto: true,
            },
          },
        },
      });

      if (!oferta) {
        res.status(404).json({ error: 'Oferta no encontrada' });
        return;
      }

      // Cargar la plantilla
      const templatePath = path.join(process.cwd(), 'templates', 'checklist_template.docx');
      
      console.log('Buscando plantilla en:', templatePath);
      
      if (!fs.existsSync(templatePath)) {
        console.error('Plantilla no encontrada en:', templatePath);
        res.status(404).json({ 
          error: 'Plantilla no encontrada',
          searchedPath: templatePath 
        });
        return;
      }

      // Leer el archivo como buffer
      let content: Buffer;
      try {
        content = fs.readFileSync(templatePath);
      } catch (error) {
        console.error('Error al leer plantilla:', error);
        res.status(500).json({ error: 'Error al leer la plantilla', details: error instanceof Error ? error.message : 'Error desconocido' });
        return;
      }

      let zip: PizZip;
      let doc: Docxtemplater;
      try {
        zip = new PizZip(content);
        doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          delimiters: {
            start: '[[',
            end: ']]',
          },
          nullGetter: (part: any) => {
            return '';
          },
        });
      } catch (error) {
        console.error('Error al inicializar Docxtemplater:', error);
        if (error && typeof error === 'object' && 'properties' in error) {
          const props = (error as any).properties;
          if (props.errors && Array.isArray(props.errors)) {
            console.error('Errores en la plantilla:');
            props.errors.forEach((err: any, idx: number) => {
              console.error(`Error ${idx + 1}:`, err.message, err.properties);
            });
          }
        }
        res.status(500).json({ 
          error: 'Error al procesar la plantilla', 
          details: error instanceof Error ? error.message : 'Error desconocido',
          hint: 'La plantilla debe usar delimiters [[variable]] en lugar de {{variable}} para evitar que Word divida los tags entre elementos XML'
        });
        return;
      }

      // Preparar datos para reemplazar en la plantilla
      const fechaActual = new Date();
      // Formatear fecha como DD/MM/YYYY con ceros a la izquierda
      const dia = String(fechaActual.getDate()).padStart(2, '0');
      const mes = String(fechaActual.getMonth() + 1).padStart(2, '0');
      const año = fechaActual.getFullYear();
      const fechaActualES = `${dia}/${mes}/${año}`;
      
      // Construir nombre completo con apellidos si existen
      const nombreCompleto = oferta.cliente.apellidos 
        ? `${oferta.cliente.nombre || ''} ${oferta.cliente.apellidos}`.trim()
        : (oferta.cliente.nombre || '');

      // Obtener información de todos los productos
      const productos = oferta.items && oferta.items.length > 0 
        ? oferta.items.map(item => item.producto).filter(p => p !== null)
        : [];
      
      // Concatenar nombres de productos (separados por comas)
      const nombresProductos = productos
        .map(p => p.nombre || '')
        .filter(n => n !== '')
        .join(', ');
      
      // Concatenar descripciones de productos (separadas por comas)
      const descripcionesProductos = productos
        .map(p => p.descripcion || '')
        .filter(d => d !== '')
        .join(', ');

      const data = {
        fecha: fechaActualES,
        numero_oferta: oferta.numero || '',
        nombre_cliente: nombreCompleto,
        direccion_cliente: oferta.cliente.direccion || '',
        identificacion_cliente: oferta.cliente.nit || '',
        nombre_entidad: oferta.cliente.nombreCompania || '',
        nombre_producto: nombresProductos,
        descripcion_producto: descripcionesProductos,
      };

      // Reemplazar variables en la plantilla
      try {
        doc.render(data);
      } catch (error: any) {
        console.error('Error al renderizar plantilla:', error);
        console.error('Error properties:', error.properties);
        res.status(500).json({ 
          error: 'Error al procesar la plantilla',
          details: error.message || 'Error desconocido',
          properties: error.properties || null
        });
        return;
      }

      // Generar el buffer del documento
      let buf: Buffer;
      try {
        buf = doc.getZip().generate({
          type: 'nodebuffer',
          compression: 'DEFLATE',
        });
      } catch (error) {
        console.error('Error al generar buffer:', error);
        res.status(500).json({ error: 'Error al generar el documento', details: error instanceof Error ? error.message : 'Error desconocido' });
        return;
      }

      // Configurar headers para descarga
      const safeFileName = `Checklist_${oferta.numero}.docx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
      res.setHeader('Content-Length', buf.length.toString());

      // Enviar el archivo
      res.send(buf);
    } catch (error) {
      console.error('Error al generar documento:', error);
      res.status(500).json({ 
        error: 'Error al generar el documento',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  },

  async generateSalesAgreementDocument(req: Request, res: Response): Promise<void> {
    try {
      const { ofertaClienteId } = req.params;

      if (!ofertaClienteId) {
        res.status(400).json({ error: 'ID de oferta cliente es requerido' });
        return;
      }

      // Buscar la oferta cliente con sus datos
      const ofertaCliente = await prisma.ofertaCliente.findUnique({
        where: { id: ofertaClienteId },
        include: {
          cliente: true,
        },
      });

      if (!ofertaCliente) {
        res.status(404).json({ error: 'Oferta cliente no encontrada' });
        return;
      }

      // Buscar todas las facturas relacionadas a esta oferta
      // Pueden estar relacionadas directamente (tipoOfertaOrigen: 'cliente')
      // o a través de una oferta importadora (tipoOfertaOrigen: 'importadora')
      
      // Primero buscar facturas directamente relacionadas
      const facturasDirectas = await prisma.factura.findMany({
        where: {
          tipoOfertaOrigen: 'cliente',
          ofertaOrigenId: ofertaClienteId,
        },
        include: {
          importadora: true,
          items: {
            include: {
              producto: {
                include: {
                  unidadMedida: true,
                },
              },
            },
          },
        },
      });

      // Buscar ofertas importadoras relacionadas a esta oferta cliente
      const ofertasImportadoras = await prisma.ofertaImportadora.findMany({
        where: {
          ofertaClienteId: ofertaClienteId,
        },
        select: {
          id: true,
        },
      });

      const ofertasImportadorasIds = ofertasImportadoras.map(oi => oi.id);

      // Buscar facturas relacionadas a través de ofertas importadoras
      const facturasPorImportadora = ofertasImportadorasIds.length > 0
        ? await prisma.factura.findMany({
            where: {
              tipoOfertaOrigen: 'importadora',
              ofertaOrigenId: {
                in: ofertasImportadorasIds,
              },
            },
            include: {
              importadora: true,
              items: {
                include: {
                  producto: {
                    include: {
                      unidadMedida: true,
                    },
                  },
                },
              },
            },
          })
        : [];

      // Combinar ambas listas y eliminar duplicados
      const todasLasFacturas = [...facturasDirectas, ...facturasPorImportadora];
      const facturasUnicas = Array.from(
        new Map(todasLasFacturas.map(f => [f.id, f])).values()
      );

      // Ordenar por fecha
      const facturas = facturasUnicas.sort((a, b) => 
        new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
      );

      if (!facturas || facturas.length === 0) {
        res.status(404).json({ error: 'No se encontraron facturas relacionadas a esta oferta' });
        return;
      }

      // Agrupar items por producto y sumar cantidades y pesos netos
      const itemsAgrupados = new Map<string, {
        producto: any;
        cantidadTotal: number;
        pesoNetoTotal: number;
        precioUnitario: number;
        usoPrevisto: string | null;
      }>();

      // Procesar todas las facturas
      for (const factura of facturas) {
        for (const item of factura.items) {
          const productoId = item.productoId;
          
          if (itemsAgrupados.has(productoId)) {
            const existente = itemsAgrupados.get(productoId)!;
            existente.cantidadTotal += item.cantidad || 0;
            existente.pesoNetoTotal += item.pesoNeto || 0;
            // Precio se mantiene igual (ya que será el mismo en todas las facturas)
            // Uso previsto se mantiene del primero encontrado
          } else {
            itemsAgrupados.set(productoId, {
              producto: item.producto,
              cantidadTotal: item.cantidad || 0,
              pesoNetoTotal: item.pesoNeto || 0,
              precioUnitario: item.precioUnitario || 0,
              usoPrevisto: item.producto.usoPrevisto || null,
            });
          }
        }
      }

      // Convertir el Map a array
      const itemsFinales = Array.from(itemsAgrupados.values());

      // Usar la primera factura para datos generales (puerto, etc.)
      const primeraFactura = facturas[0];

      // Cargar la plantilla
      const templatePath = path.join(process.cwd(), 'templates', 'Sales Agreement_template.docx');
      
      console.log('Buscando plantilla en:', templatePath);
      console.log('Directorio actual:', process.cwd());
      
      // Intentar rutas alternativas
      const altPath1 = path.join(__dirname, '..', '..', 'templates', 'Sales Agreement_template.docx');
      const altPath2 = path.join(process.cwd(), 'backend', 'templates', 'Sales Agreement_template.docx');
      
      let finalPath = templatePath;
      if (!fs.existsSync(templatePath)) {
        console.log('Plantilla no encontrada en ruta principal, intentando alternativas...');
        if (fs.existsSync(altPath1)) {
          finalPath = altPath1;
          console.log('Plantilla encontrada en:', altPath1);
        } else if (fs.existsSync(altPath2)) {
          finalPath = altPath2;
          console.log('Plantilla encontrada en:', altPath2);
        } else {
          console.error('Plantilla no encontrada en ninguna ruta');
          res.status(404).json({ 
            error: 'Plantilla no encontrada',
            searchedPath: templatePath,
            alternativePaths: [altPath1, altPath2]
          });
          return;
        }
      }

      // Leer el archivo como buffer
      let content: Buffer;
      try {
        content = fs.readFileSync(finalPath);
      } catch (error) {
        console.error('Error al leer plantilla:', error);
        res.status(500).json({ error: 'Error al leer la plantilla', details: error instanceof Error ? error.message : 'Error desconocido' });
        return;
      }

      let zip: PizZip;
      let doc: Docxtemplater;
      try {
        zip = new PizZip(content);
        doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          delimiters: {
            start: '[[',
            end: ']]',
          },
          nullGetter: (part: any) => {
            return '';
          },
        });
      } catch (error) {
        console.error('Error al inicializar Docxtemplater:', error);
        if (error && typeof error === 'object' && 'properties' in error) {
          const props = (error as any).properties;
          if (props.errors && Array.isArray(props.errors)) {
            console.error('Errores en la plantilla:');
            props.errors.forEach((err: any, idx: number) => {
              console.error(`Error ${idx + 1}:`, err.message, err.properties);
            });
          }
        }
        res.status(500).json({ 
          error: 'Error al procesar la plantilla', 
          details: error instanceof Error ? error.message : 'Error desconocido',
          hint: 'La plantilla debe usar delimiters [[variable]] en lugar de {{variable}} para evitar que Word divida los tags entre elementos XML'
        });
        return;
      }

      // Preparar datos para reemplazar en la plantilla
      const fechaActual = new Date();
      const dia = String(fechaActual.getDate()).padStart(2, '0');
      const mes = String(fechaActual.getMonth() + 1).padStart(2, '0');
      const año = fechaActual.getFullYear();
      const fechaActualES = `${dia}/${mes}/${año}`;
      
      // Construir nombre completo con apellidos si existen
      const nombreCompleto = ofertaCliente.cliente.apellidos 
        ? `${ofertaCliente.cliente.nombre || ''} ${ofertaCliente.cliente.apellidos}`.trim()
        : (ofertaCliente.cliente.nombre || '');

      // Variables de productos - usar items agrupados
      const nombresProductos = itemsFinales
        .map(item => item.producto.nombre || '')
        .filter(n => n !== '')
        .join(', ');
      
      const cantidades = itemsFinales
        .map(item => item.cantidadTotal.toString())
        .join(', ');
      
      const pesosNetos = itemsFinales
        .map(item => item.pesoNetoTotal.toString())
        .join(', ');
      
      const precios = itemsFinales
        .map(item => item.precioUnitario.toString())
        .join(', ');
      
      const usosPrevistos = itemsFinales
        .map(item => item.usoPrevisto || '')
        .filter(u => u !== '')
        .join(', ');

      // Calcular CFR Total: suma de todos los CFR de las facturas relacionadas
      // CFR = subtotal + flete + seguro
      const cfrTotal = facturas.reduce((total, factura) => {
        const cfrFactura = (factura.subtotal || 0) + (factura.flete || 0) + (factura.seguro || 0);
        return total + cfrFactura;
      }, 0);

      const data = {
        // Variables existentes del cliente
        fecha: fechaActualES,
        numero_oferta: ofertaCliente.numero || '',
        nombre_cliente: nombreCompleto,
        direccion_cliente: ofertaCliente.cliente.direccion || '',
        identificacion_cliente: ofertaCliente.cliente.nit || ofertaCliente.cliente.campoExtra1 || '',
        nombre_entidad: ofertaCliente.cliente.nombreCompania || '',
        
        // Variables nuevas de productos (agregadas de todas las facturas)
        nombre_producto: nombresProductos,
        cant: cantidades,
        peso_neto: pesosNetos,
        price: precios,
        uso_previsto: usosPrevistos,
        
        // Variables de puertos (de la primera factura)
        port_salida: primeraFactura.puertoEmbarque || '',
        port_entrada: 'Mariel',
        
        // CFR Total (suma de todos los CFR de las facturas)
        cfr_total: cfrTotal.toFixed(2),
      };

      // Reemplazar variables en la plantilla
      try {
        doc.render(data);
      } catch (error: any) {
        console.error('Error al renderizar plantilla:', error);
        console.error('Error properties:', error.properties);
        res.status(500).json({ 
          error: 'Error al procesar la plantilla',
          details: error.message || 'Error desconocido',
          properties: error.properties || null
        });
        return;
      }

      // Generar el buffer del documento
      let buf: Buffer;
      try {
        buf = doc.getZip().generate({
          type: 'nodebuffer',
          compression: 'DEFLATE',
        });
      } catch (error) {
        console.error('Error al generar buffer:', error);
        res.status(500).json({ error: 'Error al generar el documento', details: error instanceof Error ? error.message : 'Error desconocido' });
        return;
      }

      // Configurar headers para descarga
      const safeFileName = `Sales_Agreement_${ofertaCliente.numero}.docx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
      res.setHeader('Content-Length', buf.length.toString());

      // Enviar el archivo
      res.send(buf);
    } catch (error) {
      console.error('Error al generar documento:', error);
      res.status(500).json({ 
        error: 'Error al generar el documento',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  },
};
