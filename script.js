// Amanda Jayachandran — design skeleton
// Small, deliberate interactions only. No framework required.

(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // ---- Header: solid background once the page has scrolled ----
  var header = document.querySelector("[data-header]");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // ---- Hero reveal: trigger the single orchestrated load-in ----
  var heroLine = document.querySelector("[data-reveal]");
  if (heroLine) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        heroLine.classList.add("is-ready");
      });
    });
  }

  // ---- Hero overlay: position the headshot at the Creative/Director gap
  // (tucked behind the text baseline) and stretch the tagline between the
  // headshot's right edge and the headline's right edge. ----
  var heroTagline = document.querySelector(".hero-tagline");
  var heroPhoto = document.querySelector(".hero-photo");
  var heroMassive = document.querySelector(".hero-massive");
  var heroBleed = document.querySelector(".hero-full-bleed");
  var heroSpecialties = document.querySelector(".hero-specialties");
  var heroSection = document.querySelector(".hero");
  var heroBackdrop = document.querySelector(".hero-backdrop");
  var heroWords = heroMassive ? heroMassive.querySelectorAll(".hero-word") : null;

  // Single source of truth for spacing: the gap from the rectangle's
  // left edge to the specialty list, from the specialty list's right
  // edge to the headshot, and from the headshot's right edge to the
  // rectangle's right edge are all this same value.
  var GUTTER = 32;

  // Split each word into one <span class="hero-letter"> per character,
  // tagged with --i (its position across both words combined) for the
  // staggered sweep animation. Doing this up front -- before any
  // position measurement below -- means the E/R lookups can measure
  // real letter elements directly instead of approximating from text.
  var heroLetters = [];
  if (heroWords && heroWords.length >= 2) {
    var letterIndex = 0;
    heroWords.forEach(function (word) {
      var text = word.textContent;
      word.textContent = "";
      text.split("").forEach(function (ch) {
        var span = document.createElement("span");
        span.className = "hero-letter";
        span.style.setProperty("--i", letterIndex);
        span.textContent = ch;
        word.appendChild(span);
        heroLetters.push(span);
        letterIndex++;
      });
    });
  }

  // Start the letter sweep once the entrance settles (0.9s duration +
  // up to 0.16s stagger on the two words) so it reads as one
  // continuous load sequence: words slide up, then the highlight
  // travels across them. Runs once; skipped entirely under reduced
  // motion, same as the site's other motion effects.
  if (heroMassive && heroLetters.length && !prefersReducedMotion) {
    setTimeout(function () {
      heroMassive.classList.add("is-sweeping");
    }, 1050);
  }

  if (heroTagline && heroPhoto && heroMassive && heroBleed && heroWords && heroWords.length >= 2) {
    var MOBILE_BREAKPOINT = 860;

    // Hidden until the authoritative layout pass completes, so the
    // photo/tagline/backdrop never visibly snap or jump into place --
    // whether that's from the webfont swapping in or from the
    // headline's slide-up animation still being in motion (its
    // transform briefly affects getBoundingClientRect on the words,
    // which would otherwise throw off the one-time measurement).
    var hideOverlayUntilPositioned = function () {
      if (window.innerWidth <= MOBILE_BREAKPOINT) return;
      heroPhoto.style.opacity = "0";
      heroTagline.style.opacity = "0";
      if (heroBackdrop) heroBackdrop.style.opacity = "0";
    };

    var revealOverlay = function () {
      heroPhoto.style.opacity = "";
      heroTagline.style.opacity = "";
      if (heroBackdrop) heroBackdrop.style.opacity = "";
    };

    var clearOverlayStyles = function () {
      heroPhoto.style.left = "";
      heroPhoto.style.top = "";
      heroTagline.style.left = "";
      heroTagline.style.top = "";
      heroTagline.style.width = "";
      if (heroSpecialties) {
        heroSpecialties.style.marginLeft = "";
      }
      if (heroSection) {
        heroSection.style.paddingBottom = "";
      }
      if (heroBackdrop) {
        heroBackdrop.style.left = "";
        heroBackdrop.style.top = "";
        heroBackdrop.style.width = "";
        heroBackdrop.style.height = "";
      }
      revealOverlay();
    };

    var layoutHeroOverlay = function () {
      if (window.innerWidth <= MOBILE_BREAKPOINT) {
        clearOverlayStyles();
        return;
      }

      var bleedRect = heroBleed.getBoundingClientRect();
      var firstWordRect = heroWords[0].getBoundingClientRect();
      var secondWordRect = heroWords[1].getBoundingClientRect();

      // The letters are real elements (split above), so the last
      // letter of "Creative" can be measured directly -- used only as
      // a floor, to keep the photo from overlapping the headline.
      var creativeLetters = heroWords[0].querySelectorAll(".hero-letter");
      var lastELeft = creativeLetters.length
        ? creativeLetters[creativeLetters.length - 1].getBoundingClientRect().left
        : firstWordRect.right;

      var fontSizePx = parseFloat(getComputedStyle(heroMassive).fontSize) || 0;
      var photoWidth = heroPhoto.getBoundingClientRect().width;

      // The headshot's default horizontal position is the center of
      // the page itself (the full-bleed section spans the viewport),
      // not the gap between the two headline words -- so it stays put
      // at the same spot regardless of viewport width or how the
      // words happen to kern. It only shifts right of that if the
      // headline is wide enough to otherwise sit under "Creative".
      var pageCenterX = bleedRect.left + bleedRect.width / 2;
      var minCenterX = lastELeft + photoWidth / 2;
      var centerX = Math.max(pageCenterX, minCenterX);

      var trueBaseline = secondWordRect.bottom - fontSizePx * 0.22;
      var baselineY = trueBaseline - fontSizePx * 0.1;

      heroPhoto.style.left = (centerX - bleedRect.left) + "px";
      heroPhoto.style.top = (baselineY - bleedRect.top) + "px";

      var directorLetters = heroWords[1].querySelectorAll(".hero-letter");
      var firstRRight = directorLetters.length > 2
        ? directorLetters[2].getBoundingClientRect().right
        : secondWordRect.left;

      var taglineLeft = firstRRight - bleedRect.left;
      var taglineRight = secondWordRect.right - bleedRect.left;
      var headlineBottom = heroMassive.getBoundingClientRect().bottom - bleedRect.top;

      heroTagline.style.left = taglineLeft + "px";
      heroTagline.style.width = Math.max(taglineRight - taglineLeft, 40) + "px";
      heroTagline.style.top = (headlineBottom + 12) + "px";

      // Pin the specialty list's right edge exactly GUTTER px away
      // from the headshot's left edge -- the same distance used for
      // the rectangle's own padding below, so all three gaps
      // (rectangle-to-list, list-to-photo, photo-to-rectangle) match.
      if (heroSpecialties) {
        heroSpecialties.style.marginLeft = "0px";
        var specialtiesRect = heroSpecialties.getBoundingClientRect();
        var photoLeftViewport = heroPhoto.getBoundingClientRect().left;
        var desiredRightViewport = photoLeftViewport - GUTTER;
        var marginAdjustment = desiredRightViewport - specialtiesRect.right;
        heroSpecialties.style.marginLeft = marginAdjustment + "px";
      }

      // Backdrop: a faint rectangle behind both the headshot and the
      // specialty list, padded by the same GUTTER on every side so the
      // rectangle-to-content spacing matches the list-to-photo and
      // photo-to-rectangle spacing exactly.
      if (heroBackdrop && heroSpecialties) {
        var finalPhotoRect = heroPhoto.getBoundingClientRect();
        var finalSpecialtiesRect = heroSpecialties.getBoundingClientRect();

        var backdropLeft = Math.min(finalPhotoRect.left, finalSpecialtiesRect.left) - GUTTER;
        var backdropRight = Math.max(finalPhotoRect.right, finalSpecialtiesRect.right) + GUTTER;
        var backdropTop = Math.min(finalPhotoRect.top, finalSpecialtiesRect.top) - GUTTER;
        var backdropBottom = Math.max(finalPhotoRect.bottom, finalSpecialtiesRect.bottom) + GUTTER;

        heroBackdrop.style.left = (backdropLeft - bleedRect.left) + "px";
        heroBackdrop.style.top = (backdropTop - bleedRect.top) + "px";
        heroBackdrop.style.width = (backdropRight - backdropLeft) + "px";
        heroBackdrop.style.height = (backdropBottom - backdropTop) + "px";
      }

      if (heroSection) {
        heroSection.style.paddingBottom = "";
        var heroSectionRect = heroSection.getBoundingClientRect();
        var photoBottomViewport = heroPhoto.getBoundingClientRect().bottom;
        var backdropBottomViewport = heroBackdrop
          ? heroBackdrop.getBoundingClientRect().bottom
          : photoBottomViewport;
        var lowestBottomViewport = Math.max(photoBottomViewport, backdropBottomViewport);
        var clearance = 48;
        var overflowPast = lowestBottomViewport + clearance - heroSectionRect.bottom;
        if (overflowPast > 0) {
          var currentPaddingBottom = parseFloat(getComputedStyle(heroSection).paddingBottom) || 0;
          heroSection.style.paddingBottom = (currentPaddingBottom + overflowPast) + "px";
        }
      }
    };

    // Keep the overlay invisible until the authoritative pass below
    // has actually run, so nothing has to jump after the fact.
    hideOverlayUntilPositioned();

    // First pass: establishes a reasonable layout immediately in case
    // fonts are already cached, but stays hidden regardless.
    layoutHeroOverlay();

    // The authoritative pass waits for two things that can each change
    // the measurements above: the webfont actually swapping in, and
    // the headline's slide-up animation finishing (its transform
    // affects getBoundingClientRect while it's still running, which is
    // what previously made the photo/rectangle land in a slightly
    // different spot on every reload). Only once both are settled do
    // we measure for real and reveal the overlay.
    var fontsSettled = (document.fonts && document.fonts.ready)
      ? document.fonts.ready
      : Promise.resolve();

    var revealSettled = new Promise(function (resolve) {
      if (prefersReducedMotion || !heroWords.length) {
        resolve();
        return;
      }
      var remaining = heroWords.length;
      var onAnimEnd = function (event) {
        if (event.animationName !== "line-up") return;
        remaining--;
        if (remaining <= 0) {
          heroWords.forEach(function (w) {
            w.removeEventListener("animationend", onAnimEnd);
          });
          resolve();
        }
      };
      heroWords.forEach(function (w) {
        w.addEventListener("animationend", onAnimEnd);
      });
      // Safety net in case an animationend event is ever missed.
      setTimeout(resolve, 1300);
    });

    Promise.all([fontsSettled, revealSettled]).then(function () {
      layoutHeroOverlay();
      revealOverlay();
    });

    // A live viewport resize is a deliberate, ongoing UX case (not an
    // initial-load timing race), so it recomputes directly.
    var resizeTicking = false;
    window.addEventListener("resize", function () {
      if (resizeTicking) return;
      resizeTicking = true;
      requestAnimationFrame(function () {
        resizeTicking = false;
        layoutHeroOverlay();
      });
    });
  }

  // ---- Statement: letters push away from the cursor and dim, then
  // spring back once the cursor moves on. ----
  var statement = document.querySelector("[data-statement]");
  var statementText = statement ? statement.querySelector(".statement-text") : null;
  var statementLines = statement ? statement.querySelectorAll("[data-line]") : null;

  if (statement && statementText && statementLines && statementLines.length) {
    if ("IntersectionObserver" in window) {
      var revealObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              statementText.classList.add("is-visible");
              revealObserver.unobserve(statement);
            }
          });
        },
        { threshold: 0.2 }
      );
      revealObserver.observe(statement);
    } else {
      statementText.classList.add("is-visible");
    }

    if (!prefersReducedMotion) {
      statementLines.forEach(function (line) {
        var text = line.textContent;
        line.textContent = "";
        text.split("").forEach(function (ch) {
          if (ch === " ") {
            line.appendChild(document.createTextNode(" "));
            return;
          }
          var span = document.createElement("span");
          span.className = "letter";
          span.textContent = ch;
          line.appendChild(span);
        });
      });

      var letters = Array.prototype.slice.call(statement.querySelectorAll(".letter"));
      var letterData = letters.map(function (el) {
        return {
          el: el,
          cx: 0,
          cy: 0,
          active: false,
          jitterX: (Math.random() - 0.5) * 40,
          jitterY: (Math.random() - 0.5) * 40,
          jitterRot: (Math.random() - 0.5) * 60
        };
      });

      var RADIUS = 130;
      var MAX_PUSH = 42;

      var cacheLetterPositions = function () {
        var sectionRect = statement.getBoundingClientRect();
        letterData.forEach(function (d) {
          var r = d.el.getBoundingClientRect();
          d.cx = r.left + r.width / 2 - sectionRect.left;
          d.cy = r.top + r.height / 2 - sectionRect.top;
        });
      };

      cacheLetterPositions();
      window.addEventListener("resize", cacheLetterPositions);
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(cacheLetterPositions);
      }

      var pointerActive = false;
      var pointerX = 0;
      var pointerY = 0;
      var ticking = false;

      var applyPointerEffect = function () {
        ticking = false;
        letterData.forEach(function (d) {
          var dx = d.cx - pointerX;
          var dy = d.cy - pointerY;
          var dist = Math.sqrt(dx * dx + dy * dy);

          if (pointerActive && dist < RADIUS) {
            var factor = 1 - dist / RADIUS;
            var norm = dist === 0 ? 0 : 1 / dist;
            var pushX = dx * norm * MAX_PUSH * factor + d.jitterX * factor;
            var pushY = dy * norm * MAX_PUSH * factor + d.jitterY * factor;
            var rot = d.jitterRot * factor;
            d.el.style.transform =
              "translate(" + pushX.toFixed(1) + "px, " + pushY.toFixed(1) + "px) rotate(" + rot.toFixed(1) + "deg)";
            d.el.style.color = "#D4DC55";
            d.active = true;
          } else if (d.active) {
            d.el.style.transform = "";
            d.el.style.color = "";
            d.active = false;
          }
        });
      };

      var requestUpdate = function () {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(applyPointerEffect);
        }
      };

      statement.addEventListener("pointermove", function (event) {
        var sectionRect = statement.getBoundingClientRect();
        pointerX = event.clientX - sectionRect.left;
        pointerY = event.clientY - sectionRect.top;
        pointerActive = true;
        requestUpdate();
      });

      statement.addEventListener("pointerleave", function () {
        pointerActive = false;
        requestUpdate();
      });

      var lastScrollY = window.scrollY;

      var applyScrollSweep = function () {
        var sectionRect = statement.getBoundingClientRect();
        var localY = window.innerHeight / 2 - sectionRect.top;

        if (localY >= 0 && localY <= sectionRect.height) {
          pointerX = sectionRect.width / 2;
          pointerY = localY;
          pointerActive = true;
          requestUpdate();
        } else if (pointerActive) {
          pointerActive = false;
          requestUpdate();
        }
      };

      var scrollTicking = false;
      window.addEventListener(
        "scroll",
        function () {
          lastScrollY = window.scrollY;
          if (!scrollTicking) {
            scrollTicking = true;
            requestAnimationFrame(function () {
              scrollTicking = false;
              applyScrollSweep();
            });
          }
        },
        { passive: true }
      );

      applyScrollSweep();
    }
  }

  // ---- Footer year ----
  var yearEl = document.querySelector("[data-year]");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
})();
