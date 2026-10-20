// /api/portfolio-pages.js
//
// Returns short-lived signed URLs for the "Additional Portfolio Samples"
// page images on /mywork -- only for a visitor who already entered the
// password (same session cookie and checks as /api/video-url.js).
//
// The page images live in the PRIVATE Vercel Blob store (same store as the
// video), so there is no public link to them anywhere. Each signed URL
// expires after 10 minutes.
//
// Upload the images to Blob named p-01.jpg ... p-11.jpg, ideally inside a
// folder called portfolio/pages/ (e.g. portfolio/pages/p-01.jpg). If they're
// elsewhere in the store, they're still found by name.
// Any number of pages works: p-01, p-02, ... are shown in number order.
// If something fails, the page shows a short code (no-pages, list-failed,
// sign-failed, session) so the cause is easy to pin down.
//
// Required environment variables (already set for the video):
//   BLOB_READ_WRITE_TOKEN
//   SESSION_SECRET
// Optional:
//   PORTFOLIO_PAGES_PREFIX    defaults to "portfolio/pages/"

import { issueSignedToken, presignUrl, list } from "@vercel/blob";

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

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

const PAGE_RE = /(?:^|\/)p-(\d{1,3})(?:-[A-Za-z0-9]{4,})?\.(jpe?g|png|webp)$/i;

async function listAll(prefix) {
  const blobs = [];
  let cursor;
  do {
    const res = await list({ prefix, cursor, limit: 1000 });
    blobs.push(...res.blobs);
    cursor = res.hasMore ? res.cursor : undefined;
  } while (cursor);
  return blobs;
}

export async function POST(request) {
  // ---- Same session check as /api/video-url.js ----
  const cookie = getCookie(request, "portfolio_session");
  if (!cookie || !cookie.includes(".")) {
    return json({ error: "Not authenticated." }, 401);
  }

  const [encodedPayload, signature] = cookie.split(".");
  const payload = fromBase64url(encodedPayload);
  const expectedSignature = await hmac(payload);
  if (signature !== expectedSignature) {
    return json({ error: "Invalid session." }, 401);
  }

  const [email, expStr] = payload.split("|");
  const exp = Number(expStr);
  if (!email || !exp || Date.now() > exp) {
    return json({ error: "Session expired. Please verify again." }, 401);
  }

  // ---- Find the page images in the private Blob store ----
  // Looks in portfolio/pages/ first; if nothing is there, searches the whole
  // store for files named p-01.jpg, p-02.jpg, ... in any folder.
  const prefix = process.env.PORTFOLIO_PAGES_PREFIX || "portfolio/pages/";
  let blobs;
  try {
    blobs = (await listAll(prefix)).filter((b) => PAGE_RE.test(b.pathname));
    if (!blobs.length) {
      blobs = (await listAll(undefined)).filter((b) => PAGE_RE.test(b.pathname));
    }
  } catch (err) {
    console.error("portfolio-pages: Blob list failed:", err);
    return json({ error: "Could not read portfolio storage.", code: "list-failed" }, 500);
  }

  if (!blobs.length) {
    console.error("portfolio-pages: no files named p-01.jpg, p-02.jpg ... found in Blob storage");
    return json({ error: "No portfolio pages found.", code: "no-pages", pages: [] }, 404);
  }

  // If the same page number was uploaded twice, keep the most recent copy.
  const byNumber = new Map();
  for (const b of blobs) {
    const n = Number(b.pathname.match(PAGE_RE)[1]);
    const prev = byNumber.get(n);
    if (!prev || new Date(b.uploadedAt) > new Date(prev.uploadedAt)) byNumber.set(n, b);
  }
  blobs = [...byNumber.values()];

  blobs.sort(
    (a, b) => Number(a.pathname.match(PAGE_RE)[1]) - Number(b.pathname.match(PAGE_RE)[1])
  );

  const validUntil = Date.now() + 10 * 60 * 1000;

  let pages;
  try {
  pages = await Promise.all(
    blobs.map(async (b) => {
      const token = await issueSignedToken({
        pathname: b.pathname,
        operations: ["get"],
        validUntil,
      });
      const { presignedUrl } = await presignUrl(token, {
        operation: "get",
        pathname: b.pathname,
        access: "private",
        validUntil,
      });
      return { n: Number(b.pathname.match(PAGE_RE)[1]), url: presignedUrl };
    })
  );
  } catch (err) {
    console.error("portfolio-pages: signing links failed:", err);
    return json({ error: "Could not create page links.", code: "sign-failed" }, 500);
  }

  return json({ pages });
}
