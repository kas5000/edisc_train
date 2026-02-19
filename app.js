/* Mini E-Discovery Review (Training)
   - 50 mock docs generated deterministically
   - Coding saved to localStorage per browser/user
*/

const STORAGE_KEY = "mini-edisco-coding-v2";

function hashStringToInt(str) {
  // deterministic-ish hash for mock text selection
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

function pick(arr, n) { return arr[n % arr.length]; }

function formatDate(iso) {
  // ISO yyyy-mm-dd -> readable
  const [y,m,d] = iso.split("-").map(x => parseInt(x, 10));
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { year:"numeric", month:"short", day:"2-digit" });
}

function makeMockDocs(count = 50) {
  const custodians = ["A. Rivera", "B. Chen", "C. Patel", "D. Nguyen", "E. Johnson", "F. Smith"];
  const doctypes   = ["Email", "Memo", "Contract", "Invoice", "Meeting Notes", "Chat Log"];
  const tags       = ["NDA", "Termination", "Pricing", "IP", "HR", "Compliance", "Litigation Hold"];
  const subjects   = [
    "Follow-up on vendor terms",
    "Re: contract redlines",
    "Invoice discrepancy",
    "Project timeline update",
    "Termination discussion",
    "NDA execution status",
    "Privilege review note",
    "Compliance training schedule",
    "Breach of contract",
    "Contract modification request",
    "Hold notice acknowledgement",
    "IP assignment question"
  ];
  const bodies = [
    "Please see the attached draft. Key issues: payment timing, confidentiality scope, and termination for convenience.",
    "Per our call, I’ve summarized the main points. We should confirm whether pricing is fixed or subject to annual adjustment.",
    "This looks like it may contain attorney-client material. Please route to counsel for privilege review.",
    "Reminder: do not delete documents potentially relevant to the matter. Preserve emails, chats, and shared drive files.",
    "I reviewed the redlines. The NDA definition of Confidential Information is broad; consider narrowing to written disclosures.",
    "Noted that the vendor has requested a 30-day cure period. We may want 10 days for non-payment defaults.",
    "The invoice includes an extra line item. Please confirm whether the fee was authorized under the SOW.",
    "If termination is contemplated, document the performance issues and ensure HR policy is followed.",
    "The agreement references IP ownership. Confirm whether work product is a ‘work made for hire’ where applicable.",
    "What time are we teeing off on Saturday?",
    "Can you share the project timeline with the team? Also, did you see the Falcons win last night? Unbelievable finish!"
  ];

  const docs = [];
  for (let i = 1; i <= count; i++) {
    const id = `DOC-${String(i).padStart(4, "0")}`;
    const seed = hashStringToInt(id);

    const custodian = pick(custodians, seed);
    const doctype = pick(doctypes, seed >> 1);
    const tag = pick(tags, seed >> 2);
    const subject = pick(subjects, seed >> 3);

    // Spread dates over ~8 months (arbitrary)
    const year = 2025;
    const month = ((seed % 8) + 1); // 1..8
    const day = ((seed % 26) + 1);  // 1..27
    const isoDate = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;

    // Base “ground truth” for training filters (not legal advice)
    const privilege = (doctype === "Email" && (seed % 5 === 0)) ? "Privileged" : "Not Privileged";
    const responsive = (tag === "Litigation Hold" || tag === "Termination" || tag === "NDA") ? "Responsive" : "Unreviewed";

    const body =
      `Subject: ${subject}\n` +
      `Custodian: ${custodian}\n` +
      `Date: ${isoDate}\n` +
      `Doc Type: ${doctype}\n` +
      `Tag: ${tag}\n\n` +
      pick(bodies, seed >> 4) + "\n\n" +
      "— End of document —";

    docs.push({
      id,
      title: subject,
      custodian,
      doctype,
      date: isoDate,
      tag,
      // “Ground truth” metadata (for filtering only)
      privilege,
      responsive,
      body
    });
  }
  return docs;
}

// ---------- State ----------
const DOCS = makeMockDocs(25);
let coding = loadCoding();            // { [docId]: {resp, priv, issues, notes, savedAt} }
let filtered = [...DOCS];
let selectedId = null;

