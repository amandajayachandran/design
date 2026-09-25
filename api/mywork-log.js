// /api/mywork-log.js
//
// Admin-only endpoint for the /mywork/log page. Verifies a SEPARATE admin
// password (not the visitor portfolio password), issues a short signed
// session cookie, and returns the portfolio access log on GET.
//
// Required environment variables:
//   KV_REST_API_URL
//   KV_REST_API_TOKEN
//   SESSION_SECRET             same value already used by video-url.js / verify-access.js
//   MYWORK_LOG_PASSWORD_HASH   format: "iterations:saltHex:hashHex"

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

function base64url(bytes) {
  return Buffer.from(bytes)
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

async function hmac(payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(process.env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64url(new Uint8Array(sig));
}

async function verifyPassword(password, storedHash) {
  const [iterationsStr, saltHex, hashHex] = storedHash.split(":");
  const iterations = parseInt(iterationsStr, 10);
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
  const computedHex = Buffer.from(derivedBits).toString("hex");
  return timingSafeEqual(computedHex, hashHex);
}

function getCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

function getClientIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function makeSessionToken() {
  const payload = JSON.stringify({ role: "log_admin", exp: Date.now() + 30 * 60 * 1000 });
  const encodedPayload = base64url(new TextEncoder().encode(payload));
  const sig = await hmac(encodedPayload);
  return `${encodedPayload}.${sig}`;
}

async function verifySessionToken(token) {
  if (!token) return false;
  const [encodedPayload, sig] = token.split(".");
  if (!encodedPayload || !sig) return false;
  const expectedSig = await hmac(encodedPayload);
  if (!timingSafeEqual(sig, expectedSig)) return false;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
    if (payload.role !== "log_admin") return false;
    if (Date.now() > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}

export async function POST(request) {
  let password;
  try {
    const body = await request.json();
    password = String(body.password || "");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400 });
  }

  const ip = getClientIp(request);

  const rlKey = `portfolio:log_ratelimit:${ip}`;
  const attempts = await redis("INCR", rlKey);
  if (attempts === 1) {
    await redis("EXPIRE", rlKey, "900");
  }
  if (attempts > 5) {
    return new Response(JSON.stringify({ error: "Too many attempts. Try again later." }), { status: 429 });
  }

  if (!password) {
    return new Response(JSON.stringify({ error: "Password is required." }), { status: 400 });
  }

  const isValid = await verifyPassword(password, process.env.MYWORK_LOG_PASSWORD_HASH);

  if (!isValid) {
    return new Response(JSON.stringify({ ok: false, error: "Incorrect password." }), { status: 401 });
  }

  const token = await makeSessionToken();

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `mywork_log_session=${token}; Path=/; Max-Age=1800; HttpOnly; Secure; SameSite=Strict`,
    },
  });
}

export async function GET(request) {
  const token = getCookie(request, "mywork_log_session");
  const isValid = await verifySessionToken(token);

  if (!isValid) {
    return new Response(JSON.stringify({ error: "Not authenticated." }), { status: 401 });
  }

  const rawEntries = await redis("LRANGE", "portfolio:access_log", "0", "999");
  const entries = (rawEntries || [])
    .map((raw) => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return new Response(JSON.stringify({ entries }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
