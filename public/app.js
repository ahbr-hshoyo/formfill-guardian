// Same-origin by default (backend serves this page). Change if hosting the frontend elsewhere.
const API_BASE = "";
const $ = id => document.getElementById(id);
const MAX = 15 * 1024 * 1024;

$("reviewForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = $("formFile").files[0], instr = $("instructionsFile").files[0];
  const status = $("status");
  status.className = "";
  for (const f of [form, instr]) {
    if (f && f.size > MAX) { status.className = "error"; status.textContent = `${f.name} is larger than 15 MB.`; return; }
  }
  const data = new FormData();
  data.append("formPdf", form);
  data.append("instructionsPdf", instr);
  data.append("language", $("language").value);

  $("submitBtn").disabled = true;
  $("results").hidden = true;
  status.textContent = "Analyzing your documents… this can take 20–60 seconds.";
  try {
    const res = await fetch(`${API_BASE}/api/review`, { method: "POST", body: data });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || `Request failed (${res.status})`);
    render(out);
    status.textContent = "";
  } catch (err) {
    status.className = "error";
    status.textContent = err.message === "Failed to fetch"
      ? "Cannot reach the server. Is the backend running?" : err.message;
  } finally {
    $("submitBtn").disabled = false;
  }
});

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function render(r) {
  $("summary").textContent = r.summary || "";
  const counts = $("counts"); counts.replaceChildren();
  [["OK", r.counts.ok], ["Missing", r.counts.missing], ["Unclear", r.counts.unclear]].forEach(([k, v]) => {
    const c = el("div", `count ${k}`, k); const n = el("span", "", String(v)); c.prepend(n); counts.append(c);
  });
  const items = $("items"); items.replaceChildren();
  r.items.forEach(it => {
    const box = el("div", `item ${it.status}`);
    const h = el("h3", "", it.field); h.append(el("span", `badge ${it.status}`, it.status));
    box.append(h, el("p", "", it.explanation));
    if (it.suggestedAction) box.append(el("p", "", "👉 " + it.suggestedAction));
    const cite = it.pageNumber > 0 ? ` (page ${it.pageNumber}${it.sourceSection ? ", " + it.sourceSection : ""})` : "";
    box.append(el("p", "quote", `“${it.sourceQuote}”${cite}`));
    items.append(box);
  });
  $("disclaimer").textContent = r.disclaimer || "";
  $("results").hidden = false;
  $("results").scrollIntoView({ behavior: "smooth" });
}
