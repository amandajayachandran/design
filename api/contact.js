// /api/contact.js
//
// Sends a message from the "Email Me" modal to Amanda via Resend.
// Amanda's address is never shown on the page. The visitor's address is set
// as reply-to, so hitting "Reply" in her inbox goes straight back to them.
//
// Required environment variables:
//   RESEND_API_KEY      Resend API key
//   FROM_EMAIL          a sender on a domain verified in Resend,
//                       e.g. "Amanda's Website <hello@amandacreate.com>"
//   CONTACT_TO_EMAIL    where messages are delivered (Amanda's inbox)
//   KV_REST_API_URL     (already set; used for rate limiting + contact log)
//   KV_REST_API_TOKEN   (already set)

async function redis(...args) {
  const res = await fetch(process.env.KV_REST_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getClientIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  // Honeypot: real people never see this field. Pretend success for bots.
  if (String(body.website || "").trim()) {
    return json({ ok: true });
  }

  const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
  const subject = String(body.subject || "").replace(/[\r\n]+/g, " ").trim().slice(0, 150);
  const message = String(body.message || "").trim().slice(0, 5000);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
  if (!subject) return json({ error: "Add a subject." }, 400);
  if (!message) return json({ error: "Add a message." }, 400);

  const ip = getClientIp(request);

  // Rate limit: 5 messages per IP per hour.
  try {
    const rlKey = `portfolio:contact_ratelimit:${ip}`;
    const count = await redis("INCR", rlKey);
    if (count === 1) await redis("EXPIRE", rlKey, "3600");
    if (count > 5) return json({ error: "Too many messages. Please try again later." }, 429);
  } catch (err) {
    console.error("Contact rate-limit check failed:", err);
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL,
      to: process.env.CONTACT_TO_EMAIL,
      reply_to: email,
      subject: `[amandacreate.com] ${subject}`,
      text:
        `New message from the website contact form.\n\n` +
        `From: ${email}\n` +
        `Subject: ${subject}\n\n` +
        `${message}\n\n` +
        `---\nReply to this email to respond directly to ${email}.`,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("Resend send failed:", res.status, errorBody);
    return json({ error: "The message couldn't be sent. Please try again, or reach Amanda on LinkedIn." }, 502);
  }

  // Keep a record of who wrote in (latest 500).
  try {
    await redis(
      "LPUSH",
      "portfolio:contact_log",
      JSON.stringify({ timestamp: new Date().toISOString(), email, subject, ip })
    );
    await redis("LTRIM", "portfolio:contact_log", "0", "499");
  } catch (err) {
    console.error("Contact log write failed:", err);
  }

  return json({ ok: true });
}
