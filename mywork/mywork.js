// mywork gate: verify email+password -> load signed video URL.
// No password, video URL, or credential is ever present in this file --
// everything is validated and issued server-side in /api/verify-access
// and /api/video-url.

(function () {
  "use strict";

  var stepGate = document.getElementById("step-gate");
  var stepVideo = document.getElementById("step-video");

  var gateForm = document.getElementById("gate-form");
  var gateStatus = document.getElementById("gate-status");
  var gateButton = gateForm.querySelector(".mywork-button");

  var currentEmail = "";

  function showStep(step) {
    [stepGate, stepVideo].forEach(function (el) {
      el.hidden = el !== step;
    });
  }

  function setStatus(el, message, isError) {
    el.textContent = message;
    el.classList.toggle("mywork-status--error", !!isError);
  }

  gateForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var email = document.getElementById("email-input").value.trim();
    var password = document.getElementById("password-input").value;

    gateButton.disabled = true;
    setStatus(gateStatus, "Checking...", false);

    fetch("/api/verify-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "Incorrect password. Please try again.");
          return data;
        });
      })
      .then(function () {
        // The session lives in an httpOnly cookie set by the server
        // (Set-Cookie on the verify-access response) -- it's never
        // readable from JS and is sent automatically on the next
        // same-origin request below.
        currentEmail = email;
        loadVideo();
      })
      .catch(function (err) {
        gateButton.disabled = false;
        setStatus(gateStatus, err.message, true);
      });
  });

  function loadVideo() {
    fetch("/api/video-url", { method: "POST" })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "Could not load video.");
          return data;
        });
      })
      .then(function (data) {
        var video = document.getElementById("mywork-video");
        video.src = data.url;

        var watermark = document.getElementById("video-watermark");
        var stamp = currentEmail + " -- " + new Date().toLocaleString();
        watermark.textContent = stamp;

        showStep(stepVideo);
        video.play().catch(function () {});
      })
      .catch(function (err) {
        gateButton.disabled = false;
        setStatus(gateStatus, err.message, true);
        showStep(stepGate);
      });
  }

  // Mild friction: pause playback if the tab loses focus.
  document.addEventListener("visibilitychange", function () {
    var video = document.getElementById("mywork-video");
    if (video && document.hidden && !video.paused) {
      video.pause();
    }
  });
})();
