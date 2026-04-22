import { Resend } from 'resend';

/** Remitente: dominio verificado en Resend, o onboarding@resend.dev solo para pruebas (destinatario limitado). */
const DEFAULT_FROM = 'ZAS by JMC <onboarding@resend.dev>';

function getFrontendBaseUrl(): string {
  const u = process.env.FRONTEND_URL?.trim();
  if (u) return u.replace(/\/$/, '');
  return 'http://localhost:3000';
}

function getFromAddress(): string {
  const raw = process.env.FROM_EMAIL?.trim();
  if (!raw) return DEFAULT_FROM;
  if (raw.includes('<')) return raw;
  return `ZAS by JMC <${raw}>`;
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

function formatResendError(error: unknown): string {
  if (error == null) return 'Error desconocido de Resend';
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export type SendPasswordResetResult = { ok: true } | { ok: false; reason: string };

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  nombre: string
): Promise<SendPasswordResetResult> {
  const resend = getResend();
  if (!resend) {
    const reason = 'RESEND_API_KEY no configurada en backend/.env';
    console.warn(`[email] ${reason}`);
    return { ok: false, reason };
  }

  const resetUrl = `${getFrontendBaseUrl()}/reset-password?token=${token}`;
  const from = getFromAddress();

  try {
    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: 'Recuperar contraseña - ZAS by JMC',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #F3B450; margin: 0;">ZAS by JMC Corp</h1>
          </div>
          
          <div style="background-color: #f9f9f9; padding: 30px; border-radius: 10px;">
            <h2 style="color: #0C0A04; margin-top: 0;">Hola ${nombre},</h2>
            
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
            
            <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #F3B450; color: #0C0A04; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                Restablecer contraseña
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              Este enlace expirará en <strong>1 hora</strong>.
            </p>
            
            <p style="color: #666; font-size: 14px;">
              Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña seguirá siendo la misma.
            </p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            
            <p style="color: #999; font-size: 12px;">
              Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
              <a href="${resetUrl}" style="color: #F3B450;">${resetUrl}</a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>© 2026 ZAS by JMC Corp. Todos los derechos reservados.</p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      const reason = formatResendError(error);
      console.error('[email] Resend rechazó el envío:', reason, error);
      return { ok: false, reason };
    }

    console.log('[email] Recuperación enviada a', email);
    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : formatResendError(error);
    console.error('[email] Excepción al enviar:', error);
    return { ok: false, reason };
  }
}

export type SendEmailResult = { ok: true } | { ok: false; reason: string };

