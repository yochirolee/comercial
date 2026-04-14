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