// ---------- Elements ----------
const els = {
  q: document.getElementById("q"),
  custodian: document.getElementById("custodian"),
  doctype: document.getElementById("doctype"),
  tag: document.getElementById("tag"),
  privFilter: document.getElementById("privFilter"),
  respFilter: document.getElementById("respFilter"),
  tbody: document.getElementById("tbody"),
  listMeta: document.getElementById("listMeta"),
  statShowing: document.getElementById("statShowing"),
  statCoded: document.getElementById("statCoded"),
  btnClearFilters: document.getElementById("btnClearFilters"),
  btnPrev: document.getElementById("btnPrev"),
  btnNext: document.getElementById("btnNext"),
  btnExport: document.getElementById("btnExport"),
  btnReset: document.getElementById("btnReset"),

  docBadge: document.getElementById("docBadge"),
  docMeta: document.getElementById("docMeta"),
  docBody: document.getElementById("docBody"),

  respCode: document.getElementById("respCode"),
  privCode: document.getElementById("privCode"),
  issues: document.getElementById("issues"),
  notes: document.getElementById("notes"),
  btnMarkCoded: document.getElementById("btnMarkCoded"),
  saveStatus: document.getElementById("saveStatus")
};

// ---------- Init dropdown options ----------
function uniqueValues(arr, key) {
  return Array.from(new Set(arr.map(d => d[key]))).sort((a,b)=>a.localeCompare(b));
}

function fillSelect(selectEl, values) {
  values.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
}

fillSelect(els.custodian, uniqueValues(DOCS, "custodian"));
fillSelect(els.doctype, uniqueValues(DOCS, "doctype"));
fillSelect(els.tag, uniqueValues(DOCS, "tag"));

