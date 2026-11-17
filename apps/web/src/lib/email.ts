import "server-only";

/** Sends one email through Resend. Returns false (and logs) instead of throwing, so a mail problem never breaks a form. */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn("RESEND_API_KEY is not set: email not sent"); return false; }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Perkly <no-reply@perklyapp.co>", to: [to], subject, html }),
    });
    if (!res.ok) { console.error("Resend error", res.status, await res.text()); return false; }
    return true;
  } catch (e) {
    console.error("Resend request failed", e);
    return false;
  }
}
