import nodemailer from "nodemailer";
import dotenv from "dotenv";
import fs from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { EmailToken } from "./models.js";
import { assert } from "./security.js";
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export function mailSettings(config) {
  let file = {};
  if (config.mailConfigPath && fs.existsSync(config.mailConfigPath))
    file = dotenv.parse(fs.readFileSync(config.mailConfigPath));
  const env = { ...process.env, ...file };
  return {
    host: env.SMTP_HOST || "smtp.gmail.com",
    port: Number(env.SMTP_PORT || 465),
    user: env.SMTP_USER,
    pass: env.SMTP_PASS?.replace(/\s/g, ""),
    name: env.MAIL_FROM_NAME || "NUB Connect",
  };
}
export function requireMail(config) {
  const m = mailSettings(config);
  assert(
    config.sendMail || (m.user && m.pass),
    503,
    "Email service is not configured. Ask the platform owner to configure Gmail SMTP.",
  );
  return m;
}
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function emailTemplate(name, purpose, url) {
  const reset = purpose === "reset",
    title = reset ? "A fresh start, securely." : "Your community is ready.",
    button = reset ? "Reset your password" : "Verify my email";
  return `<!doctype html><html><body style="margin:0;background:#edf3f4;font-family:Arial,sans-serif;color:#142c38"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px"><table role="presentation" width="560" style="width:100%;max-width:560px;background:white;border-radius:20px;overflow:hidden"><tr><td style="background:#102a36;padding:32px;color:#55d9b6;font-weight:bold;letter-spacing:2px">NUB CONNECT</td></tr><tr><td style="padding:36px"><p style="color:#526e79">Hello ${escape(name)},</p><h1 style="font-size:30px;line-height:1.2">${title}</h1><p style="line-height:1.8">${reset ? "We received a request to reset your NUB Connect password. Choose a new password using the secure button below." : "Your university Administrator has created your account. Confirm that this email belongs to you to finish securing your access."}</p><p style="padding:20px 0"><a href="${escape(url)}" style="background:#31bd99;color:#06261e;text-decoration:none;font-weight:bold;padding:16px 26px;border-radius:10px;display:inline-block">${button} &rarr;</a></p><p style="font-size:13px;color:#526e79;line-height:1.8">This link works once and expires in ${reset ? "30 minutes" : "24 hours"}. If you did not expect this email, ignore it. Never share this link or your password.</p><hr style="border:0;border-top:1px solid #e4ecef"><p style="font-size:12px;color:#526e79;word-break:break-all">Button not working? Copy this link into your browser:<br>${escape(url)}</p></td></tr><tr><td style="padding:24px 36px;background:#f6f9fa;color:#526e79;font-size:12px">A connection today. A possibility tomorrow.<br>NUB Connect · Account security</td></tr></table></td></tr></table></body></html>`;
}
export async function sendAccountEmail(user, purpose, config) {
  assert(purpose === "reset", 410, "Only password recovery emails are enabled");
  const m = requireMail(config),
    token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + (purpose === "reset" ? 30 * 60 * 1000 : 86400000),
  );
  const record = await EmailToken.create({
    user: user._id,
    email: user.email,
    purpose,
    hash: digest(token),
    expiresAt,
  });
  const url = `${config.origin}/${purpose === "reset" ? "reset-password" : "verify-email"}#token=${token}`;
  const message = {
    from: { name: m.name, address: m.user || "no-reply@university.test" },
    to: user.email,
    subject:
      purpose === "reset"
        ? "Reset your NUB Connect password"
        : "Verify your NUB Connect email",
    text: `Hello ${user.name},\n${purpose === "reset" ? "Reset your password" : "Verify your email"}: ${url}\nThis link is single-use and expires ${expiresAt.toISOString()}. If unexpected, ignore this email.`,
    html: emailTemplate(user.name, purpose, url),
  };
  try {
    if (config.sendMail) await config.sendMail(message);
    else
      await nodemailer
        .createTransport({
          host: m.host,
          port: m.port,
          secure: m.port === 465,
          requireTLS: m.port !== 465,
          auth: { user: m.user, pass: m.pass },
          connectionTimeout: 10000,
          socketTimeout: 15000,
          logger: false,
          debug: false,
        })
        .sendMail(message);
  } catch {
    await EmailToken.deleteOne({ _id: record._id });
    throw Object.assign(
      new Error(
        "Email could not be delivered. Check SMTP configuration and retry from account management.",
      ),
      { status: 503 },
    );
  }
}
