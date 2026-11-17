import "server-only";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Confirmation sent when a merchant application is received, in the language the applicant used. */
export function applicationReceivedEmail(businessName: string, lang: "en" | "ar") {
  const name = esc(businessName);
  const en = `<h1 style="font-size:22px;margin:0 0 12px;">We received your application</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">Thanks for applying to join Perkly with <b>${name}</b>.</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">Our team will review it and call you within 2 working days. You don't need to do anything else now. Once it's approved, you'll get an email to set up your merchant portal.</p>
    <p style="font-size:13px;line-height:1.6;color:#4b4560;margin:0;">Didn't apply? You can ignore this email, or reply to tell us.</p>`;
  const ar = `<h1 style="font-size:22px;margin:0 0 12px;">وصلنا طلبك</h1>
    <p style="font-size:15px;line-height:1.8;margin:0 0 12px;">شكرًا إنك قدّمت تنضم لـ Perkly بـ <b>${name}</b>.</p>
    <p style="font-size:15px;line-height:1.8;margin:0 0 12px;">فريقنا هيراجع الطلب ويتصل بيك خلال يومين عمل. مش محتاج تعمل حاجة دلوقتي. أول ما الطلب يتوافق عليه، هيوصلك إيميل تفتح فيه بوابة التاجر بتاعتك.</p>
    <p style="font-size:13px;line-height:1.8;color:#4b4560;margin:0;">لو ماقدمتش الطلب ده، تقدر تتجاهل الإيميل، أو ردّ علينا وقولنا.</p>`;
  // One language only: the language the applicant used on the form
  const body = lang === "ar"
    ? `<div dir="rtl" lang="ar" style="text-align:right;font-family:Tahoma,Arial,sans-serif;">${ar}</div>`
    : `<div>${en}</div>`;
  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;padding:0;background:#f5f3fa;font-family:Arial,Helvetica,sans-serif;color:#1d1830;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3fa;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#7B2FF7,#FF3EA5);padding:24px 28px;color:#ffffff;">
  <div style="font-size:22px;font-weight:800;">Perkly</div><div style="font-size:13px;opacity:.9;">Student perks · Unlock Perks. Live Smart.</div></td></tr>
<tr><td style="padding:28px;">${body}</td></tr>
<tr><td style="background:#faf9fd;padding:16px 28px;font-size:12px;color:#6b6680;text-align:center;">Perkly · support@perklyapp.co</td></tr>
</table></td></tr></table></body></html>`;
  const subject = lang === "ar" ? "وصلنا طلبك للانضمام لـ Perkly" : "We received your Perkly application";
  return { subject, html };
}
