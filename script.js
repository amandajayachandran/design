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
  var heroWords = heroMassive ? heroMassive.querySelectorAll(".hero-word") : null;

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
    };

    var layoutHeroOverlay = function () {
      if (window.innerWidth <= MOBILE_BREAKPOINT) {
        clearOverlayStyles();
        return;
      }

      var bleedRect = heroBleed.getBoundingClientRect();
      var firstWordRect = heroWords[0].getBoundingClientRect();
      var secondWordRect = heroWords[1].getBoundingClientRect();

      var gapX = (firstWordRect.right + secondWordRect.left) / 2;

      // The letters are now real elements (split above), so the last
      // letter of "Creative" and the first "R" of "Director" can be
      // measured directly -- no DOM Range approximation or safety
      // margin needed, since a real element's bounding box is exact.
      var creativeLetters = heroWords[0].querySelectorAll(".hero-letter");
      var lastELeft = creativeLetters.length
        ? creativeLetters[creativeLetters.length - 1].getBoundingClientRect().left
        : firstWordRect.right;

      var fontSizePx = parseFloat(getComputedStyle(heroMassive).fontSize) || 0;

      var photoWidth = heroPhoto.getBoundingClientRect().width;
      var minCenterX = lastELeft + photoWidth / 2;
      var centerX = Math.max(gapX, minCenterX);

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

      if (heroSpecialties) {
        heroSpecialties.style.marginLeft = "0px";
        var specialtiesRect = heroSpecialties.getBoundingClientRect();
        var photoLeftViewport = heroPhoto.getBoundingClientRect().left;
        var desiredLeftViewport = photoLeftViewport - 200;
        var marginAdjustment = desiredLeftViewport - specialtiesRect.left;
        heroSpecialties.style.marginLeft = marginAdjustment + "px";
      }

      if (heroSection) {
        heroSection.style.paddingBottom = "";
        var heroSectionRect = heroSection.getBoundingClientRect();
        var photoBottomViewport = heroPhoto.getBoundingClientRect().bottom;
        var clearance = 48;
        var overflowPast = photoBottomViewport + clearance - heroSectionRect.bottom;
        if (overflowPast > 0) {
          var currentPaddingBottom = parseFloat(getComputedStyle(heroSection).paddingBottom) || 0;
          heroSection.style.paddingBottom = (currentPaddingBottom + overflowPast) + "px";
        }
      }
    };

    layoutHeroOverlay();
    window.addEventListener("resize", layoutHeroOverlay);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(layoutHeroOverlay);
    }
    window.addEventListener("load", layoutHeroOverlay);

    var heroPhotoImg = heroPhoto.querySelector("img");
    if (heroPhotoImg && !heroPhotoImg.complete) {
      heroPhotoImg.addEventListener("load", layoutHeroOverlay);
    }

    setTimeout(layoutHeroOverlay, 300);
    setTimeout(layoutHeroOverlay, 1000);
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
