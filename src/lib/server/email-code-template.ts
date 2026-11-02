import { z } from "zod";

/** Inline styles and presentation tables keep the transactional email usable across mail clients. */
export function emailCodeTemplate(value: string) {
  const code = z.string().regex(/^\d{6}$/).parse(value);
  const text = `Your Dossierly sign-in code is ${code}.\n\nIt expires in 10 minutes and can be used once. Enter it only in the browser where you requested it. Never share this code.\n\nIf you did not request this code, you can ignore this email.`;
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Your Dossierly sign-in code</title></head>
<body style="margin:0;padding:0;background:#f5f5f3;color:#202522;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Your one-time Dossierly sign-in code. Valid for 10 minutes.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f3;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr><td style="padding:0 0 24px;font-size:20px;font-weight:700;letter-spacing:-0.5px;">Dossierly<span style="color:#527568;">.</span></td></tr>
        <tr><td style="padding:32px 24px;background:#ffffff;border:1px solid #e1e5e0;border-radius:12px;">
          <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;letter-spacing:-0.5px;">Your sign-in code</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#505953;">Enter this code in the browser where you requested it to continue to Dossierly.</p>
          <div style="padding:20px 8px;background:#f1f5f2;border:1px solid #dce5de;border-radius:8px;text-align:center;">
            <span style="font-family:Consolas,'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:6px;color:#233f32;">${code}</span>
          </div>
          <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:#505953;">This code expires in <strong>10 minutes</strong> and can be used once. Never share this code.</p>
        </td></tr>
        <tr><td style="padding:24px 8px 0;font-size:13px;line-height:1.6;color:#626b65;">
          <p style="margin:0 0 12px;">Didn’t request this code? You can safely ignore this email.</p>
          <p style="margin:0;">Dossierly · A little clarity for life abroad.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { text, html };
}
