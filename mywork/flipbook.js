// /mywork/flipbook.js
//
// "Additional Portfolio Samples" page-flip book on /mywork.
// Opens straight to pages 1-2 (no cover), matching the latest portfolio book.
// Nothing loads until the visitor has entered the password: when the video
// step becomes visible, this asks /api/portfolio-pages for short-lived signed
// links to the page images (stored privately in Vercel Blob), then builds
// the book with the page-flip library (/mywork/vendor/page-flip.browser.js).

(function () {
  "use strict";

  var stepVideo = document.getElementById("step-video");
  var wrap = document.getElementById("flipbook-wrap");
  if (!stepVideo || !wrap) return;

  var started = false;

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function setStatus(msg) {
    var s = wrap.querySelector(".flipbook-status");
    if (s) s.textContent = msg;
  }

  function build(pages) {
    var CONTENT = pages.length;
    wrap.innerHTML = "";

    var stage = el("div", "flipbook-stage");
    var book = el("div", "flipbook-book");
    book.setAttribute("aria-label", "Amanda Jayachandran portfolio samples");

    pages.forEach(function (pg, i) {
      var p = el("div", "fb-page");
      var img = document.createElement("img");
      img.src = pg.url;
      img.alt = i === CONTENT - 1 && CONTENT === 11 ? "A sampling of logos" : "Portfolio page " + (i + 1);
      img.draggable = false;
      img.addEventListener("contextmenu", function (e) { e.preventDefault(); });
      p.appendChild(img);
      book.appendChild(p);
    });
    stage.appendChild(book);

    var bar = el("div", "flipbook-bar");
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Page controls");
    bar.innerHTML =
      '<button class="fb-btn" type="button" data-fb="first" aria-label="Back to first page">' +
      '<svg viewBox="0 0 16 16"><path d="M3 3v10M13 3L7 8l6 5"/></svg><span class="fb-lbl">First</span></button>' +
      '<button class="fb-btn" type="button" data-fb="prev" aria-label="Previous page">' +
      '<svg viewBox="0 0 16 16"><path d="M10 3L5 8l5 5"/></svg><span class="fb-lbl">Previous</span></button>' +
      '<div class="fb-counter" aria-live="polite">Page 1 of ' + CONTENT + '</div>' +
      '<button class="fb-btn" type="button" data-fb="next" aria-label="Next page">' +
      '<span class="fb-lbl">Next</span><svg viewBox="0 0 16 16"><path d="M6 3l5 5-5 5"/></svg></button>';

    var hint = el("p", "flipbook-hint", "Drag a page corner, tap a page edge, or use the arrow keys.");

    wrap.appendChild(stage);
    wrap.appendChild(bar);
    wrap.appendChild(hint);

    var allPages = book.querySelectorAll(".fb-page");
    var TOTAL = allPages.length;

    var pf = new St.PageFlip(book, {
      width: 792, height: 612, size: "stretch",
      minWidth: 260, maxWidth: 1100, minHeight: 200, maxHeight: 850,
      showCover: false, usePortrait: true, autoSize: true,
      maxShadowOpacity: 0.45, drawShadow: true, flippingTime: 900,
      mobileScrollSupport: true, swipeDistance: 20, showPageCorners: true
    });
    pf.loadFromHTML(allPages);

    var counter = bar.querySelector(".fb-counter");
    var bPrev = bar.querySelector('[data-fb="prev"]');
    var bNext = bar.querySelector('[data-fb="next"]');
    var bFirst = bar.querySelector('[data-fb="first"]');

    function label(i) {
      var n = i + 1, portrait = pf.getOrientation() === "portrait";
      if (portrait || n >= CONTENT) return "Page " + Math.min(n, CONTENT) + " of " + CONTENT;
      return "Pages " + n + "\u2013" + (n + 1) + " of " + CONTENT;
    }
    function sync() {
      var i = pf.getCurrentPageIndex();
      counter.textContent = label(i);
      bPrev.disabled = i <= 0;
      bFirst.disabled = i <= 0;
      bNext.disabled = pf.getOrientation() === "portrait" ? i >= TOTAL - 1 : i >= TOTAL - 2;
    }
    pf.on("flip", function () { sync(); hint.classList.add("is-gone"); });
    pf.on("changeOrientation", sync);
    pf.on("init", sync);
    sync();

    bPrev.addEventListener("click", function () { pf.flipPrev(); });
    bNext.addEventListener("click", function () { pf.flipNext(); });
    bFirst.addEventListener("click", function () { pf.flip(0); });

    // Arrow keys turn pages, except while typing or controlling the video.
    document.addEventListener("keydown", function (e) {
      if (stepVideo.hidden) return;
      var t = e.target;
      if (t && t.closest && t.closest("video, input, textarea, select, .email-modal")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") { pf.flipNext(); e.preventDefault(); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { pf.flipPrev(); e.preventDefault(); }
    });
  }

  function load() {
    if (started) return;
    started = true;
    setStatus("Loading samples\u2026");

    fetch("/api/portfolio-pages", { method: "POST", credentials: "same-origin" })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok || !data.pages || !data.pages.length) {
            var code = res.status === 401 ? "session" : (data.code || ("http-" + res.status));
            throw new Error(res.status === 401
              ? "Your session expired. Refresh the page and enter the password again to view the samples."
              : "The portfolio samples couldn\u2019t be loaded right now. Please refresh and try again. (code: " + code + ")");
          }
          return data.pages;
        });
      })
      .then(function (pages) {
        if (typeof St === "undefined" || !St.PageFlip) throw new Error("The page viewer couldn\u2019t be loaded. Please refresh and try again.");
        build(pages);
      })
      .catch(function (err) { setStatus(err.message); });
  }

  if (!stepVideo.hidden) {
    load();
  } else {
    new MutationObserver(function (_, obs) {
      if (!stepVideo.hidden) { obs.disconnect(); load(); }
    }).observe(stepVideo, { attributes: true, attributeFilter: ["hidden"] });
  }
})();