/** Informe Excel del Operations Board (dos hojas: Comercial y Parcel). */
export async function sendOperationsBoardExcelEmail(
  to: string,
  excelBuffer: Buffer
): Promise<SendEmailResult> {
  const resend = getResend();
  if (!resend) {
    return { ok: false, reason: 'RESEND_API_KEY no configurada' };
  }

  const from = getFromAddress();
  const day = new Date().toISOString().split('T')[0];
  const filename = `operations_board_${day}.xlsx`;

  try {
    const { error } = await resend.emails.send({
      from,
      to,
      subject: 'Operaciones ZAS BY JMC',
      html: `<p>Adjunto listado de operaciones Comerciales y Gift Parcel actualizadas ${day}.</p><p>Saludos</p>`,
      text: `Adjunto listado de operaciones Comerciales y Gift Parcel actualizadas ${day}.\n\nSaludos`,
      attachments: [
        {
          filename,
          content: excelBuffer,
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
    });

    if (error) {
      const reason = formatResendError(error);
      console.error('[email] Resend rechazó informe operaciones:', reason, error);
      return { ok: false, reason };
    }

    console.log('[email] Operations board Excel enviado a', to);
    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : formatResendError(error);
    console.error('[email] Excepción al enviar informe operaciones:', error);
    return { ok: false, reason };
  }
}

// ─── Notificación de estado de operación al cliente ─────────────────────────

export interface OperationEmailData {
  operationNo: string;
  status: string;
  originPort?: string;
  destinationPort?: string;
  currentLocation?: string;
  notes?: string;
  referenciaOperacion?: string | null;
  logoEmpresa?: string | null;
  offerCustomer?: {
    numero: string;
    cliente: { nombre: string; apellidos?: string | null; nombreCompania?: string | null };
  };
  importadora?: { nombre: string };
  carrier?: { name: string };
  containers?: Array<{
    containerNo?: string;
    bookingNo?: string;
    blNo?: string;
    status: string;
    etdEstimated?: string | null;
    etaEstimated?: string | null;
    etaActual?: string | null;
    currentLocation?: string | null;
  }>;
}

function formatDateEs(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function clienteNombreEmail(c: { nombre: string; apellidos?: string | null; nombreCompania?: string | null }): string {
  return c.nombreCompania?.trim() || `${c.nombre} ${c.apellidos || ''}`.trim();
}

/** Notifica al cliente el estado actual de su operación comercial. */
export async function sendOperationStatusEmail(
  to: string,
  op: OperationEmailData
): Promise<SendEmailResult> {
  const resend = getResend();
  if (!resend) {
    return { ok: false, reason: 'RESEND_API_KEY no configurada' };
  }

  const from = getFromAddress();
  const clienteName = op.offerCustomer ? clienteNombreEmail(op.offerCustomer.cliente) : 'Cliente';

  const containersRows = (op.containers ?? [])
    .map(
      (c) => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;font-weight:600;color:#0C0A04;">${c.containerNo || c.blNo || '—'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#555;">${c.bookingNo || '—'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#555;">${c.blNo || '—'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#333;font-weight:500;">${c.status}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#555;">${formatDateEs(c.etdEstimated)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#555;">${formatDateEs(c.etaEstimated)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#555;">${formatDateEs(c.etaActual)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#555;">${c.currentLocation || '—'}</td>
        </tr>`
    )
    .join('');

  const notesHtml = ''; // Las notas se muestran dentro de la tabla de datos

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4;color:#333;">
  <div style="max-width:680px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">

    <!-- Header (table layout para compatibilidad con Gmail/Outlook) -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0C0A04;">
      <tr>
        ${op.logoEmpresa ? `<td style="padding:20px 0 20px 28px;width:1%;white-space:nowrap;vertical-align:middle;">
          <img src="${op.logoEmpresa}" alt="Logo" style="height:52px;width:auto;display:block;" />
        </td>` : ''}
        <td style="padding:20px 28px;vertical-align:middle;">
          <h1 style="margin:0;color:#F3B450;font-size:22px;letter-spacing:1px;font-family:Arial,sans-serif;">ZAS <span style="color:#888;font-size:14px;font-weight:normal;">by JMC Corp</span></h1>
          <p style="margin:4px 0 0;color:#aaa;font-size:13px;font-family:Arial,sans-serif;">Actualización de operación comercial</p>
        </td>
      </tr>
    </table>

    <!-- Body -->
    <div style="padding:28px 32px;">
      <p style="font-size:15px;margin-top:0;">Estimado/a <strong>${clienteName}</strong>,</p>
      <p style="font-size:14px;color:#555;margin-top:0;">Le informamos sobre el estado actual de su operación comercial.</p>

      <!-- Datos de la operación -->
      <div style="background:#f8f9fa;border-radius:8px;padding:16px 20px;margin:20px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:5px 0;font-size:12px;color:#888;width:140px;">Operación</td>
            <td style="padding:5px 0;font-size:14px;font-weight:700;color:#0C0A04;">${op.operationNo}</td>
          </tr>
          ${op.offerCustomer ? `<tr>
            <td style="padding:5px 0;font-size:12px;color:#888;">Oferta</td>
            <td style="padding:5px 0;font-size:13px;color:#333;">${op.offerCustomer.numero}</td>
          </tr>` : ''}
          <tr>
            <td style="padding:5px 0;font-size:12px;color:#888;">Estado</td>
            <td style="padding:5px 0;">
              <span style="display:inline-block;background:#F3B450;color:#0C0A04;font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;">${op.status}</span>
            </td>
          </tr>
          ${op.originPort || op.destinationPort ? `<tr>
            <td style="padding:5px 0;font-size:12px;color:#888;">Ruta</td>
            <td style="padding:5px 0;font-size:13px;color:#333;">${op.originPort || '—'} → ${op.destinationPort || '—'}</td>
          </tr>` : ''}
          ${op.notes && op.notes.trim().length > 0 ? `<tr>
            <td style="padding:5px 0;font-size:12px;color:#888;vertical-align:top;">Notas</td>
            <td style="padding:5px 0;font-size:13px;color:#333;white-space:pre-line;">${op.notes.trim()}</td>
          </tr>` : ''}
          ${op.carrier ? `<tr>
            <td style="padding:5px 0;font-size:12px;color:#888;">Carrier</td>
            <td style="padding:5px 0;font-size:13px;color:#333;">${op.carrier.name}</td>
          </tr>` : ''}
          ${op.importadora ? `<tr>
            <td style="padding:5px 0;font-size:12px;color:#888;">Importadora</td>
            <td style="padding:5px 0;font-size:13px;color:#333;">${op.importadora.nombre}</td>
          </tr>` : ''}
          ${op.referenciaOperacion ? `<tr>
            <td style="padding:5px 0;font-size:12px;color:#888;">Referencia</td>
            <td style="padding:5px 0;font-size:13px;color:#333;">${op.referenciaOperacion}</td>
          </tr>` : ''}
        </table>
      </div>

      ${notesHtml}

      ${(op.containers ?? []).length > 0 ? `
      <!-- Contenedores -->
      <div style="margin:20px 0;">
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#0C0A04;text-transform:uppercase;letter-spacing:0.05em;">📦 Detalle de carga (${op.containers!.length})</p>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="background:#0C0A04;color:#F3B450;">
                <th style="padding:8px 10px;text-align:left;font-weight:600;white-space:nowrap;">Contenedor / Guía Aérea</th>
                <th style="padding:8px 10px;text-align:left;font-weight:600;white-space:nowrap;">Booking</th>
                <th style="padding:8px 10px;text-align:left;font-weight:600;white-space:nowrap;">B/L / AWB</th>
                <th style="padding:8px 10px;text-align:left;font-weight:600;white-space:nowrap;">Estado</th>
                <th style="padding:8px 10px;text-align:left;font-weight:600;white-space:nowrap;">ETD Est.</th>
                <th style="padding:8px 10px;text-align:left;font-weight:600;white-space:nowrap;">ETA Est.</th>
                <th style="padding:8px 10px;text-align:left;font-weight:600;white-space:nowrap;">ETA Real</th>
                <th style="padding:8px 10px;text-align:left;font-weight:600;white-space:nowrap;">Notas</th>
              </tr>
            </thead>
            <tbody>${containersRows}</tbody>
          </table>
        </div>
      </div>` : ''}

      <p style="font-size:13px;color:#888;margin-top:24px;">
        Para cualquier consulta puede responder a este correo o contactarnos directamente.<br>
        <strong style="color:#333;">Gracias por confiar en ZAS by JMC Corp.</strong>
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8f9fa;padding:16px 32px;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0;font-size:12px;color:#aaa;">© ${new Date().getFullYear()} ZAS by JMC Corp. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>`;

  const subject = `Estado de su operación ${op.operationNo} - ZAS by JMC Corp`;

  try {
    const { error } = await resend.emails.send({ from, to, subject, html });
    if (error) {
      const reason = formatResendError(error);
      console.error('[email] Resend rechazó notificación operación:', reason);
      return { ok: false, reason };
    }
    console.log(`[email] Notificación operación ${op.operationNo} enviada a ${to}`);
    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : formatResendError(error);
    console.error('[email] Excepción al enviar notificación operación:', error);
    return { ok: false, reason };
  }
}

/** Informe PDF del Operations Board (Comercial y Parcel en un solo documento). */
export async function sendOperationsBoardPdfEmail(
  to: string,
  pdfBuffer: Buffer
): Promise<SendEmailResult> {
  const resend = getResend();
  if (!resend) {
    return { ok: false, reason: 'RESEND_API_KEY no configurada' };
  }

  const from = getFromAddress();
  const day = new Date().toISOString().split('T')[0];
  const filename = `operations_board_${day}.pdf`;

  try {
    const { error } = await resend.emails.send({
      from,
      to,
      subject: 'Operaciones ZAS BY JMC',
      html: `<p>Adjunto listado de operaciones Comerciales y Gift Parcel actualizadas ${day}.</p><p>Saludos</p>`,
      text: `Adjunto listado de operaciones Comerciales y Gift Parcel actualizadas ${day}.\n\nSaludos`,
      attachments: [
        {
          filename,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    if (error) {
      const reason = formatResendError(error);
      console.error('[email] Resend rechazó informe PDF operaciones:', reason, error);
      return { ok: false, reason };
    }

    console.log('[email] Operations board PDF enviado a', to);
    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : formatResendError(error);
    console.error('[email] Excepción al enviar informe PDF operaciones:', error);
    return { ok: false, reason };
  }
}

