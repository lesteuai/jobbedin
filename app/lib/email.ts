import nodemailer, { type Transporter } from 'nodemailer';

export const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true';

let transport: Transporter | null = null;

function getTransport() {
  if (!transport) {
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
