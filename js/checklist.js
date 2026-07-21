import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { findChecklist } from "./checklist-data.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Kolom grid untuk layout "monthly-grid" (1 form isi 12 bulan sekaligus)
// dan "daily-grid" (1 form isi 7 hari sekaligus dalam 1 minggu).
const GRID_COLUMNS = {
  "monthly-grid": ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"],
  "daily-grid": ["Senin", "Selasa", "Rabu", "Kamis", "Jum'at", "Sabtu", "Minggu"],
};

const topbarTitle = document.getElementById("checklist-topbar-title");
const topbarSub = document.getElementById("checklist-topbar-sub");
const notFoundMsg = document.getElementById("checklist-not-found");
const card = document.getElementById("checklist-card");
const form = document.getElementById("form-checklist");

const inputEquipment = document.getElementById("input-equipment");
const inputArea = document.getElementById("input-area");
const inputPeriode = document.getElementById("input-periode");
const labelBulanTahun = document.getElementById("label-bulan-tahun");
const inputBulanTahun = document.getElementById("input-bulan-tahun");
const labelTanggal = document.getElementById("label-tanggal");
const inputTanggal = document.getElementById("input-tanggal");
const labelUraian = document.getElementById("label-uraian");
const gridHint = document.getElementById("checklist-grid-hint");
const itemsContainer = document.getElementById("checklist-items");
const inputOpr = document.getElementById("input-opr");
const inputSpv = document.getElementById("input-spv");
const inputCatatan = document.getElementById("input-catatan");
const formError = document.getElementById("form-error");
const btnSubmit = document.getElementById("btn-submit");
const successOverlay = document.getElementById("success-overlay");
const btnNewChecklist = document.getElementById("btn-new-checklist");

window.addEventListener("pageshow", () => {
  successOverlay.hidden = true;
});

const params = new URLSearchParams(window.location.search);
const checklistId = params.get("id");
const def = checklistId ? findChecklist(checklistId) : null;

if (!def) {
  notFoundMsg.hidden = false;
} else {
  initChecklist(def);
}

