// /api/verify-access.js
//
// Validates the shared portfolio password. Every attempt -- success,
// failure, or rate-limited -- is logged to Redis with email, IP,
// user-agent, and timestamp for accountability, since a shared
// password (unlike the old per-person OTP) doesn't verify the visitor
// actually controls the email address they typed in.
//
// On success, issues the same short-lived signed session cookie that
// /api/video-url.js already expects -- that file is unchanged.
//
// Required environment variables:
//   KV_REST_API_URL
//   KV_REST_API_TOKEN
//   SESSION_SECRET         same value already used by video-url.js
//   MYWORK_PASSWORD_HASH   format: "iterations:saltHex:hashHex"
//                          (PBKDF2-SHA256; see generation note below)

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

async function hmac(payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(process.env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64url(str) {
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Verifies a password against a stored "iterations:saltHex:hashHex"
// string using PBKDF2-SHA256 -- chosen because it's built into Web
// Crypto (crypto.subtle), which this project's other routes already
// rely on; bcrypt is not available in this runtime without adding a
// native/npm dependency.
async function verifyPassword(password, stored) {
  if (!stored) return false;
  const [iterationsStr, saltHex, hashHex] = stored.split(":");
  const iterations = Number(iterationsStr);
  if (!iterations || !saltHex || !hashHex) return false;

  const salt = hexToBytes(saltHex);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const computedHex = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(computedHex, hashHex);
}

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

export async function POST(request) {
  let email, password;
  try {
    const body = await request.json();
    email = String(body.email || "").trim().toLowerCase();
    password = String(body.password || "");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request." }), { status: 400 });
  }

  if (!email || !password) {
    return new Response(
      JSON.stringify({ error: "Email and password are required." }),
      { status: 400 }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  // Rate limit by IP -- a shared password means limiting by email alone
  // would do nothing, since anyone can type any email.
  const rlKey = `portfolio:ratelimit:${ip}`;
  const attempts = await redis("INCR", rlKey);
  if (attempts === 1) {
    await redis("EXPIRE", rlKey, String(RATE_LIMIT_WINDOW_SECONDS));
  }
  if (attempts > RATE_LIMIT_MAX) {
    await logAttempt({ email, ip, userAgent, result: "rate_limited" });
    return new Response(
      JSON.stringify({ error: "Too many attempts. Please try again in 15 minutes." }),
      { status: 429 }
    );
  }

  const valid = await verifyPassword(password, process.env.MYWORK_PASSWORD_HASH);

  await logAttempt({ email, ip, userAgent, result: valid ? "success" : "failure" });

  if (!valid) {
    return new Response(
      JSON.stringify({ error: "Incorrect password. Please try again." }),
      { status: 401 }
    );
  }

  // Same session shape/cookie name/lifetime video-url.js already expects.
  const exp = Date.now() + 10 * 60 * 1000;
  const payload = `${email}|${exp}`;
  const signature = await hmac(payload);
  const token = `${base64url(payload)}.${signature}`;

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `portfolio_session=${token}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Strict`,
    },
  });
}

async function logAttempt({ email, ip, userAgent, result }) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    email,
    ip,
    userAgent,
    result,
  });
  try {
    await redis("LPUSH", "portfolio:access_log", entry);
    await redis("LTRIM", "portfolio:access_log", "0", "999");
  } catch {
    // Never let logging failures block or reveal anything to the client.
  }
}
