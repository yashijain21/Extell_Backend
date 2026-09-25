const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false') === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || 'no-reply@extell.local';
const SMTP_CONN_TIMEOUT_MS = Number(process.env.SMTP_CONN_TIMEOUT_MS) || 8000;
const SMTP_GREET_TIMEOUT_MS = Number(process.env.SMTP_GREET_TIMEOUT_MS) || 8000;
const SMTP_SOCKET_TIMEOUT_MS = Number(process.env.SMTP_SOCKET_TIMEOUT_MS) || 10000;
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
  if (!transport) throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.');
  await transport.sendMail({ from: SMTP_FROM, to, subject, text });
};
