// Amanda Jayachandran — design skeleton
// Small, deliberate interactions only. No framework required.

(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // ---- Request-portfolio email: try the default mail app first;
  // if the tab hasn't lost focus shortly after (a sign no app opened),
  // fall back to showing provider-specific web-compose options. This
  // is a heuristic -- browsers don't expose true mailto success/failure.
  var ctaBtn = document.getElementById("mywork-cta-btn");
  var ctaMenu = document.getElementById("mywork-cta-menu");
  var ctaMailto = "mailto:amanda.jayachandran@gmail.com?subject=Request%20To%20See%20My%20Portfolio";
  if (ctaBtn && ctaMenu) {
    var closeCtaMenu = function () {
      ctaMenu.hidden = true;
      ctaBtn.setAttribute("aria-expanded", "false");
    };
    var openCtaMenu = function () {
      ctaMenu.hidden = false;
      ctaBtn.setAttribute("aria-expanded", "true");

      // Flip the menu above the button if there isn't enough room
      // below it in the current viewport, so it's never cut off.
      ctaMenu.classList.remove("mywork-cta-menu--up");
      var menuHeight = ctaMenu.offsetHeight;
      var btnRect = ctaBtn.getBoundingClientRect();
      var spaceBelow = window.innerHeight - btnRect.bottom;
      if (spaceBelow < menuHeight + 16) {
        ctaMenu.classList.add("mywork-cta-menu--up");
      }
    };

    var ctaFallbackTimer = null;
    var ctaMailAppOpened = false;

    var onCtaBlur = function () {
      ctaMailAppOpened = true;
      if (ctaFallbackTimer) clearTimeout(ctaFallbackTimer);
      window.removeEventListener("blur", onCtaBlur);
      document.removeEventListener("visibilitychange", onCtaVisibility);
    };
    var onCtaVisibility = function () {
      if (document.hidden) onCtaBlur();
    };

    ctaBtn.addEventListener("click", function (e) {
      e.stopPropagation();

      // Already showing the fallback menu from a prior failed attempt:
      // just toggle it instead of re-triggering mailto.
      if (!ctaMenu.hidden) {
        closeCtaMenu();
        return;
      }

      ctaMailAppOpened = false;
      window.addEventListener("blur", onCtaBlur);
      document.addEventListener("visibilitychange", onCtaVisibility);

      window.location.href = ctaMailto;

      ctaFallbackTimer = setTimeout(function () {
        window.removeEventListener("blur", onCtaBlur);
        document.removeEventListener("visibilitychange", onCtaVisibility);
        if (!ctaMailAppOpened) openCtaMenu();
      }, 600);
    });

    document.addEventListener("click", function (e) {
      if (!ctaMenu.hidden && !ctaMenu.contains(e.target) && e.target !== ctaBtn) {
        closeCtaMenu();
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeCtaMenu();
    });
  }

  // ---- Resume modal ----
  var resumeTrigger = document.getElementById("resume-trigger");
  var resumeModal = document.getElementById("resume-modal");
  var resumeOverlay = document.getElementById("resume-modal-overlay");
  var resumeClose = document.getElementById("resume-modal-close");
  if (resumeTrigger && resumeModal) {
    var openResume = function (e) {
      e.preventDefault();
      resumeModal.classList.add("is-open");
      resumeModal.setAttribute("aria-hidden", "false");
    };
    var closeResume = function () {
      resumeModal.classList.remove("is-open");
      resumeModal.setAttribute("aria-hidden", "true");
    };
    resumeTrigger.addEventListener("click", openResume);
    resumeOverlay.addEventListener("click", closeResume);
    resumeClose.addEventListener("click", closeResume);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeResume();
    });
  }

  // ---- Header: solid background once the page has scrolled ----
  var header = document.querySelector("[data-header]");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // ---- Mobile nav: hamburger toggle opens/closes the dropdown,
  // closes on link click or on resizing past the mobile breakpoint ----
  var navToggle = document.querySelector(".nav-toggle");
  var primaryNav = document.querySelector(".nav");
  if (navToggle && primaryNav) {
    var closeNav = function () {
      primaryNav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    };
    var toggleNav = function () {
      var isOpen = primaryNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    };
    navToggle.addEventListener("click", toggleNav);
    primaryNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeNav);
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 860) closeNav();
    });
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

  // ---- Hero overlay: position the headshot centered on the hero
  // section itself, and stretch the tagline between the headshot's
  // right edge and the headline's right edge. ----
  var heroTagline = document.querySelector(".hero-tagline");
  var heroPhoto = document.querySelector(".hero-photo");
  var heroMassive = document.querySelector(".hero-massive");
  var heroBleed = document.querySelector(".hero-full-bleed");
  var heroSpecialties = document.querySelector(".hero-specialties");
  var heroSection = document.querySelector(".hero");
  var heroBackdrop = document.querySelector(".hero-backdrop");
  var heroWords = heroMassive ? heroMassive.querySelectorAll(".hero-word") : null;

  // Single source of truth for spacing: the gap from the rectangle's
  // border to the specialties text, from the specialties text to the
  // photo, and from the photo to the rectangle's border, are all the
  // same value.
  var HERO_GAP = 32;

  // Split each word into one <span class="hero-letter"> per character,
  // tagged with --i (its position across both words combined) for the
  // staggered sweep animation.
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
  // continuous load sequence, then keep bouncing it back and forth
  // (left-to-right, then right-to-left, forever) by re-triggering the
  // same animation with the letter order reversed each time. This is
  // deliberately simple -- no animationend detection, no visibility
  // observer -- just a fixed, known timing loop, since the earlier
  // event-based approach proved unreliable in at least one real
  // browser even though it worked correctly in testing here.
  if (heroMassive && heroLetters.length && !prefersReducedMotion) {
    var SWEEP_STAGGER_MS = 90;
    var SWEEP_DURATION_MS = 800;
    var SWEEP_PASS_GAP_MS = 300;
    var sweepPassLength =
      (heroLetters.length - 1) * SWEEP_STAGGER_MS + SWEEP_DURATION_MS;

    var sweepForward = true;

    var triggerSweepPass = function () {
      heroLetters.forEach(function (letter, idx) {
        var effectiveIndex = sweepForward ? idx : (heroLetters.length - 1 - idx);
        letter.style.setProperty("--i", effectiveIndex);
      });

      // Force the animation to restart from the beginning with the
      // new --i values: removing the class, forcing the browser to
      // register that removal (reading a layout property forces this),
      // then re-adding it.
      heroMassive.classList.remove("is-sweeping");
      void heroMassive.offsetWidth;
      heroMassive.classList.add("is-sweeping");

      sweepForward = !sweepForward;
      setTimeout(triggerSweepPass, sweepPassLength + SWEEP_PASS_GAP_MS);
    };

    setTimeout(triggerSweepPass, 1050);
  }

  if (heroTagline && heroPhoto && heroMassive && heroBleed && heroWords && heroWords.length >= 2) {
    var MOBILE_BREAKPOINT = 860;

    // Hidden until the first real layout pass completes, so nothing
    // ever visibly snaps into position after the webfont swaps in.
    var hideOverlayUntilPositioned = function () {
      if (window.innerWidth <= MOBILE_BREAKPOINT) return;
      heroPhoto.style.opacity = "0";
      heroTagline.style.opacity = "0";
      if (heroBackdrop) heroBackdrop.style.opacity = "0";
      if (heroSpecialties) heroSpecialties.style.opacity = "0";
    };

    var revealOverlay = function () {
      heroPhoto.style.opacity = "";
      heroTagline.style.opacity = "";
      if (heroBackdrop) heroBackdrop.style.opacity = "";
      if (heroSpecialties) heroSpecialties.style.opacity = "";
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
      var secondWordRect = heroWords[1].getBoundingClientRect();
      var fontSizePx = parseFloat(getComputedStyle(heroMassive).fontSize) || 0;

      // Center the headshot on the hero section's own box, not on the
      // gap between the two headline words -- that gap only lines up
      // with true center when both words happen to render the exact
      // same width, which isn't guaranteed and isn't stable across
      // font-load timing. This anchor is fixed for a given viewport
      // width, so the result is identical on every reload.
      var centerX = (bleedRect.left + bleedRect.right) / 2;

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
        // Position the specialties block so its right edge -- the end
        // of its widest line, the "n" in "Creation" -- sits exactly
        // HERO_GAP px left of the photo. Same constant as the
        // rectangle's own padding, so the two gaps match.
        heroSpecialties.style.marginLeft = "0px";
        var specialtiesRect = heroSpecialties.getBoundingClientRect();
        var photoLeftViewport = heroPhoto.getBoundingClientRect().left;
        var desiredRightViewport = photoLeftViewport - HERO_GAP;
        var marginAdjustment = desiredRightViewport - specialtiesRect.right;
        heroSpecialties.style.marginLeft = marginAdjustment + "px";
      }

      // Backdrop: a faint rectangle behind both the headshot and the
      // specialty list, padded by HERO_GAP on every side -- the same
      // value used for the specialties-to-photo gap above, so the
      // border-to-text, text-to-photo, and photo-to-border gaps all
      // read as identical.
      if (heroBackdrop && heroSpecialties) {
        var finalPhotoRect = heroPhoto.getBoundingClientRect();
        var finalSpecialtiesRect = heroSpecialties.getBoundingClientRect();

        var backdropLeft = Math.min(finalPhotoRect.left, finalSpecialtiesRect.left) - HERO_GAP;
        var backdropRight = Math.max(finalPhotoRect.right, finalSpecialtiesRect.right) + HERO_GAP;
        var backdropTop = Math.min(finalPhotoRect.top, finalSpecialtiesRect.top) - HERO_GAP;
        var backdropBottom = Math.max(finalPhotoRect.bottom, finalSpecialtiesRect.bottom) + HERO_GAP;

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

    // Keep the overlay invisible until the layout below is confirmed
    // against the real, settled state -- not revealed by this first
    // pass, which runs before the entrance animation has even started
    // moving (so its numbers are expected to be wrong; that's fine,
    // nothing is visible yet).
    //
    // The hide itself must be instant here, not eased: these elements
    // have no inline opacity yet, so without disabling the transition
    // first, "hide" would smoothly fade out from the default-visible
    // state over 0.25s -- which means the wrong initial position is
    // still visible, just fading, for that quarter second.
    heroPhoto.style.transition = "none";
    heroTagline.style.transition = "none";
    if (heroBackdrop) heroBackdrop.style.transition = "none";
    if (heroSpecialties) heroSpecialties.style.transition = "none";
    hideOverlayUntilPositioned();
    layoutHeroOverlay();
    // Force the "no transition" hide to actually apply this frame
    // before restoring the transition, so the later reveal still
    // fades in smoothly rather than inheriting "none".
    void heroPhoto.offsetHeight;
    heroPhoto.style.transition = "";
    heroTagline.style.transition = "";
    if (heroBackdrop) heroBackdrop.style.transition = "";
    if (heroSpecialties) heroSpecialties.style.transition = "";

    // The headline's entrance animation (words sliding up from below,
    // ~0.9s duration + up to 0.16s stagger) is still moving the words
    // for about a second after load. Measuring their position during
    // that window gives inconsistent, sometimes-wrong results --
    // confirmed by testing: the same viewport measured a few hundred
    // milliseconds apart can produce noticeably different rects. Wait
    // for the animation to actually report completion rather than
    // guessing a delay, then reposition and reveal together.
    var finalizeLayout = function () {
      layoutHeroOverlay();
      revealOverlay();
    };

    if (prefersReducedMotion) {
      // No entrance animation plays in this case (disabled via CSS),
      // so the words are already in their final position -- no need
      // to wait for anything beyond fonts.
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(finalizeLayout);
      } else {
        finalizeLayout();
      }
    } else {
      var settledCount = 0;
      var onWordAnimationEnd = function (event) {
        // animationend bubbles, and each letter span later runs its own
        // sweep animation -- filter to just the entrance animation so
        // those don't get miscounted as "the word has settled".
        if (event.animationName !== "line-up") return;
        settledCount++;
        if (settledCount >= heroWords.length) {
          finalizeLayout();
        }
      };
      heroWords.forEach(function (word) {
        word.addEventListener("animationend", onWordAnimationEnd);
      });

      // Belt-and-suspenders: if the animation never fires for any
      // reason (e.g. is-ready never gets added), don't leave the
      // overlay hidden forever.
      setTimeout(finalizeLayout, 2000);
    }

    window.addEventListener("resize", layoutHeroOverlay);
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
        var words = text.split(" ");
        words.forEach(function (word, wordIndex) {
          var wordSpan = document.createElement("span");
          wordSpan.className = "statement-word";
          word.split("").forEach(function (ch) {
            var span = document.createElement("span");
            span.className = "letter";
            span.textContent = ch;
            wordSpan.appendChild(span);
          });
          line.appendChild(wordSpan);
          if (wordIndex < words.length - 1) {
            line.appendChild(document.createTextNode(" "));
          }
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
