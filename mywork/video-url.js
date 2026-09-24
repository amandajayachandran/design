// /api/video-url.js
//
// Returns a short-lived signed URL for the portfolio video -- only if
// the caller presents a valid, unexpired session cookie issued by
// /api/verify-access.js. The video itself is stored as a *private*
// Vercel Blob, so this signed URL is the only way to reach it; it
// expires in 5 minutes regardless of how long the session cookie lasts.
//
// Required environment variables:
//   BLOB_READ_WRITE_TOKEN     added automatically when you create a
//                             Vercel Blob store and connect it to this project
//   SESSION_SECRET            same value used in verify-access.js
//   PORTFOLIO_VIDEO_PATH      optional; defaults to "portfolio/reel.mp4" --
//                             must match the pathname you upload the
//                             video to in Blob

import { issueSignedToken, presignUrl } from "@vercel/blob";

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

function fromBase64url(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64").toString("utf8");
}

function getCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  const match = header.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? match[1] : null;
}

export async function POST(request) {
  const cookie = getCookie(request, "portfolio_session");
  if (!cookie || !cookie.includes(".")) {
    return new Response(JSON.stringify({ error: "Not authenticated." }), { status: 401 });
  }

  const [encodedPayload, signature] = cookie.split(".");
  const payload = fromBase64url(encodedPayload);
  const expectedSignature = await hmac(payload);

  if (signature !== expectedSignature) {
    return new Response(JSON.stringify({ error: "Invalid session." }), { status: 401 });
  }

  const [email, expStr] = payload.split("|");
  const exp = Number(expStr);

  if (!email || !exp || Date.now() > exp) {
    return new Response(JSON.stringify({ error: "Session expired. Please verify again." }), { status: 401 });
  }

  const pathname = process.env.PORTFOLIO_VIDEO_PATH || "portfolio/reel.mp4";

  const token = await issueSignedToken({
    pathname,
    operations: ["get"],
    validUntil: Date.now() + 10 * 60 * 1000,
  });

  const { presignedUrl } = await presignUrl(token, {
    operation: "get",
    pathname,
    access: "private",
    validUntil: Date.now() + 5 * 60 * 1000,
  });

  return new Response(JSON.stringify({ url: presignedUrl, email }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
