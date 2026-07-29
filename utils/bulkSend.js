// utils/bulkSend.js — sends across channels, tolerating individual failures
import axios from "axios";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const OPENSMS_BASE = "https://opensms.co.ke/api/v3";
const smsClient = axios.create({
  baseURL: OPENSMS_BASE,
  headers: { Authorization: `Bearer ${process.env.OPENSMS_API_TOKEN}`, Accept: "application/json" },
  timeout: 10000,
});

export async function sendSms({ to, message }) {
  return smsClient.post("/sms/send", { to, message, sender_id: process.env.OPENSMS_SENDER_ID });
}

export async function sendWhatsapp({ to, message }) {
  return smsClient.post("/whatsapp/send", { to, message }); // confirm exact path/payload with OpenSMS docs
}

export async function sendEmail({ to, subject, body }) {
  return resend.emails.send({
    from: `${process.env.SCHOOL_NAME || "School"} <noreply@yourdomain.com>`,
    to,
    subject,
    text: body,
  });
}

// Fires all sends in parallel, tallies success/failure per channel — one bad number
// or bounced email never blocks the rest of the batch.
export async function bulkSend({ recipients, channels, title, body }) {
  const tally = {
    sms: { attempted: 0, sent: 0, failed: 0 },
    whatsapp: { attempted: 0, sent: 0, failed: 0 },
    email: { attempted: 0, sent: 0, failed: 0 },
  };

  const jobs = [];

  for (const r of recipients) {
    if (channels.includes("sms") && r.phone) {
      tally.sms.attempted++;
      jobs.push(
        sendSms({ to: r.phone, message: body }).then(() => tally.sms.sent++).catch(() => tally.sms.failed++)
      );
    }
    if (channels.includes("whatsapp") && r.phone) {
      tally.whatsapp.attempted++;
      jobs.push(
        sendWhatsapp({ to: r.phone, message: body }).then(() => tally.whatsapp.sent++).catch(() => tally.whatsapp.failed++)
      );
    }
    if (channels.includes("email") && r.email) {
      tally.email.attempted++;
      jobs.push(
        sendEmail({ to: r.email, subject: title || "School Notice", body })
          .then(() => tally.email.sent++)
          .catch(() => tally.email.failed++)
      );
    }
  }

  await Promise.allSettled(jobs);
  return tally;
}
