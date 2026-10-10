const API_BASE = location.protocol === "file:" ? "http://localhost:8080" : "";
const MAX_BYTES = 15 * 1024 * 1024;
const $ = id => document.getElementById(id);
const formInput = $("formPdf"), instructionsInput = $("instructionsPdf");
const formFileName = $("formFileName"), instructionsFileName = $("instructionsFileName");
const message = $("uploadMessage"), reviewBtn = $("reviewBtn"), historyList = $("historyList"), language = $("language");

const translations = {
  en: {
    heroTitle: 'Understand your form.<br><span>Submit with confidence.</span>',
    heroDesc: 'Upload a public-service form and its official instructions. FormFill Guardian helps you understand requirements and review missing or unclear information before submission.',
    startBtn: 'Start a review <span aria-hidden="true">→</span>'
  },
  te: {
    heroTitle: 'మీ దరఖాస్తును అర్థం చేసుకోండి.<br><span>నమ్మకంగా సమర్పించండి.</span>',
    heroDesc: 'ప్రభుత్వ సేవల దరఖాస్తు మరియు అధికారిక సూచనల PDFలను అప్‌లోడ్ చేయండి. సమర్పించే ముందు అవసరాలను అర్థం చేసుకోవడానికి, మిస్సైన లేదా స్పష్టతలేని వివరాలను సమీక్షించడానికి FormFill Guardian సహాయపడుతుంది.',
    startBtn: 'సమీక్ష ప్రారంభించండి <span aria-hidden="true">→</span>'
  }
};
language.addEventListener("change", () => {
  const copy = translations[language.value] || translations.en;
  $("heroTitle").innerHTML = copy.heroTitle;
  $("heroDesc").textContent = copy.heroDesc;
  $("startBtn").innerHTML = copy.startBtn;
  document.documentElement.lang = language.value === "te" ? "te" : "en";
});

function setMsg(text, isError) { message.textContent = text; message.className = isError ? "message error" : "message"; }
function formatBytes(b) { return b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`; }
function validType(f) { return /\.(pdf|jpe?g|png)$/i.test(f.name); }

function showFileName(input, target) {
  const file = input.files && input.files[0];
  if (!file) { target.textContent = "No file selected"; return; }
  if (!validType(file)) { input.value = ""; target.textContent = "Please choose a PDF, JPG or PNG file"; setMsg("Only PDF, JPG, JPEG or PNG files are supported.", true); return; }
  if (file.size > MAX_BYTES) { input.value = ""; target.textContent = "File is larger than 15 MB"; setMsg("Each file must be 15 MB or smaller.", true); return; }
  target.textContent = `${file.name} · ${formatBytes(file.size)}`;
  setMsg("", false);
}
formInput.addEventListener("change", () => showFileName(formInput, formFileName));
instructionsInput.addEventListener("change", () => showFileName(instructionsInput, instructionsFileName));

/* ---------- history (browser-local) ---------- */
function getHistory() { try { return JSON.parse(localStorage.getItem("formfill-history") || "[]"); } catch { return []; } }
function saveHistory(items) { try { localStorage.setItem("formfill-history", JSON.stringify(items)); } catch {} }
function renderHistory() {
  const items = getHistory();
  if (!items.length) {
    historyList.className = "history-empty";
    historyList.innerHTML = '<span>▤</span><strong>No reviews yet</strong><p>Run a review to add an entry here.</p>';
    return;
  }
  historyList.className = "history-items";
  historyList.replaceChildren();
  items.slice().reverse().forEach(item => {
    const row = document.createElement("div"); row.className = "history-entry";
    const icon = document.createElement("span"); icon.className = "file-icon"; icon.textContent = "▤";
    const d = document.createElement("div");
    const t = document.createElement("strong"); t.textContent = item.formName;
    const sub = document.createElement("small");
    sub.textContent = `${item.date} · ${item.ok} OK · ${item.missing} Missing · ${item.unclear} Unclear · ${item.instructionName}`;
    d.append(t, sub);
    const tag = document.createElement("span");
    tag.className = "pill " + (item.missing ? "missing-pill" : item.unclear ? "unclear-pill" : "ok-pill");
    tag.textContent = item.missing ? "Needs attention" : item.unclear ? "Check manually" : "Looks good";
    row.append(icon, d, tag);
    historyList.append(row);
  });
}
$("clearHistory").addEventListener("click", () => { saveHistory([]); renderHistory(); });

/* ---------- results ---------- */
function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }

function renderResults(r) {
  $("countOk").textContent = r.counts.ok;
  $("countMissing").textContent = r.counts.missing;
  $("countUnclear").textContent = r.counts.unclear;
  $("reviewSummary").textContent = r.summary || "";
  $("reviewIntro").textContent = `${r.counts.total} item(s) reviewed.`;
  if (r.disclaimer) $("disclaimerText").textContent = r.disclaimer;
  const list = $("checklist"); list.replaceChildren();
  if (!r.items.length) { list.append(el("div", "history-empty", "No items were returned. Try clearer documents.")); return; }
  r.items.forEach((it, i) => {
    const k = it.status.toLowerCase();
    const d = el("details", "check-item"); if (i === 0) d.open = true;
    const sum = el("summary");
    sum.append(el("span", `status-dot ${k}`), el("span", "check-name", it.field), el("span", `pill ${k}-pill`, it.status), el("span", "chevron", "⌄"));
    const body = el("div", "check-detail");
    body.append(el("p", "", it.explanation));
    if (it.suggestedAction) body.append(el("p", "", "👉 " + it.suggestedAction));
    const ev = el("div", "evidence");
    ev.append(el("strong", "", "Official instruction"), el("p", "", `“${it.sourceQuote}”`));
    const src = [it.pageNumber > 0 ? `Page ${it.pageNumber}` : "Page not verified", it.sourceSection].filter(Boolean).join(" · ");
    ev.append(el("small", "", src));
    body.append(ev);
    d.append(sum, body); list.append(d);
  });
}

/* ---------- run review ---------- */
reviewBtn.addEventListener("click", async () => {
  const formFile = formInput.files[0], instrFile = instructionsInput.files[0];
  if (!formFile || !instrFile) { setMsg("Please choose both the application form and the official instructions.", true); return; }
  const data = new FormData();
  data.append("formPdf", formFile);
  data.append("instructionsPdf", instrFile);
  data.append("language", language.value === "te" ? "Telugu" : "English");

  reviewBtn.disabled = true;
  const original = reviewBtn.innerHTML;
  reviewBtn.textContent = "Analyzing…";
  setMsg("Analyzing your documents. This can take up to a minute…", false);
  try {
    const res = await fetch(`${API_BASE}/api/review`, { method: "POST", body: data });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || `Request failed (${res.status})`);
    renderResults(out);
    const h = getHistory();
    h.push({ formName: formFile.name, instructionName: instrFile.name, date: new Date().toLocaleString(), ok: out.counts.ok, missing: out.counts.missing, unclear: out.counts.unclear });
    saveHistory(h.slice(-20)); renderHistory();
    setMsg("Review complete. See your checklist below.", false);
    $("review").scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    setMsg(err.message === "Failed to fetch" ? "Cannot reach the server. Make sure the backend is running (npm run dev) and open http://localhost:8080." : err.message, true);
  } finally {
    reviewBtn.disabled = false; reviewBtn.innerHTML = original;
  }
});
renderHistory();
