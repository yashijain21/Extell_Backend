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
    quote.question ? `Question: ${quote.question}` : '',
    quote.answer ? `Answer: ${quote.answer}` : '',
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

  if (!RESEND_API_KEY) {
    throw new Error('No mail provider configured. Set SMTP_* values or RESEND_API_KEY.');
  }
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

    let mailSent = false;
    let mailError = '';
    try {
      mailSent = await sendQuoteNotification(item);
      if (!mailSent) {
        mailError = 'Quote saved, but email notification was not sent.';
      }
    } catch (notifyError) {
      mailSent = false;
      mailError = notifyError?.message || 'Quote saved, but email notification failed.';
    }

    return res.status(201).json({
      success: true,
      item,
      mailSent,
      mailError
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createChatbotLead = async (req, res) => {
  try {
    await ensureDb();

    const payload = req.body || {};
    const fullName = String(payload.fullName || '').trim();
    const email = String(payload.email || '').trim().toLowerCase();
    const companyName = String(payload.companyName || '').trim();
    const question = String(payload.question || '').trim();
    const answer = String(payload.answer || '').trim();
    const requirements = String(
      payload.requirements ||
        (question && answer ? `[Chatbot]\nQuestion: ${question}\nAnswer: ${answer}` : '')
    ).trim();

    if (!fullName || !email || !question || !answer) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email, question, and answer are required.'
      });
    }

    const item = await QuoteRequest.create({
      fullName,
      email,
      mobile: String(payload.mobile || '').trim(),
      companyName,
      question,
      answer,
      requirements,
      source: 'chatbot',
      status: 'new'
    });

    let mailSent = false;
    let mailError = '';
    try {
      mailSent = await sendQuoteNotification(item);
      if (!mailSent) mailError = 'Lead saved, but email notification was not sent.';
    } catch (notifyError) {
      mailError = notifyError?.message || 'Lead saved, but email notification failed.';
    }

    return res.status(201).json({ success: true, item, mailSent, mailError });
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
        { question: regex },
        { answer: regex },
        { requirements: regex }
      ];
    }

    const items = await QuoteRequest.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const listChatbotLeads = async (req, res) => {
  try {
    await ensureDb();

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;
    const filter = { source: 'chatbot' };
    const q = String(req.query.q || '').trim();
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { fullName: regex },
        { email: regex },
        { companyName: regex },
        { question: regex },
        { answer: regex },
        { requirements: regex }
      ];
    }

    const [items, total] = await Promise.all([
      QuoteRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      QuoteRequest.countDocuments(filter)
    ]);

    return res.json({
      success: true,
      data: {
        items,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
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
