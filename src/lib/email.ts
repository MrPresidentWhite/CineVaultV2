/**
 * E-Mail-Versand per SMTP (nodemailer).
 * Nur aktiv, wenn SMTP_HOST, SMTP_USER, SMTP_PASS gesetzt sind.
 */

import nodemailer from "nodemailer";
import {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  SMTP_FROM_NAME,
} from "./env";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      throw new Error(
        "SMTP-Konfiguration fehlt (SMTP_HOST, SMTP_USER, SMTP_PASS)"
      );
    }
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      tls: { rejectUnauthorized: false },
    });
  }
  return transporter;
}

export function isEmailConfigured(): boolean {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({
  to,
  subject,
  html,
}: SendEmailOptions): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error("E-Mail ist nicht konfiguriert (SMTP fehlt).");
  }
  const from = SMTP_FROM_NAME
    ? `"${SMTP_FROM_NAME}" <${SMTP_FROM}>`
    : (SMTP_FROM ?? SMTP_USER)!;
  await getTransporter().sendMail({ from, to, subject, html });
}
