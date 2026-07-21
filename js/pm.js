import { CHECKLIST_CATEGORIES } from "./checklist-data.js";

const container = document.getElementById("pm-categories");

container.innerHTML = CHECKLIST_CATEGORIES.map((category) => `
  <section class="pm-category">
    <h2 class="pm-category-title">${category.label}</h2>
    <div class="pm-card-grid">
      ${category.checklists.map((c) => `
        <a class="pm-card" href="checklist.html?id=${encodeURIComponent(c.id)}">
          <span class="pm-card-periode">${c.periodeLabel}</span>
          <span class="pm-card-title">${c.title}</span>
        </a>
      `).join("")}
    </div>
  </section>
`).join("");
