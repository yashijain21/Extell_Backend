import QuoteRequest from '../models/QuoteRequest.js';
import { ensureDb } from '../utils/db.js';

const ALLOWED_STATUS = ['new', 'contacted', 'quoted', 'closed'];
const QUOTE_TO_EMAIL = process.env.QUOTE_REQUEST_TO || 'sales@extellsystems.com';
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

let quoteTransportPromise;

const createQuoteTransport = async () => {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const nodemailerModule = await import('nodemailer');
  const nodemailer = nodemailerModule.default || nodemailerModule;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    connectionTimeout: SMTP_CONN_TIMEOUT_MS,
    greetingTimeout: SMTP_GREET_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
};

const getQuoteTransport = async () => {
  if (!quoteTransportPromise) {
    quoteTransportPromise = createQuoteTransport().catch((error) => {
      quoteTransportPromise = null;
      throw error;
    });
  }
  return quoteTransportPromise;
};

const normalizeFromEmail = (fromValue = '') => {
  const match = String(fromValue).match(/<([^>]+)>/);
  return (match ? match[1] : fromValue).trim();
};

const sendQuoteViaResend = async ({ subject, text, replyTo }) => {
  if (!RESEND_API_KEY) return false;
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [QUOTE_TO_EMAIL],
      subject,
      text,
      reply_to: replyTo
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API failed (${response.status}): ${body}`);
  }
  return true;
};

const sendQuoteNotification = async (quote) => {
  const subject = `[Quote Request] ${quote.productName || 'General'}${quote.productSku ? ` (${quote.productSku})` : ''}`;
  const text = [
    'A new quote request has been submitted.',
    `Quote ID: ${quote._id}`,
    `Submitted At: ${new Date(quote.createdAt || Date.now()).toLocaleString('en-US')}`,
    `Full Name: ${quote.fullName}`,
    `Email: ${quote.email}`,
    `Mobile: ${quote.mobile || 'N/A'}`,
    `Company: ${quote.companyName || 'N/A'}`,
    `Product Name: ${quote.productName || 'N/A'}`,
    `Product SKU: ${quote.productSku || 'N/A'}`,
    `Requirements: ${quote.requirements}`,
    `Source: ${quote.source || 'product-detail'}`
  ].join('\n');

  const transport = await getQuoteTransport().catch(() => null);
  if (transport) {
    try {
      await transport.sendMail({
        from: SMTP_FROM,
        to: QUOTE_TO_EMAIL,
        replyTo: quote.email,
        subject,
        text
      });
      return true;
    } catch (smtpError) {
      if (!RESEND_API_KEY) throw smtpError;
      await sendQuoteViaResend({
        subject,
        text,
        replyTo: normalizeFromEmail(quote.email)
      });
      return true;
    }
  }

  if (!RESEND_API_KEY) return false;
  await sendQuoteViaResend({
    subject,
    text,
    replyTo: normalizeFromEmail(quote.email)
  });
  return true;
};

export const createQuoteRequest = async (req, res) => {
  try {
    await ensureDb();

    const payload = req.body || {};
    const fullName = String(payload.fullName || payload.name || '').trim();
    const email = String(payload.email || '').trim().toLowerCase();
    const mobile = String(payload.mobile || '').trim();
    const companyName = String(payload.companyName || '').trim();
    const requirements = String(payload.requirements || payload.message || '').trim();
    const productName = String(payload.productName || '').trim();
    const productSku = String(payload.productSku || '').trim();
    const source = String(payload.source || '').trim() || 'product-detail';

    if (!fullName || !email || !mobile || !requirements) {
      return res.status(400).json({ message: 'Full name, email, mobile number, and requirements are required.' });
    }

    const item = await QuoteRequest.create({
      fullName,
      email,
      mobile,
      companyName,
      requirements,
      productName,
      productSku,
      source,
      status: 'new'
    });

    const mailSent = await sendQuoteNotification(item).catch(() => false);
    return res.status(201).json({
      success: true,
      item,
      mailSent
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const listQuoteRequests = async (req, res) => {
  try {
    await ensureDb();

    const status = String(req.query.status || '').trim().toLowerCase();
    const q = String(req.query.q || '').trim();

    const filter = {};
    if (status && ALLOWED_STATUS.includes(status)) filter.status = status;
    if (q) {
      const regex = new RegExp(q, 'i');
      filter.$or = [
        { fullName: regex },
        { email: regex },
        { mobile: regex },
        { companyName: regex },
        { productName: regex },
        { productSku: regex },
        { requirements: regex }
      ];
    }

    const items = await QuoteRequest.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateQuoteStatus = async (req, res) => {
  try {
    await ensureDb();
    const status = String(req.body.status || '').trim().toLowerCase();

    if (!ALLOWED_STATUS.includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    const item = await QuoteRequest.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).lean();

    if (!item) return res.status(404).json({ message: 'Quote request not found.' });
    return res.json({ item });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
