import { Resend } from "resend";

const FROM_EMAIL = "Polo Clubhouse <onboarding@resend.dev>";

async function getApiKey(): Promise<string> {
  if (process.env.RESEND_API_KEY) {
    return process.env.RESEND_API_KEY;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (xReplitToken && hostname) {
    try {
      const data = await fetch(
        "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
        { headers: { Accept: "application/json", "X-Replit-Token": xReplitToken } }
      ).then((r) => r.json());
      const key = data.items?.[0]?.settings?.api_key;
      if (key) return key;
    } catch {}
  }

  throw new Error("Resend API key not configured");
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    const apiKey = await getApiKey();
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    console.log(`[Email] Sent to ${to}: ${subject}`, result);
    return result;
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err);
    throw err;
  }
}

export function welcomeEmailHtml({
  displayName,
  email,
  tempPassword,
  loginUrl,
}: {
  displayName: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
}) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8faf6; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #1B5E20; font-size: 22px; margin: 0;">Welcome to Polo Clubhouse</h1>
    </div>
    <p style="color: #333; font-size: 15px; line-height: 1.6;">Hi ${displayName},</p>
    <p style="color: #333; font-size: 15px; line-height: 1.6;">An account has been created for you on Polo Clubhouse. Here are your login details:</p>
    <div style="background: #f8faf6; border: 1px solid #e0e8dc; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0 0 8px; font-size: 14px; color: #555;"><strong>Email:</strong> ${email}</p>
      <p style="margin: 0; font-size: 14px; color: #555;"><strong>Temporary Password:</strong> ${tempPassword}</p>
    </div>
    <p style="color: #333; font-size: 15px; line-height: 1.6;">Please sign in and change your password as soon as possible.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${loginUrl}" style="background: #2E7D32; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600; display: inline-block;">Sign In</a>
    </div>
    <p style="color: #999; font-size: 12px; text-align: center; margin-top: 32px;">Polo Clubhouse</p>
  </div>
</body>
</html>`;
}

export function passwordResetEmailHtml({
  displayName,
  resetUrl,
}: {
  displayName: string;
  resetUrl: string;
}) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8faf6; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #1B5E20; font-size: 22px; margin: 0;">Reset Your Password</h1>
    </div>
    <p style="color: #333; font-size: 15px; line-height: 1.6;">Hi ${displayName},</p>
    <p style="color: #333; font-size: 15px; line-height: 1.6;">We received a request to reset your password. Click the button below to set a new one:</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${resetUrl}" style="background: #2E7D32; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600; display: inline-block;">Reset Password</a>
    </div>
    <p style="color: #666; font-size: 14px; line-height: 1.6;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    <p style="color: #999; font-size: 12px; text-align: center; margin-top: 32px;">Polo Clubhouse</p>
  </div>
</body>
</html>`;
}