function initChecklist(def) {
  card.hidden = false;
  topbarTitle.textContent = def.title;
  topbarSub.textContent = `${def.categoryLabel} · ${def.periodeLabel}`;
  inputPeriode.value = def.periodeLabel;

  const today = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  inputTanggal.value = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const gridColumns = GRID_COLUMNS[def.layout] || null;
  const isGrid = !!gridColumns;

  // Sesuaikan label field mengikuti tipe layout, karena checklist grid
  // (monthly-grid/daily-grid) mengisi banyak periode sekaligus dalam 1 submit.
  if (def.layout === "monthly-grid") {
    labelBulanTahun.textContent = "Tahun";
    inputBulanTahun.placeholder = "cth. 2026";
    labelTanggal.textContent = "Tanggal Update Terakhir";
    labelUraian.textContent = "Uraian pekerjaan (per bulan)";
  } else if (def.layout === "daily-grid") {
    labelBulanTahun.textContent = "Bulan / Tahun";
    inputBulanTahun.placeholder = "cth. Juli 2026";
    labelTanggal.textContent = "Tanggal Mulai Minggu (Senin)";
    labelUraian.textContent = "Uraian pekerjaan (per hari)";
  } else {
    labelBulanTahun.textContent = "Bulan / Tahun";
    inputBulanTahun.placeholder = "cth. Juli 2026";
    labelTanggal.textContent = "Tanggal Inspeksi";
    labelUraian.textContent = "Uraian pekerjaan";
  }

  gridHint.hidden = !isGrid;
  itemsContainer.classList.toggle("checklist-table--grid", isGrid);

  if (isGrid) {
    itemsContainer.innerHTML = `
      <table class="checklist-grid">
        <thead>
          <tr>
            <th class="checklist-grid-uraian-head">Uraian Pekerjaan</th>
            ${gridColumns.map((col) => `<th>${col}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${def.items.map((item, idx) => `
            <tr>
              <td class="checklist-grid-uraian">
                <p>${item.no !== undefined && item.no !== null ? `<span class="checklist-grid-no">${item.no}.</span>` : ""}${item.uraian}</p>
                ${item.standar ? `<p class="checklist-grid-standar">Standar: ${item.standar}</p>` : ""}
              </td>
              ${gridColumns.map((col, colIdx) => `
                <td class="checklist-grid-cell-wrap">
                  <input type="text" class="checklist-grid-cell" data-idx="${idx}" data-col="${colIdx}" aria-label="${item.uraian} - ${col}" />
                </td>
              `).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  } else {
    itemsContainer.innerHTML = def.items.map((item, idx) => `
      <div class="checklist-row">
        <div class="checklist-row-head">
          <span class="checklist-row-no">${item.no}</span>
          <div>
            <p class="checklist-row-uraian">${item.uraian}</p>
            ${item.standar ? `<p class="checklist-row-standar">Standar: ${item.standar}</p>` : ""}
          </div>
        </div>
        <div class="checklist-row-inputs">
          <input type="text" class="checklist-hasil" data-idx="${idx}" placeholder="Hasil" />
          <input type="text" class="checklist-keterangan" data-idx="${idx}" placeholder="Keterangan" />
        </div>
      </div>
    `).join("");
  }

  function clearFormError() {
    formError.hidden = true;
    formError.textContent = "";
  }

  function showFormError(msg) {
    formError.hidden = false;
    formError.textContent = msg;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFormError();

    if (!inputEquipment.value.trim()) {
      showFormError("Isi dulu Equipment-nya.");
      return;
    }
    if (!inputTanggal.value) {
      showFormError(`Isi dulu ${labelTanggal.textContent}.`);
      return;
    }

    let items;
    if (isGrid) {
      const perItemValues = def.items.map(() => ({}));
      itemsContainer.querySelectorAll(".checklist-grid-cell").forEach((cell) => {
        const idx = Number(cell.dataset.idx);
        const colIdx = Number(cell.dataset.col);
        perItemValues[idx][gridColumns[colIdx]] = cell.value.trim();
      });
      items = def.items.map((item, idx) => ({
        no: item.no,
        uraian: item.uraian,
        standar: item.standar,
        values: perItemValues[idx],
      }));
    } else {
      const hasilInputs = itemsContainer.querySelectorAll(".checklist-hasil");
      const keteranganInputs = itemsContainer.querySelectorAll(".checklist-keterangan");
      items = def.items.map((item, idx) => ({
        no: item.no,
        uraian: item.uraian,
        standar: item.standar,
        hasil: hasilInputs[idx].value.trim(),
        keterangan: keteranganInputs[idx].value.trim(),
      }));
    }

    btnSubmit.disabled = true;
    btnSubmit.querySelector(".btn-submit-label").textContent = "Menyimpan…";

    try {
      const { error } = await supabase.from("pm_checklist_submission").insert({
        checklist_key: def.id,
        checklist_title: def.title,
        periode_label: def.periodeLabel,
        equipment: inputEquipment.value.trim(),
        area: inputArea.value.trim(),
        bulan_tahun: inputBulanTahun.value.trim(),
        items,
        tanggal_inspeksi: inputTanggal.value,
        checked_by_opr: inputOpr.value.trim(),
        checked_by_spv: inputSpv.value.trim(),
        catatan: inputCatatan.value.trim(),
      });

      if (error) throw error;

      successOverlay.hidden = false;
    } catch (err) {
      console.error(err);
      showFormError("Gagal menyimpan checklist. Coba lagi. (" + (err.message || "unknown error") + ")");
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.querySelector(".btn-submit-label").textContent = "Simpan checklist";
    }
  });

  btnNewChecklist.addEventListener("click", () => {
    form.reset();
    inputPeriode.value = def.periodeLabel;
    const t = new Date();
    inputTanggal.value = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
    successOverlay.hidden = true;
  });
}
