import nodemailer from 'nodemailer';
import { db } from './db.js';
import { emailPreviews } from './schema.js';

export async function sendOrderEmail(to: string, orderNumber: string, totalFils: number) {
  const subject = `Dara order ${orderNumber}`;
  const html = `<div style="font-family:Georgia,serif;color:#333b2b"><h1>Dara | دارا</h1><p>Thank you for your order ${orderNumber}.</p><p>Total: ${(totalFils / 1000).toFixed(3)} KWD</p><p>This is a simulated payment. No card was charged.</p></div>`;
  if (process.env.SMTP_HOST) {
    const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), secure: false, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined });
    await transport.sendMail({ from: process.env.MAIL_FROM ?? 'orders@dara.example', to, subject, html });
  } else {
    await db.insert(emailPreviews).values({ to, subject, html });
  }
}
