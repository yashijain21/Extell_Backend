const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false') === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || 'no-reply@extell.local';
const SMTP_CONN_TIMEOUT_MS = Number(process.env.SMTP_CONN_TIMEOUT_MS) || 8000;
const SMTP_GREET_TIMEOUT_MS = Number(process.env.SMTP_GREET_TIMEOUT_MS) || 8000;
const SMTP_SOCKET_TIMEOUT_MS = Number(process.env.SMTP_SOCKET_TIMEOUT_MS) || 10000;
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_API_URL = process.env.RESEND_API_URL || 'https://api.resend.com/emails';
const RESEND_FROM = process.env.RESEND_FROM || SMTP_FROM;

let transportPromise;

const getTransport = async () => {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  if (!transportPromise) {
    transportPromise = import('nodemailer').then((module) => {
      const nodemailer = module.default || module;
      return nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        connectionTimeout: SMTP_CONN_TIMEOUT_MS,
        greetingTimeout: SMTP_GREET_TIMEOUT_MS,
        socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
        auth: { user: SMTP_USER, pass: SMTP_PASS }
      });
    }).catch((error) => {
      transportPromise = null;
      throw error;
    });
  }
  return transportPromise;
};

export const sendEmail = async ({ to, subject, text }) => {
  const transport = await getTransport();
  if (transport) {
    try {
      await transport.sendMail({ from: SMTP_FROM, to, subject, text });
      return;
    } catch (smtpError) {
      if (!RESEND_API_KEY) throw smtpError;
    }
  }

  if (!RESEND_API_KEY) throw new Error('No mail provider configured. Set SMTP_* values or RESEND_API_KEY.');
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, text })
  });
  if (!response.ok) throw new Error(`Email provider failed (${response.status}).`);
};