// ---------- Filtering ----------
function applyFilters() {
  const q = (els.q.value || "").trim().toLowerCase();
  const custodian = els.custodian.value;
  const doctype = els.doctype.value;
  const tag = els.tag.value;
  const priv = els.privFilter.value;
  const resp = els.respFilter.value;

  filtered = DOCS.filter(d => {
    if (custodian && d.custodian !== custodian) return false;
    if (doctype && d.doctype !== doctype) return false;
    if (tag && d.tag !== tag) return false;
    if (priv && d.privilege !== priv) return false;
    if (resp && d.responsive !== resp) return false;

    if (q) {
      const hay = `${d.id} ${d.title} ${d.body}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  renderList();
  updateStats();

  // If selected doc is not in filtered, clear selection
  if (selectedId && !filtered.some(d => d.id === selectedId)) {
    selectDoc(null);
  }
}

function clearFilters() {
  els.q.value = "";
  els.custodian.value = "";
  els.doctype.value = "";
  els.tag.value = "";
  els.privFilter.value = "";
  els.respFilter.value = "";
  applyFilters();
}

// ---------- Rendering ----------
function codingSummary(docId) {
  const c = coding[docId];
  if (!c) return "—";
  const r = c.resp || "Unreviewed";
  const p = c.priv || "Unreviewed";
  return `${r} / ${p}`;
}

function renderList() {
  els.tbody.innerHTML = "";

  filtered.forEach(d => {
    const tr = document.createElement("tr");
    tr.dataset.id = d.id;
    if (d.id === selectedId) tr.classList.add("rowSelected");

    tr.innerHTML = `
      <td>${d.id}</td>
      <td>${escapeHtml(d.title)}</td>
      <td>${escapeHtml(d.custodian)}</td>
      <td>${escapeHtml(d.doctype)}</td>
      <td>${escapeHtml(formatDate(d.date))}</td>
      <td>${escapeHtml(d.tag)}</td>
      <td>${escapeHtml(codingSummary(d.id))}</td>
    `;

    tr.addEventListener("click", () => selectDoc(d.id));
    els.tbody.appendChild(tr);
  });

  els.listMeta.textContent = `${filtered.length} of ${DOCS.length} documents`;
}

function updateStats() {
  const codedCount = Object.keys(coding).length;
  els.statShowing.textContent = `${filtered.length}/${DOCS.length}`;
  els.statCoded.textContent = `${codedCount}`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------- Selection + Viewer ----------
function selectDoc(docId) {
  selectedId = docId;

  // highlight row
  document.querySelectorAll("tbody tr").forEach(tr => {
    tr.classList.toggle("rowSelected", tr.dataset.id === docId);
  });

  if (!docId) {
    els.docBadge.textContent = "—";
    els.docMeta.textContent = "Select a document.";
    els.docBody.textContent = "";
    els.saveStatus.textContent = "Not saved yet";
    return;
  }

  const d = DOCS.find(x => x.id === docId);
  if (!d) return;

  els.docBadge.textContent = docId;
  els.docMeta.innerHTML =
    `<div><b>${escapeHtml(d.title)}</b></div>` +
    `<div>Custodian: ${escapeHtml(d.custodian)} • Type: ${escapeHtml(d.doctype)} • Date: ${escapeHtml(formatDate(d.date))}</div>` +
    `<div>Training Tag: ${escapeHtml(d.tag)} • Training Privilege: ${escapeHtml(d.privilege)} • Training Responsive: ${escapeHtml(d.responsive)}</div>`;

  els.docBody.textContent = d.body;

  // load coding into form
  const c = coding[docId] || { resp:"Unreviewed", priv:"Unreviewed", issues:"", notes:"" };
  els.respCode.value = c.resp || "Unreviewed";
  els.privCode.value = c.priv || "Unreviewed";
  els.issues.value = c.issues || "";
  els.notes.value = c.notes || "";

  els.saveStatus.textContent = c.savedAt ? `Saved ${new Date(c.savedAt).toLocaleString()}` : "Not saved yet";
}

// ---------- Coding storage ----------
function loadCoding() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveCoding() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(coding));
}

function markCoded() {
  if (!selectedId) return;

  coding[selectedId] = {
    resp: els.respCode.value,
    priv: els.privCode.value,
    issues: (els.issues.value || "").trim(),
    notes: (els.notes.value || "").trim(),
    savedAt: new Date().toISOString()
  };

  saveCoding();
  els.saveStatus.textContent = `Saved ${new Date(coding[selectedId].savedAt).toLocaleString()}`;
  renderList();
  updateStats();
}

// ---------- Navigation ----------
function currentIndexInFiltered() {
  if (!selectedId) return -1;
  return filtered.findIndex(d => d.id === selectedId);
}

function nextDoc() {
  if (filtered.length === 0) return;
  const idx = currentIndexInFiltered();
  const nextIdx = (idx < 0) ? 0 : Math.min(idx + 1, filtered.length - 1);
  selectDoc(filtered[nextIdx].id);
}

function prevDoc() {
  if (filtered.length === 0) return;
  const idx = currentIndexInFiltered();
  const prevIdx = (idx <= 0) ? 0 : idx - 1;
  selectDoc(filtered[prevIdx].id);
}

// ---------- CSV export ----------
function toCsvValue(v) {
  const s = (v ?? "").toString();
  const escaped = s.replaceAll('"', '""');
  return `"${escaped}"`;
}

function exportCsv() {
  const headers = ["doc_id", "title", "custodian", "doctype", "date", "tag", "resp_code", "priv_code", "issues", "notes", "saved_at"];
  const rows = [headers.join(",")];

  DOCS.forEach(d => {
    const c = coding[d.id] || {};
    rows.push([
      toCsvValue(d.id),
      toCsvValue(d.title),
      toCsvValue(d.custodian),
      toCsvValue(d.doctype),
      toCsvValue(d.date),
      toCsvValue(d.tag),
      toCsvValue(c.resp || ""),
      toCsvValue(c.priv || ""),
      toCsvValue(c.issues || ""),
      toCsvValue(c.notes || ""),
      toCsvValue(c.savedAt || "")
    ].join(","));
  });

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `mini-edisco-coding-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

// ---------- Reset coding ----------
function resetCoding() {
  if (!confirm("This clears your local coding on this browser/device only. Continue?")) return;
  coding = {};
  saveCoding();
  renderList();
  updateStats();
  if (selectedId) selectDoc(selectedId);
}

// ---------- Events ----------
["input", "change"].forEach(evt => {
  els.q.addEventListener(evt, applyFilters);
  els.custodian.addEventListener(evt, applyFilters);
  els.doctype.addEventListener(evt, applyFilters);
  els.tag.addEventListener(evt, applyFilters);
  els.privFilter.addEventListener(evt, applyFilters);
  els.respFilter.addEventListener(evt, applyFilters);
});

els.btnClearFilters.addEventListener("click", clearFilters);
els.btnPrev.addEventListener("click", prevDoc);
els.btnNext.addEventListener("click", nextDoc);
els.btnMarkCoded.addEventListener("click", markCoded);
els.btnExport.addEventListener("click", exportCsv);
els.btnReset.addEventListener("click", resetCoding);

// keyboard shortcuts: j/k for next/prev
document.addEventListener("keydown", (e) => {
  if (e.target && ["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName)) return;
  if (e.key === "j") nextDoc();
  if (e.key === "k") prevDoc();
});

// ---------- Boot ----------
applyFilters();
selectDoc(filtered[0]?.id || null);
updateStats();

