const storageKey = "zfl16-movable-type-workshop";

const starterInventory = [
  { id: crypto.randomUUID(), char: "山", style: "宋体旧字", size: 30, quantity: 4, wear: "微磨" },
  { id: crypto.randomUUID(), char: "月", style: "宋体旧字", size: 30, quantity: 3, wear: "旧痕" },
  { id: crypto.randomUUID(), char: "风", style: "楷体木刻", size: 28, quantity: 2, wear: "微磨" },
  { id: crypto.randomUUID(), char: "花", style: "楷体木刻", size: 28, quantity: 2, wear: "新" },
  { id: crypto.randomUUID(), char: "茶", style: "黑体铅字", size: 24, quantity: 3, wear: "旧痕" },
  { id: crypto.randomUUID(), char: "雨", style: "仿宋细字", size: 22, quantity: 4, wear: "新" }
];

const defaultState = {
  inventory: starterInventory,
  selectedTypeId: starterInventory[0].id,
  placements: [],
  drafts: [],
  print: { copies: "", proofreader: "" },
  lock: null,
  revisions: [],
  settings: {
    paperSize: "postcard",
    flowMode: "horizontal",
    gridGap: 8,
    workTitle: "晚风小笺"
  }
};

let state = loadState();

const els = {
  paperSize: document.querySelector("#paperSize"),
  flowMode: document.querySelector("#flowMode"),
  gridGap: document.querySelector("#gridGap"),
  workTitle: document.querySelector("#workTitle"),
  stage: document.querySelector("#stage"),
  typeList: document.querySelector("#typeList"),
  typeForm: document.querySelector("#typeForm"),
  charInput: document.querySelector("#charInput"),
  styleInput: document.querySelector("#styleInput"),
  sizeInput: document.querySelector("#sizeInput"),
  quantityInput: document.querySelector("#quantityInput"),
  wearInput: document.querySelector("#wearInput"),
  inventorySearch: document.querySelector("#inventorySearch"),
  styleFilter: document.querySelector("#styleFilter"),
  selectedTypeLabel: document.querySelector("#selectedTypeLabel"),
  shortageBadge: document.querySelector("#shortageBadge"),
  usageList: document.querySelector("#usageList"),
  draftList: document.querySelector("#draftList"),
  placedCount: document.querySelector("#placedCount"),
  inventoryCount: document.querySelector("#inventoryCount"),
  saveDraftBtn: document.querySelector("#saveDraftBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  clearBoardBtn: document.querySelector("#clearBoardBtn"),
  lockBadge: document.querySelector("#lockBadge"),
  lockForm: document.querySelector("#lockForm"),
  copiesInput: document.querySelector("#copiesInput"),
  proofreaderInput: document.querySelector("#proofreaderInput"),
  lockSubmitBtn: document.querySelector("#lockSubmitBtn"),
  lockInfo: document.querySelector("#lockInfo"),
  lockErrors: document.querySelector("#lockErrors"),
  revisionList: document.querySelector("#revisionList"),
  clearRevisionsBtn: document.querySelector("#clearRevisionsBtn"),
  inventoryPanel: document.querySelector(".inventory-panel"),
  draftPanel: document.querySelector(".draft-panel")
};

let lockErrors = [];

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(defaultState);
  try {
    const parsed = JSON.parse(saved);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      settings: { ...defaultState.settings, ...parsed.settings },
      print: { ...defaultState.print, ...parsed.print },
      lock: parsed.lock || null,
      revisions: Array.isArray(parsed.revisions) ? parsed.revisions : []
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function getGrid() {
  const size = state.settings.paperSize;
  if (size === "bookmark") return { cols: 7, rows: 18 };
  if (size === "square") return { cols: 12, rows: 12 };
  return { cols: 16, rows: 10 };
}

function placementKey(row, col) {
  return `${row}:${col}`;
}

function getSelectedType() {
  return state.inventory.find((item) => item.id === state.selectedTypeId) || null;
}

function getUsage() {
  return state.placements.reduce((acc, placement) => {
    acc[placement.typeId] = (acc[placement.typeId] || 0) + 1;
    return acc;
  }, {});
}

function isLocked() {
  return Boolean(state.lock);
}

function isBoardContinuous() {
  if (!state.placements.length) return false;
  const { cols, rows } = getGrid();
  const vertical = state.settings.flowMode === "vertical";
  const toIndex = (item) => (vertical ? item.col * rows + item.row : item.row * cols + item.col);
  const filled = [...new Set(state.placements.map(toIndex))].sort((a, b) => a - b);
  return filled[filled.length - 1] - filled[0] + 1 === filled.length;
}

function validateLock() {
  const errors = [];
  const copies = Number(state.print.copies);
  if (!Number.isInteger(copies) || copies < 1) errors.push("送印前请填写有效印数。");
  if (!state.print.proofreader.trim()) errors.push("送印前请填写校对人。");
  if (state.revisions.length) errors.push("尚有改版记录，清空后才能再次锁版。");
  if (!state.placements.length) {
    errors.push("版面为空，无法锁版。");
  } else if (!isBoardContinuous()) {
    errors.push("版面不连续，存在空格。");
  }
  const usage = getUsage();
  const shortages = state.inventory.filter((item) => (usage[item.id] || 0) > item.quantity);
  if (shortages.length) {
    errors.push(`字模库存不足：${shortages.map((item) => `${item.char}（${usage[item.id]}/${item.quantity}）`).join("、")}。`);
  }
  const worn = state.inventory.filter((item) => usage[item.id] && item.wear === "旧痕");
  if (worn.length) {
    errors.push(`版面含旧痕字模：${worn.map((item) => item.char).join("、")}。`);
  }
  return errors;
}

function requestRevision(actionLabel) {
  if (!isLocked()) return true;
  const reason = window.prompt(`当前版面已锁版。${actionLabel}须填写改版依据，确认后回到待校对状态：`);
  if (!reason || !reason.trim()) return false;
  state.revisions.unshift({ id: crypto.randomUUID(), reason: reason.trim(), at: new Date().toISOString() });
  state.lock = null;
  return true;
}

function renderSettings() {
  els.paperSize.value = state.settings.paperSize;
  els.flowMode.value = state.settings.flowMode;
  els.gridGap.value = state.settings.gridGap;
  els.workTitle.value = state.settings.workTitle;
}

function renderStyleFilter() {
  const current = els.styleFilter.value || "all";
  const styles = [...new Set(state.inventory.map((item) => item.style))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  els.styleFilter.innerHTML = `<option value="all">全部风格</option>${styles
    .map((style) => `<option value="${escapeHtml(style)}">${escapeHtml(style)}</option>`)
    .join("")}`;
  els.styleFilter.value = styles.includes(current) ? current : "all";
}

function renderInventory() {
  const keyword = els.inventorySearch.value.trim();
  const style = els.styleFilter.value;
  const usage = getUsage();
  const items = state.inventory.filter((item) => {
    const matchesKeyword = !keyword || `${item.char}${item.style}${item.wear}`.includes(keyword);
    const matchesStyle = style === "all" || item.style === style;
    return matchesKeyword && matchesStyle;
  });

  els.inventoryCount.textContent = `${state.inventory.length}枚字模 · ${isLocked() ? "已锁版" : "待校对"}`;
  els.inventoryPanel.classList.toggle("locked", isLocked());
  els.typeList.innerHTML = items
    .map((item) => {
      const used = usage[item.id] || 0;
      const selected = item.id === state.selectedTypeId ? "selected" : "";
      return `
        <article class="type-card ${selected}" draggable="true" data-type-id="${item.id}">
          <div class="glyph" style="font-size:${Math.min(item.size, 36)}px">${escapeHtml(item.char)}</div>
          <div class="type-meta">
            <strong>${escapeHtml(item.char)} · ${escapeHtml(item.style)}</strong>
            <span>${item.size}px · ${escapeHtml(item.wear)} · 已用${used}/${item.quantity}</span>
          </div>
          <button class="mini-btn" title="删除字模" data-delete-type="${item.id}" type="button">×</button>
        </article>
      `;
    })
    .join("");
}

function renderStage() {
  const { cols, rows } = getGrid();
  const map = new Map(state.placements.map((item) => [placementKey(item.row, item.col), item]));
  els.stage.className = `stage ${state.settings.paperSize}`;
  els.stage.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  els.stage.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
  els.stage.style.gap = `${state.settings.gridGap}px`;
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const placement = map.get(placementKey(row, col));
      const type = placement ? state.inventory.find((item) => item.id === placement.typeId) : null;
      const vertical = state.settings.flowMode === "vertical" ? "vertical" : "";
      cells.push(`
        <button class="cell ${type ? "used" : ""} ${vertical}" data-row="${row}" data-col="${col}" type="button" aria-label="第${row + 1}行第${col + 1}列">
          ${type ? escapeHtml(type.char) : ""}
        </button>
      `);
    }
  }
  els.stage.innerHTML = cells.join("");
}

function renderUsage() {
  const usage = getUsage();
  const entries = state.inventory.filter((item) => usage[item.id]);
  els.placedCount.textContent = `${state.placements.length}个落字 · ${isLocked() ? "已锁版" : "待校对"}`;
  els.draftPanel.classList.toggle("locked", isLocked());

  const shortages = entries.filter((item) => usage[item.id] > item.quantity);
  els.shortageBadge.textContent = shortages.length ? `${shortages.length}处超量` : "数量充足";
  els.shortageBadge.className = `badge ${shortages.length ? "warn" : "ok"}`;

  const selectedType = getSelectedType();
  els.selectedTypeLabel.textContent = selectedType ? `当前：${selectedType.char} · ${selectedType.style}` : "未选择字模";

  els.usageList.innerHTML =
    entries
      .map((item) => {
        const used = usage[item.id];
        const warn = used > item.quantity ? "warn" : "";
        return `
          <div class="usage-item ${warn}">
            <strong>${escapeHtml(item.char)} ${escapeHtml(item.style)}</strong>
            <span>${used}/${item.quantity}</span>
          </div>
        `;
      })
      .join("") || `<p class="empty">还没有落字。</p>`;
}

function renderLock() {
  const locked = isLocked();
  els.lockBadge.textContent = locked ? "已锁版" : "待校对";
  els.lockBadge.className = `badge ${locked ? "locked" : "warn"}`;

  els.copiesInput.disabled = locked;
  els.proofreaderInput.disabled = locked;
  els.lockSubmitBtn.disabled = locked;
  els.copiesInput.value = locked ? state.lock.copies : state.print.copies;
  els.proofreaderInput.value = locked ? state.lock.proofreader : state.print.proofreader;

  els.lockInfo.textContent = locked
    ? `已锁版 · 印数${state.lock.copies} · 校对：${state.lock.proofreader} · ${new Date(state.lock.lockedAt).toLocaleString("zh-CN")}`
    : "";

  els.lockErrors.innerHTML = lockErrors.map((error) => `<p>${escapeHtml(error)}</p>`).join("");

  els.revisionList.innerHTML =
    state.revisions
      .map(
        (revision) => `
          <div class="revision-item">
            ${escapeHtml(revision.reason)}
            <span>${new Date(revision.at).toLocaleString("zh-CN")}</span>
          </div>
        `
      )
      .join("") || `<p class="empty">暂无改版记录。</p>`;
  els.clearRevisionsBtn.disabled = !state.revisions.length;
}

function renderDrafts() {
  els.draftList.innerHTML =
    state.drafts
      .map(
        (draft) => `
          <article class="draft-item">
            <strong>${escapeHtml(draft.title)} <span class="badge ${draft.locked ? "locked" : "pending"}">${draft.locked ? "已锁版" : "待校对"}</span></strong>
            <span>${draft.placements.length}个落字 · ${new Date(draft.savedAt).toLocaleString("zh-CN")}</span>
            <div class="draft-actions">
              <button type="button" data-load-draft="${draft.id}">载入</button>
              <button type="button" data-delete-draft="${draft.id}">删除</button>
            </div>
          </article>
        `
      )
      .join("") || `<p class="empty">还没有保存草稿。</p>`;
}

function renderAll() {
  saveState();
  renderSettings();
  renderStyleFilter();
  renderInventory();
  renderStage();
  renderUsage();
  renderLock();
  renderDrafts();
}

function placeType(row, col, typeId = state.selectedTypeId) {
  if (!typeId) return;
  if (!requestRevision("调整落字")) return;
  const existingIndex = state.placements.findIndex((item) => item.row === row && item.col === col);
  if (existingIndex >= 0) {
    if (state.placements[existingIndex].typeId === typeId) {
      state.placements.splice(existingIndex, 1);
    } else {
      state.placements[existingIndex].typeId = typeId;
    }
  } else {
    state.placements.push({ row, col, typeId });
  }
  renderAll();
}

function addType(event) {
  event.preventDefault();
  if (!requestRevision("调整字模库")) return;
  const item = {
    id: crypto.randomUUID(),
    char: els.charInput.value.trim(),
    style: els.styleInput.value.trim(),
    size: Number(els.sizeInput.value),
    quantity: Number(els.quantityInput.value),
    wear: els.wearInput.value
  };
  if (!item.char || !item.style) return;
  state.inventory.unshift(item);
  state.selectedTypeId = item.id;
  els.typeForm.reset();
  els.sizeInput.value = 24;
  els.quantityInput.value = 3;
  renderAll();
}

function saveDraft() {
  const title = state.settings.workTitle.trim() || "未命名作品";
  state.drafts.unshift({
    id: crypto.randomUUID(),
    title,
    settings: structuredClone(state.settings),
    placements: structuredClone(state.placements),
    locked: isLocked(),
    lock: state.lock ? structuredClone(state.lock) : null,
    savedAt: new Date().toISOString()
  });
  state.drafts = state.drafts.slice(0, 8);
  renderAll();
}

function exportPreview() {
  const { cols, rows } = getGrid();
  const cell = state.settings.paperSize === "bookmark" ? 44 : 56;
  const gap = state.settings.gridGap;
  const margin = 48;
  const width = cols * cell + (cols - 1) * gap + margin * 2;
  const height = rows * cell + (rows - 1) * gap + margin * 2 + 70;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fffaf1";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#2f2921";
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, width - 36, height - 36);
  ctx.fillStyle = "#22201c";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText(state.settings.workTitle || "未命名作品", margin, 50);
  ctx.font = "bold 30px serif";
  state.placements.forEach((placement) => {
    const type = state.inventory.find((item) => item.id === placement.typeId);
    if (!type) return;
    const x = margin + placement.col * (cell + gap);
    const y = margin + 45 + placement.row * (cell + gap);
    ctx.fillStyle = "#2f2921";
    ctx.fillRect(x, y, cell, cell);
    ctx.fillStyle = "#fff5df";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.min(type.size + 8, 42)}px serif`;
    ctx.fillText(type.char, x + cell / 2, y + cell / 2);
  });
  drawLockStamp(ctx, width, height);
  const link = document.createElement("a");
  link.download = `${state.settings.workTitle || "movable-type"}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function drawLockStamp(ctx, width, height) {
  const locked = isLocked();
  const text = locked
    ? `已锁版 · 印数${state.lock.copies} · 校对：${state.lock.proofreader}`
    : "待校对 · 未送印";
  ctx.save();
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.font = "bold 20px sans-serif";
  ctx.fillStyle = locked ? "#a64037" : "#6f675c";
  ctx.fillText(text, width - 40, height - 30);
  if (locked) {
    const metrics = ctx.measureText(text);
    ctx.strokeStyle = "#a64037";
    ctx.lineWidth = 2;
    ctx.strokeRect(width - 48 - metrics.width, height - 62, metrics.width + 16, 40);
  }
  ctx.restore();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.paperSize.addEventListener("change", () => {
  if (!requestRevision("调整作品设置")) {
    renderAll();
    return;
  }
  state.settings.paperSize = els.paperSize.value;
  const { cols, rows } = getGrid();
  state.placements = state.placements.filter((item) => item.row < rows && item.col < cols);
  renderAll();
});

els.flowMode.addEventListener("change", () => {
  if (!requestRevision("调整作品设置")) {
    renderAll();
    return;
  }
  state.settings.flowMode = els.flowMode.value;
  renderAll();
});

els.gridGap.addEventListener("input", () => {
  if (isLocked()) return;
  state.settings.gridGap = Number(els.gridGap.value);
  renderAll();
});

els.gridGap.addEventListener("change", () => {
  if (!isLocked()) return;
  if (!requestRevision("调整作品设置")) {
    renderAll();
    return;
  }
  state.settings.gridGap = Number(els.gridGap.value);
  renderAll();
});

els.workTitle.addEventListener("input", () => {
  if (isLocked()) return;
  state.settings.workTitle = els.workTitle.value;
  saveState();
});

els.workTitle.addEventListener("change", () => {
  if (!isLocked()) return;
  if (!requestRevision("调整作品设置")) {
    renderAll();
    return;
  }
  state.settings.workTitle = els.workTitle.value;
  renderAll();
});

els.typeForm.addEventListener("submit", addType);
els.inventorySearch.addEventListener("input", renderInventory);
els.styleFilter.addEventListener("change", renderInventory);
els.saveDraftBtn.addEventListener("click", saveDraft);
els.exportBtn.addEventListener("click", exportPreview);

els.lockForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (isLocked()) return;
  state.print.copies = els.copiesInput.value.trim();
  state.print.proofreader = els.proofreaderInput.value.trim();
  lockErrors = validateLock();
  if (lockErrors.length) {
    renderAll();
    return;
  }
  state.lock = {
    copies: Number(state.print.copies),
    proofreader: state.print.proofreader,
    lockedAt: new Date().toISOString()
  };
  lockErrors = [];
  renderAll();
});

els.clearRevisionsBtn.addEventListener("click", () => {
  if (!state.revisions.length) return;
  if (!window.confirm("确定清空全部改版记录吗？清空后才能再次锁版。")) return;
  state.revisions = [];
  renderAll();
});

els.copiesInput.addEventListener("input", () => {
  state.print.copies = els.copiesInput.value.trim();
  saveState();
});

els.proofreaderInput.addEventListener("input", () => {
  state.print.proofreader = els.proofreaderInput.value.trim();
  saveState();
});
els.clearBoardBtn.addEventListener("click", () => {
  if (!state.placements.length) return;
  if (!requestRevision("清空版面")) return;
  state.placements = [];
  renderAll();
});

els.typeList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-type]");
  if (deleteButton) {
    if (!requestRevision("调整字模库")) return;
    const typeId = deleteButton.dataset.deleteType;
    state.inventory = state.inventory.filter((item) => item.id !== typeId);
    state.placements = state.placements.filter((item) => item.typeId !== typeId);
    if (state.selectedTypeId === typeId) state.selectedTypeId = state.inventory[0]?.id || null;
    renderAll();
    return;
  }
  const card = event.target.closest("[data-type-id]");
  if (!card) return;
  state.selectedTypeId = card.dataset.typeId;
  renderAll();
});

els.typeList.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-type-id]");
  if (!card) return;
  event.dataTransfer.setData("text/plain", card.dataset.typeId);
});

els.stage.addEventListener("dragover", (event) => {
  if (event.target.closest(".cell")) event.preventDefault();
});

els.stage.addEventListener("drop", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  event.preventDefault();
  placeType(Number(cell.dataset.row), Number(cell.dataset.col), event.dataTransfer.getData("text/plain"));
});

els.stage.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  placeType(Number(cell.dataset.row), Number(cell.dataset.col));
});

els.draftList.addEventListener("click", (event) => {
  const loadButton = event.target.closest("[data-load-draft]");
  const deleteButton = event.target.closest("[data-delete-draft]");
  if (loadButton) {
    const draft = state.drafts.find((item) => item.id === loadButton.dataset.loadDraft);
    if (!draft) return;
    if (!requestRevision("载入草稿")) return;
    state.settings = structuredClone(draft.settings);
    state.placements = structuredClone(draft.placements);
    renderAll();
  }
  if (deleteButton) {
    state.drafts = state.drafts.filter((item) => item.id !== deleteButton.dataset.deleteDraft);
    renderAll();
  }
});

renderAll();
