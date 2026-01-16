import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'ZAS by JMC <onboarding@resend.dev>'; // Cambia a tu dominio verificado en Resend
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  nombre: string
): Promise<boolean> {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
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
      console.error('Error enviando email:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error enviando email:', error);
    return false;
  }
}

