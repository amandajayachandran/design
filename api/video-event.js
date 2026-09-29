// /api/video-event.js
//
// Records what happens after someone gets past the /mywork password:
// started the video, reached the halfway point, finished it, opened the resume.
// Entries go into the same Redis list as the password attempts
// (portfolio:access_log), so they show up in the /mywork/log table.
//
// Only accepted from a browser that already holds the portfolio session
// cookie issued by /api/verify-access.
//
// Required environment variables (already set):
//   KV_REST_API_URL
//   KV_REST_API_TOKEN

const ALLOWED_EVENTS = new Set(["video_play", "video_halfway", "video_complete", "resume_click"]);

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
  const cookie = request.headers.get("cookie") || "";
  if (!/(?:^|;\s*)portfolio_session=/.test(cookie)) {
    return json({ error: "Not authenticated." }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const event = String(body.event || "");
  if (!ALLOWED_EVENTS.has(event)) return json({ error: "Unknown event." }, 400);

  const email = String(body.email || "").trim().toLowerCase().slice(0, 254) || "unknown";
  const ip = getClientIp(request);

  // Light rate limit so this can't be used to flood the log: 30 per IP per 15 min.
  const rlKey = `portfolio:event_ratelimit:${ip}`;
  const count = await redis("INCR", rlKey);
  if (count === 1) await redis("EXPIRE", rlKey, "900");
  if (count > 30) return json({ error: "Too many requests." }, 429);

  await redis(
    "LPUSH",
    "portfolio:access_log",
    JSON.stringify({
      timestamp: new Date().toISOString(),
      email,
      ip,
      userAgent: request.headers.get("user-agent") || "",
      result: event,
    })
  );
  await redis("LTRIM", "portfolio:access_log", "0", "999");

  return json({ ok: true });
}
