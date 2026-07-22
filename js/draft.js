import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { displayName } from "./auth.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const tabs = document.getElementById("draft-tabs");
const draftError = document.getElementById("draft-error");
const draftCount = document.getElementById("draft-count");
const draftList = document.getElementById("draft-list");

const rejectOverlay = document.getElementById("reject-overlay");
const rejectClose = document.getElementById("reject-close");
const rejectTargetLabel = document.getElementById("reject-target-label");
const rejectReason = document.getElementById("reject-reason");
const rejectError = document.getElementById("reject-error");
const rejectConfirm = document.getElementById("reject-confirm");

let currentStatus = "draft";
let pendingReject = null; // { tipe, id }

const STATUS_MESIN_CLASS = {
  Running: "running",
  Standby: "standby",
  Maintenance: "maintenance",
  Breakdown: "breakdown",
};

const REVIEW_LABEL = {
  draft: "Menunggu review",
  approved: "Disetujui",
  rejected: "Ditolak",
};

function showError(msg) {
  draftError.hidden = false;
  draftError.textContent = msg;
}

function clearError() {
  draftError.hidden = true;
  draftError.textContent = "";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function formatWaktu(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------- MUAT DATA ----------
async function loadDrafts() {
  clearError();
  draftCount.textContent = "Memuat data…";
  draftList.innerHTML = `<p class="table-empty">Memuat data…</p>`;

  let laporanQuery = supabase
    .from("laporan")
    .select(
      "id, tanggal, jam, shift, status, deskripsi, pic, review_status, reviewed_by, reviewed_at, reject_reason, created_at, area:area_id(nama), mesin:mesin_id(nama), equipment:equipment_id(nama)"
    )
    .order("created_at", { ascending: false });

  let checklistQuery = supabase
    .from("pm_checklist_submission")
    .select(
      "id, checklist_title, periode_label, equipment, area, bulan_tahun, tanggal_inspeksi, checked_by_opr, catatan, review_status, reviewed_by, reviewed_at, reject_reason, created_at"
    )
    .order("created_at", { ascending: false });

  if (currentStatus) {
    laporanQuery = laporanQuery.eq("review_status", currentStatus);
    checklistQuery = checklistQuery.eq("review_status", currentStatus);
  }

  const [laporanRes, checklistRes] = await Promise.all([laporanQuery, checklistQuery]);

  if (laporanRes.error || checklistRes.error) {
    console.error(laporanRes.error || checklistRes.error);
    showError(
      "Gagal memuat data draft. Pastikan sql/add_draft_workflow.sql sudah dijalankan di Supabase. (" +
        ((laporanRes.error || checklistRes.error).message || "unknown error") +
        ")"
    );
    draftCount.textContent = "";
    draftList.innerHTML = "";
    return;
  }

  const items = [
    ...(laporanRes.data || []).map((row) => ({ tipe: "laporan", row })),
    ...(checklistRes.data || []).map((row) => ({ tipe: "pm_checklist", row })),
  ].sort((a, b) => new Date(b.row.created_at) - new Date(a.row.created_at));

  draftCount.textContent = `${items.length} data ditemukan`;
  renderList(items);
}

function renderList(items) {
  if (items.length === 0) {
    draftList.innerHTML = `<p class="table-empty">Tidak ada data untuk tab ini.</p>`;
    return;
  }

  draftList.innerHTML = "";
  for (const item of items) {
    draftList.appendChild(item.tipe === "laporan" ? renderLaporanCard(item.row) : renderChecklistCard(item.row));
  }
}

function reviewBadge(row) {
  return `<span class="review-badge review-badge--${row.review_status}">${REVIEW_LABEL[row.review_status] || row.review_status}</span>`;
}

function reviewFooter(row) {
  if (row.review_status === "draft") return "";
  const who = row.reviewed_by ? escapeHtml(row.reviewed_by) : "";
  const when = formatWaktu(row.reviewed_at);
  let text = `${row.review_status === "approved" ? "Disetujui" : "Ditolak"} oleh ${who} · ${when}`;
  if (row.review_status === "rejected" && row.reject_reason) {
    text += `<br><span class="draft-reject-reason">Alasan: ${escapeHtml(row.reject_reason)}</span>`;
  }
  return `<p class="draft-review-footer">${text}</p>`;
}

function actionButtons(tipe, row) {
  if (row.review_status !== "draft") return "";
  return `
    <div class="draft-actions">
      <button type="button" class="btn-approve" data-tipe="${tipe}" data-id="${row.id}">Approve</button>
      <button type="button" class="btn-reject" data-tipe="${tipe}" data-id="${row.id}" data-label="${escapeHtml(
    tipe === "laporan" ? row.equipment?.nama || "Laporan" : row.checklist_title || "Checklist"
  )}">Reject</button>
    </div>
  `;
}

function renderLaporanCard(row) {
  const card = document.createElement("div");
  card.className = "draft-card";
  const statusClass = STATUS_MESIN_CLASS[row.status] || "";
  const jam = row.jam ? row.jam.slice(0, 5) : "";
  card.innerHTML = `
    <div class="draft-card-head">
      <span class="draft-type-badge draft-type-badge--laporan">Laporan Mesin</span>
      ${reviewBadge(row)}
    </div>
    <p class="draft-card-title">${escapeHtml(row.equipment?.nama || row.mesin?.nama || "-")}</p>
    <p class="draft-card-meta">${escapeHtml(row.area?.nama || "")} · ${row.tanggal || ""} ${jam} · ${row.shift || ""}</p>
    <span class="status-badge status-${statusClass}">${row.status || ""}</span>
    <p class="draft-card-desc">${escapeHtml(row.deskripsi || "")}</p>
    <p class="draft-card-pic">PIC: ${escapeHtml(row.pic || "-")}</p>
    ${reviewFooter(row)}
    ${actionButtons("laporan", row)}
  `;
  bindActions(card);
  return card;
}

function renderChecklistCard(row) {
  const card = document.createElement("div");
  card.className = "draft-card";
  card.innerHTML = `
    <div class="draft-card-head">
      <span class="draft-type-badge draft-type-badge--checklist">Checklist PM</span>
      ${reviewBadge(row)}
    </div>
    <p class="draft-card-title">${escapeHtml(row.checklist_title || "-")}</p>
    <p class="draft-card-meta">${escapeHtml(row.equipment || "")} · ${escapeHtml(row.area || "")} · ${escapeHtml(
    row.periode_label || ""
  )} · ${row.tanggal_inspeksi || ""}</p>
    <p class="draft-card-pic">Diperiksa OPR: ${escapeHtml(row.checked_by_opr || "-")}</p>
    ${reviewFooter(row)}
    ${actionButtons("pm_checklist", row)}
  `;
  bindActions(card);
  return card;
}

function bindActions(card) {
  card.querySelectorAll(".btn-approve").forEach((btn) => {
    btn.addEventListener("click", () => approveItem(btn.dataset.tipe, btn.dataset.id));
  });
  card.querySelectorAll(".btn-reject").forEach((btn) => {
    btn.addEventListener("click", () => openRejectModal(btn.dataset.tipe, btn.dataset.id, btn.dataset.label));
  });
}

const TABLE_BY_TIPE = {
  laporan: "laporan",
  pm_checklist: "pm_checklist_submission",
};

async function approveItem(tipe, id) {
  const { error } = await supabase
    .from(TABLE_BY_TIPE[tipe])
    .update({
      review_status: "approved",
      reviewed_by: displayName(),
      reviewed_at: new Date().toISOString(),
      reject_reason: null,
    })
    .eq("id", id);

  if (error) {
    console.error(error);
    showError("Gagal approve data. (" + (error.message || "unknown error") + ")");
    return;
  }
  loadDrafts();
}

function openRejectModal(tipe, id, label) {
  pendingReject = { tipe, id };
  rejectTargetLabel.textContent = label || "";
  rejectReason.value = "";
  rejectError.hidden = true;
  rejectOverlay.hidden = false;
}

function closeRejectModal() {
  rejectOverlay.hidden = true;
  pendingReject = null;
}

rejectClose.addEventListener("click", closeRejectModal);
rejectOverlay.addEventListener("click", (e) => {
  if (e.target === rejectOverlay) closeRejectModal();
});

rejectConfirm.addEventListener("click", async () => {
  if (!pendingReject) return;
  const reason = rejectReason.value.trim();
  if (!reason) {
    rejectError.hidden = false;
    return;
  }

  const { tipe, id } = pendingReject;
  const { error } = await supabase
    .from(TABLE_BY_TIPE[tipe])
    .update({
      review_status: "rejected",
      reviewed_by: displayName(),
      reviewed_at: new Date().toISOString(),
      reject_reason: reason,
    })
    .eq("id", id);

  if (error) {
    console.error(error);
    showError("Gagal menolak data. (" + (error.message || "unknown error") + ")");
    return;
  }

  closeRejectModal();
  loadDrafts();
});

// ---------- TABS ----------
tabs.addEventListener("click", (e) => {
  const tab = e.target.closest(".draft-tab");
  if (!tab) return;
  tabs.querySelectorAll(".draft-tab").forEach((t) => t.classList.remove("active"));
  tab.classList.add("active");
  currentStatus = tab.dataset.status;
  loadDrafts();
});

// Buka halaman Draft = notifikasi yang menunggu dianggap sudah dilihat.
async function markAllNotificationsRead() {
  const { error } = await supabase.from("notifikasi").update({ dibaca: true }).eq("dibaca", false);
  if (error) console.error("Gagal menandai notifikasi terbaca:", error);
}

loadDrafts();
markAllNotificationsRead();
