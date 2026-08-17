import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { toWhatsAppAddress } from '../../shared/phone.js';

function mailIpFamily() {
  const n = Number(String(process.env.SMTP_FAMILY || process.env.MAIL_FAMILY || '').trim());
  if (n === 4 || n === 6) return n;
  if (process.env.NODE_ENV === 'production' && /cp69\.domains\.co\.za/i.test(process.env.SMTP_HOST || '')) {
    return 6;
  }
  return undefined;
}

export function smtpSettings() {
  return {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    user: process.env.SMTP_USER || '',
    pass: String(process.env.SMTP_PASS || '').replace(/^['"]|['"]$/g, ''),
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
    fromName: process.env.SMTP_FROM_NAME || 'BretuneTech',
    replyTo: String(process.env.SMTP_REPLY_TO || '').trim(),
    family: mailIpFamily(),
  };
}

export function smtpConfigured() {
  const smtp = smtpSettings();
  return Boolean(smtp.host && smtp.user && smtp.pass && smtp.from);
}

function createTransport() {
  const smtp = smtpSettings();
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    ...(smtp.family ? { family: smtp.family } : {}),
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 25000,
    auth: { user: smtp.user, pass: smtp.pass },
  });
}

export function twilioSettings() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    apiKey: process.env.TWILIO_API_KEY || '',
    apiSecret: process.env.TWILIO_API_SECRET || '',
    from: process.env.TWILIO_WHATSAPP_FROM || '',
    contentSid: process.env.TWILIO_CONTENT_SID || '',
    defaultCountry: process.env.TWILIO_DEFAULT_COUNTRY || '27',
  };
}

export function twilioConfigured() {
  const cfg = twilioSettings();
  const hasToken = Boolean(cfg.accountSid && cfg.authToken);
  const hasKey = Boolean(cfg.accountSid && cfg.apiKey && cfg.apiSecret);
  return Boolean((hasToken || hasKey) && cfg.from);
}

function createTwilioClient() {
  const cfg = twilioSettings();
  if (cfg.accountSid && cfg.authToken) {
    return twilio(cfg.accountSid, cfg.authToken);
  }
  return twilio(cfg.apiKey, cfg.apiSecret, { accountSid: cfg.accountSid });
}

export async function sendOutboundEmail({ to, subject, text, html, customerName, accountNo }) {
  if (!smtpConfigured()) throw new Error('SMTP is not configured.');
  const smtp = smtpSettings();
  const transporter = createTransport();
  const headers = {};
  if (customerName) headers['X-Collections-Customer'] = String(customerName);
  if (accountNo) headers['X-Collections-Account'] = String(accountNo);
  return transporter.sendMail({
    from: `"${smtp.fromName}" <${smtp.from}>`,
    replyTo: smtp.replyTo || smtp.from,
    to,
    subject,
    text,
    html: html || undefined,
    headers,
  });
}

export async function sendOutboundWhatsApp({ to, message }) {
  if (!twilioConfigured()) throw new Error('Twilio WhatsApp is not configured.');
  const cfg = twilioSettings();
  const toAddress = toWhatsAppAddress(to, cfg.defaultCountry);
  if (!toAddress) throw new Error('Invalid WhatsApp number.');
  const fromAddress =
    toWhatsAppAddress(cfg.from, cfg.defaultCountry) ||
    (String(cfg.from || '').toLowerCase().startsWith('whatsapp:') ? String(cfg.from).trim() : null);
  if (!fromAddress) throw new Error('TWILIO_WHATSAPP_FROM is invalid.');
  const client = createTwilioClient();
  return client.messages.create({ from: fromAddress, to: toAddress, body: String(message || '') });
}
