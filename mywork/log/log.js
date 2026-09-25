// /mywork/log/log.js
//
// Password gate for the admin access-log page. POSTs the admin password to
// /api/mywork-log to authenticate (sets an httpOnly session cookie), then
// fetches the log entries from the same endpoint and renders them as a table.

const gateForm = document.getElementById("gate-form");
const gateStatus = document.getElementById("gate-status");
const gateSubmit = document.getElementById("gate-submit");
const stepGate = document.getElementById("step-gate");
const stepTable = document.getElementById("step-table");
const logRows = document.getElementById("log-rows");
const logEmpty = document.getElementById("log-empty");
const tableMeta = document.getElementById("table-meta");
const refreshBtn = document.getElementById("refresh-btn");

const passwordInput = document.getElementById("admin-password");
const passwordToggle = document.getElementById("password-toggle");
const eyeOpen = document.getElementById("eye-open");
const eyeClosed = document.getElementById("eye-closed");

passwordToggle.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";
  eyeOpen.hidden = isPassword;
  eyeClosed.hidden = !isPassword;
  passwordToggle.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function resultBadge(result) {
  const cls =
    result === "success" ? "log-badge log-badge--success" :
    result === "rate_limited" ? "log-badge log-badge--warn" :
    "log-badge log-badge--fail";
  return `<span class="${cls}">${escapeHtml(result)}</span>`;
}

function renderRows(entries) {
  if (!entries.length) {
    logRows.innerHTML = "";
    logEmpty.hidden = false;
    return;
  }
  logEmpty.hidden = true;
  logRows.innerHTML = entries
    .map((entry) => {
      const ts = entry.timestamp ? new Date(entry.timestamp).toLocaleString("en-US", { timeZone: "UTC", hour12: false }) : "—";
      return `<tr>
        <td>${escapeHtml(ts)}</td>
        <td>${escapeHtml(entry.email || "—")}</td>
        <td>${escapeHtml(entry.ip || "—")}</td>
        <td>${resultBadge(entry.result || "unknown")}</td>
        <td class="log-ua" title="${escapeHtml(entry.userAgent || "")}">${escapeHtml(entry.userAgent || "—")}</td>
      </tr>`;
    })
    .join("");
}

async function loadLog() {
  tableMeta.textContent = "Loading…";
  try {
    const res = await fetch("/api/mywork-log", { method: "GET" });
    if (res.status === 401) {
      stepTable.hidden = true;
      stepGate.hidden = false;
      gateStatus.textContent = "Session expired. Enter the password again.";
      gateStatus.className = "log-status log-status--error";
      return;
    }
    if (!res.ok) throw new Error("Failed to load log");
    const data = await res.json();
    renderRows(data.entries || []);
    const count = (data.entries || []).length;
    tableMeta.textContent = `${count} attempt${count === 1 ? "" : "s"} logged (most recent first).`;
  } catch (err) {
    tableMeta.textContent = "Couldn't load the log. Try refreshing.";
  }
}

gateForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  gateStatus.textContent = "";
  gateSubmit.disabled = true;
  gateSubmit.textContent = "Checking…";

  try {
    const res = await fetch("/api/mywork-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: passwordInput.value }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 429) {
      gateStatus.textContent = "Too many attempts. Try again later.";
      gateStatus.className = "log-status log-status--error";
      return;
    }
    if (!res.ok || !data.ok) {
      gateStatus.textContent = "Incorrect password.";
      gateStatus.className = "log-status log-status--error";
      return;
    }

    stepGate.hidden = true;
    stepTable.hidden = false;
    loadLog();
  } catch (err) {
    gateStatus.textContent = "Something went wrong. Try again.";
    gateStatus.className = "log-status log-status--error";
  } finally {
    gateSubmit.disabled = false;
    gateSubmit.textContent = "View Log";
  }
});

refreshBtn.addEventListener("click", loadLog);
