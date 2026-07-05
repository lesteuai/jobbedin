import nodemailer, { type Transporter } from 'nodemailer';

export const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true';

let transport: Transporter | null = null;

function getTransport() {
  if (!transport) {
    // EMAIL_PROVIDER=gmail uses Gmail OAuth2; anything else falls back to plain SMTP.
    if (process.env.EMAIL_PROVIDER === 'gmail') {
      transport = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.GMAIL_USER,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
        },
      });
    } else {
      transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
  }
  return transport;
}

export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  if (!EMAIL_ENABLED) {
    console.log(`[email disabled] to=${to} subject=${subject}`);
    return;
  }

  await getTransport().sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
  });
}
