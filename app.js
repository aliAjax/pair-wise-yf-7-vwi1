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
  settings: {
    paperSize: "postcard",
    flowMode: "horizontal",
    gridGap: 8,
    workTitle: "晚风小笺"
  },
  lock: {
    status: "proofing",
    printCount: "",
    proofreader: "",
    lockedAt: null,
    revisions: []
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
  wearFilter: document.querySelector("#wearFilter"),
  selectedTypeLabel: document.querySelector("#selectedTypeLabel"),
  shortageBadge: document.querySelector("#shortageBadge"),
  lockBadge: document.querySelector("#lockBadge"),
  usageList: document.querySelector("#usageList"),
  draftList: document.querySelector("#draftList"),
  placedCount: document.querySelector("#placedCount"),
  inventoryCount: document.querySelector("#inventoryCount"),
  saveDraftBtn: document.querySelector("#saveDraftBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  clearBoardBtn: document.querySelector("#clearBoardBtn"),
  lockStatusChip: document.querySelector("#lockStatusChip"),
  proofingView: document.querySelector("#proofingView"),
  lockedView: document.querySelector("#lockedView"),
  lockForm: document.querySelector("#lockForm"),
  printCountInput: document.querySelector("#printCountInput"),
  proofreaderInput: document.querySelector("#proofreaderInput"),
  lockChecklist: document.querySelector("#lockChecklist"),
  lockErrors: document.querySelector("#lockErrors"),
  revisionList: document.querySelector("#revisionList"),
  clearRevisionsBtn: document.querySelector("#clearRevisionsBtn"),
  lockMeta: document.querySelector("#lockMeta"),
  revisionModal: document.querySelector("#revisionModal"),
  revisionSummary: document.querySelector("#revisionSummary"),
  revisionReason: document.querySelector("#revisionReason"),
  revisionFormHint: document.querySelector("#revisionFormHint"),
  revisionCancelBtn: document.querySelector("#revisionCancelBtn"),
  revisionConfirmBtn: document.querySelector("#revisionConfirmBtn")
};

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(defaultState);
  try {
    const parsed = JSON.parse(saved);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      settings: { ...defaultState.settings, ...parsed.settings },
      lock: { ...structuredClone(defaultState.lock), ...parsed.lock }
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function isLocked() {
  return state.lock.status === "locked";
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

// 版面连续性：按阅读顺序（横排先行后列、竖排先列后行），
// 落字必须构成无空格的连续开头，允许末尾留白。
function getContinuity() {
  const { cols, rows } = getGrid();
  const map = new Map(state.placements.map((item) => [placementKey(item.row, item.col), item]));
  const order = [];
  if (state.settings.flowMode === "vertical") {
    for (let col = 0; col < cols; col += 1) {
      for (let row = 0; row < rows; row += 1) order.push({ row, col });
    }
  } else {
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) order.push({ row, col });
    }
  }

  let missing = 0;
  let outOfGrid = 0;
  for (const placement of state.placements) {
    if (placement.row >= rows || placement.col >= cols) outOfGrid += 1;
    if (!state.inventory.some((item) => item.id === placement.typeId)) missing += 1;
  }

  if (state.placements.length === 0) {
    return { empty: true, gap: null, missing, outOfGrid };
  }

  let blankSeen = false;
  for (const cell of order) {
    const filled = map.has(placementKey(cell.row, cell.col));
    if (!filled) {
      blankSeen = true;
    } else if (blankSeen) {
      return { empty: false, gap: cell, missing, outOfGrid };
    }
  }
  return { empty: false, gap: null, missing, outOfGrid };
}

// 锁版前的完整核对：版面连续、库存充足、无旧痕字模、改版记录已清空、印数与校对人齐全。
function evaluateLock() {
  const checks = [];
  const continuity = getContinuity();

  const empty = state.placements.length === 0;
  checks.push({
    key: "empty",
    ok: !empty,
    label: empty ? "版面为空，无法送印" : "版面已有落字"
  });

  let gapOk = !continuity.gap && continuity.missing === 0 && continuity.outOfGrid === 0;
  let gapText;
  if (continuity.gap) {
    gapText = `版面存在空格：阅读顺序到第${continuity.gap.row + 1}行第${continuity.gap.col + 1}列之前已有留白（允许末尾留白）`;
  } else if (continuity.missing > 0) {
    gapText = `${continuity.missing}处落字引用了已删除的字模`;
  } else if (continuity.outOfGrid > 0) {
    gapText = `${continuity.outOfGrid}处落字超出当前纸张网格`;
  } else if (empty) {
    gapText = "版面还没有落字";
  } else {
    gapText = "版面连续无空格";
  }
  checks.push({ key: "continuity", ok: gapOk, label: gapText });

  const usage = getUsage();
  const shortages = state.inventory
    .filter((item) => (usage[item.id] || 0) > item.quantity)
    .map((item) => `${item.char}（${(usage[item.id] || 0)}/${item.quantity}）`);
  checks.push({
    key: "stock",
    ok: shortages.length === 0,
    label: shortages.length ? `字模库存不足：${shortages.join("、")}` : "字模库存充足"
  });

  const placedTypeIds = new Set(state.placements.map((item) => item.typeId));
  const wornTypes = state.inventory.filter((item) => item.wear === "旧痕" && placedTypeIds.has(item.id));
  const wornLabels = wornTypes.map((item) => `${item.char}（${item.style}）`);
  checks.push({
    key: "wear",
    ok: wornTypes.length === 0,
    label: wornTypes.length ? `版面使用了旧痕字模：${wornLabels.join("、")}` : "无旧痕字模"
  });

  const revisionCleared = state.lock.revisions.length === 0;
  checks.push({
    key: "revisions",
    ok: revisionCleared,
    label: revisionCleared ? "改版记录已清空" : `仍有${state.lock.revisions.length}条改版记录未清空`
  });

  const printCount = Number(state.lock.printCount);
  const countOk = Number.isInteger(printCount) && printCount >= 1;
  checks.push({
    key: "printCount",
    ok: countOk,
    label: countOk ? `印数：${printCount}张` : "请填写送印印数（正整数）"
  });

  const proofreader = state.lock.proofreader.trim();
  const proofreaderOk = proofreader.length > 0;
  checks.push({
    key: "proofreader",
    ok: proofreaderOk,
    label: proofreaderOk ? `校对人：${proofreader}` : "请填写校对人"
  });

  return {
    checks,
    ok: checks.every((check) => check.ok)
  };
}

function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

function renderSettings() {
  els.paperSize.value = state.settings.paperSize;
  els.flowMode.value = state.settings.flowMode;
  els.gridGap.value = state.settings.gridGap;
  els.workTitle.value = state.settings.workTitle;
  document.body.classList.toggle("is-locked", isLocked());
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
  const wear = els.wearFilter.value;
  const usage = getUsage();
  const items = state.inventory.filter((item) => {
    const matchesKeyword = !keyword || `${item.char}${item.style}${item.wear}`.includes(keyword);
    const matchesStyle = style === "all" || item.style === style;
    const matchesWear = wear === "all" || item.wear === wear;
    return matchesKeyword && matchesStyle && matchesWear;
  });

  els.inventoryCount.textContent = `${state.inventory.length}枚字模`;
  els.typeList.innerHTML = items
    .map((item) => {
      const used = usage[item.id] || 0;
      const selected = item.id === state.selectedTypeId ? "selected" : "";
      return `
        <article class="type-card ${selected}" draggable="true" data-type-id="${item.id}">
          <div class="glyph" style="font-size:${Math.min(item.size, 36)}px">${escapeHtml(item.char)}</div>
          <div class="type-meta">
            <strong>${escapeHtml(item.char)} · ${escapeHtml(item.style)}</strong>
            <span>${item.size}px · 已用${used}/${item.quantity}</span>
            <span class="tag-row">
              <em class="wear-tag wear-${item.wear}">${escapeHtml(item.wear)}</em>
              ${isLocked() ? `<em class="on-lock-tag">锁版中</em>` : ""}
            </span>
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
  els.stage.className = `stage ${state.settings.paperSize} ${isLocked() ? "locked" : ""}`;
  els.stage.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  els.stage.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
  els.stage.style.gap = `${state.settings.gridGap}px`;
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const placement = map.get(placementKey(row, col));
      const type = placement ? state.inventory.find((item) => item.id === placement.typeId) : null;
      const vertical = state.settings.flowMode === "vertical" ? "vertical" : "";
      const title = isLocked() ? `aria-disabled="true" title="已锁版，落字须先填写改版依据"` : "";
      cells.push(`
        <button class="cell ${type ? "used" : ""} ${vertical}" data-row="${row}" data-col="${col}" type="button" aria-label="第${row + 1}行第${col + 1}列" ${title}>
          ${type ? escapeHtml(type.char) : ""}
        </button>
      `);
    }
  }
  els.stage.innerHTML = cells.join("");
  const stageWrap = els.stage.parentElement;
  let seal = stageWrap.querySelector(".stage-seal");
  if (!seal) {
    seal = document.createElement("div");
    seal.classList.add("stage-seal");
    stageWrap.appendChild(seal);
  }
  seal.className = `stage-seal ${isLocked() ? "locked" : "proofing"}`;
  seal.textContent = isLocked() ? "锁版送印" : "待校对";
}

function renderUsage() {
  const usage = getUsage();
  const entries = state.inventory.filter((item) => usage[item.id]);
  els.placedCount.innerHTML = `${state.placements.length}个落字 <em class="lock-chip ${isLocked() ? "locked" : "proofing"}">${isLocked() ? "已锁版" : "待校对"}</em>`;

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
        const worn = item.wear === "旧痕" ? `<em class="wear-tag wear-旧痕">旧痕</em>` : "";
        const lockedMark = isLocked() ? `<em class="lock-mini">锁</em>` : "";
        return `
          <div class="usage-item ${warn}">
            <strong>${lockedMark}${escapeHtml(item.char)} ${escapeHtml(item.style)} ${worn}</strong>
            <span>${used}/${item.quantity}</span>
          </div>
        `;
      })
      .join("") || `<p class="empty">还没有落字。</p>`;
}

function renderDrafts() {
  els.draftList.innerHTML =
    state.drafts
      .map((draft) => {
        const locked = draft.lock && draft.lock.status === "locked";
        const revisionCount = draft.lock && draft.lock.revisions ? draft.lock.revisions.length : 0;
        const chip = locked
          ? `<em class="draft-chip locked">已锁版${revisionCount ? ` · 改版${revisionCount}` : ""}</em>`
          : revisionCount
            ? `<em class="draft-chip proofing">待校对 · 改版${revisionCount}</em>`
            : `<em class="draft-chip proofing">待校对</em>`;
        return `
          <article class="draft-item">
            <strong>${escapeHtml(draft.title)}</strong>
            <span>${draft.placements.length}个落字 · ${new Date(draft.savedAt).toLocaleString("zh-CN")}</span>
            ${chip}
            <div class="draft-actions">
              <button type="button" data-load-draft="${draft.id}">载入</button>
              <button type="button" data-delete-draft="${draft.id}">删除</button>
            </div>
          </article>
        `;
      })
      .join("") || `<p class="empty">还没有保存草稿。</p>`;
}

function renderLockPanel() {
  const locked = isLocked();
  els.proofingView.hidden = locked;
  els.lockedView.hidden = !locked;

  els.lockStatusChip.textContent = locked ? "已锁版" : "待校对";
  els.lockStatusChip.className = `lock-chip ${locked ? "locked" : "proofing"}`;
  els.lockBadge.textContent = locked ? "已锁版 · 送印中" : "待校对";
  els.lockBadge.className = `badge ${locked ? "locked" : "idle"}`;

  if (!locked) {
    // 不要在用户正在输入时把表单值覆盖掉
    if (document.activeElement !== els.printCountInput) {
      els.printCountInput.value = state.lock.printCount ?? "";
    }
    if (document.activeElement !== els.proofreaderInput) {
      els.proofreaderInput.value = state.lock.proofreader ?? "";
    }

    const evaluation = evaluateLock();
    els.lockChecklist.innerHTML = evaluation.checks
      .map((check) => `<li class="${check.ok ? "ok" : "bad"}"><span>${check.ok ? "✓" : "!"}</span>${escapeHtml(check.label)}</li>`)
      .join("");

    const failed = evaluation.checks.filter((check) => !check.ok).map((check) => check.label);
    els.lockErrors.hidden = failed.length === 0;
    els.lockErrors.innerHTML = failed.length
      ? `<strong>无法锁版：</strong><br>${failed.map(escapeHtml).join("<br>")}`
      : "";

    els.revisionList.innerHTML =
      state.lock.revisions
        .map(
          (revision) => `
            <div class="revision-item">
              <strong>${escapeHtml(revision.summary)}</strong>
              <span class="revision-reason">依据：${escapeHtml(revision.reason)}</span>
              <span class="revision-meta">${formatTime(revision.at)}</span>
            </div>
          `
        )
        .join("") || `<p class="empty">暂无改版记录，清空记录后即可再次锁版。</p>`;
    els.clearRevisionsBtn.disabled = state.lock.revisions.length === 0;
  } else {
    const rows = [
      ["印数", `${state.lock.printCount} 张`],
      ["校对人", state.lock.proofreader],
      ["锁版时间", formatTime(state.lock.lockedAt)]
    ];
    els.lockMeta.innerHTML = rows.map(([term, value]) => `<dt>${term}</dt><dd>${escapeHtml(value)}</dd>`).join("");
  }
}

function renderAll() {
  saveState();
  renderSettings();
  renderStyleFilter();
  renderInventory();
  renderStage();
  renderUsage();
  renderDrafts();
  renderLockPanel();
}

// ---- 改版依据弹窗：锁版后任何作品设置 / 字模 / 落字调整都必须先填写依据 ----
let revisionResolver = null;

function openRevisionDialog(summary) {
  return new Promise((resolve) => {
    els.revisionSummary.textContent = summary;
    els.revisionReason.value = "";
    els.revisionFormHint.hidden = true;
    els.revisionModal.hidden = false;
    els.revisionReason.focus();
    revisionResolver = resolve;
  });
}

function closeRevisionDialog(result) {
  if (revisionResolver) {
    revisionResolver(result);
    revisionResolver = null;
  }
  els.revisionModal.hidden = true;
}

// 锁版后返回用户填写的改版依据；取消返回 null。待校对状态下无需依据，返回空字符串。
async function requireRevision(summary) {
  if (!isLocked()) return "";
  return openRevisionDialog(summary);
}

// 确认改版：回到待校对，并追加一条改版记录
function registerRevision(summary, reason) {
  state.lock.status = "proofing";
  state.lock.lockedAt = null;
  state.lock.revisions.push({
    id: crypto.randomUUID(),
    summary,
    reason,
    at: new Date().toISOString()
  });
}

function placeType(row, col, typeId = state.selectedTypeId) {
  if (!typeId) return;
  const existingIndex = state.placements.findIndex((item) => item.row === row && item.col === col);
  if (existingIndex >= 0) {
    const current = state.placements[existingIndex];
    if (current.typeId === typeId) {
      state.placements.splice(existingIndex, 1);
    } else {
      state.placements[existingIndex] = { ...current, typeId };
    }
  } else {
    state.placements.push({ row, col, typeId });
  }
}

function placementSummary(row, col, typeId) {
  const existing = state.placements.find((item) => item.row === row && item.col === col);
  const type = state.inventory.find((item) => item.id === typeId);
  const position = `第${row + 1}行第${col + 1}列`;
  if (existing && existing.typeId === typeId) return `撤下${position}的「${type?.char || "字"}」`;
  if (existing) {
    const oldType = state.inventory.find((item) => item.id === existing.typeId);
    return `${position}由「${oldType?.char || "空"}」改排为「${type?.char || "字"}」`;
  }
  return `在${position}落字「${type?.char || "字"}」`;
}

async function addType(event) {
  event.preventDefault();
  const item = {
    id: crypto.randomUUID(),
    char: els.charInput.value.trim(),
    style: els.styleInput.value.trim(),
    size: Number(els.sizeInput.value),
    quantity: Number(els.quantityInput.value),
    wear: els.wearInput.value
  };
  if (!item.char || !item.style) return;
  const summary = `向字模库加入「${item.char} · ${item.style}」`;
  const reason = await requireRevision(summary);
  if (reason === null) return;
  state.inventory.unshift(item);
  state.selectedTypeId = item.id;
  if (isLocked()) registerRevision(summary, String(reason));
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
    lock: structuredClone(state.lock),
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
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "bold 28px sans-serif";
  const title = state.settings.workTitle || "未命名作品";
  ctx.fillText(truncateCanvas(ctx, title, width - margin * 2 - 90), margin, 50);

  const locked = isLocked();
  ctx.font = "15px sans-serif";
  ctx.fillStyle = locked ? "#a64037" : "#6f675c";
  const info = locked
    ? `已锁版送印 · 印数 ${state.lock.printCount} 张 · 校对 ${state.lock.proofreader} · ${formatTime(state.lock.lockedAt)}`
    : `待校对 · ${state.placements.length}个落字 · 印数/校对人锁版前填写`;
  ctx.fillText(truncateCanvas(ctx, info, width - margin * 2 - 90), margin, 78);

  // 锁版状态印章（竖排红印）
  ctx.save();
  ctx.translate(width - margin - 22, margin + 10);
  ctx.strokeStyle = locked ? "#a64037" : "#b7862c";
  ctx.fillStyle = locked ? "#a64037" : "#b7862c";
  ctx.lineWidth = 2;
  ctx.strokeRect(-30, 0, 52, 86);
  ctx.font = 'bold 22px "PingFang SC", "Microsoft YaHei", serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const sealText = locked ? "锁版" : "待校";
  [...sealText].forEach((ch, index) => {
    ctx.fillText(ch, -4, 22 + index * 26);
  });
  ctx.restore();

  ctx.font = "bold 30px serif";
  state.placements.forEach((placement) => {
    const type = state.inventory.find((item) => item.id === placement.typeId);
    if (!type) return;
    const x = margin + placement.col * (cell + gap);
    const y = margin + 45 + placement.row * (cell + gap);
    ctx.fillStyle = type.wear === "旧痕" ? "#5c5142" : "#2f2921";
    ctx.fillRect(x, y, cell, cell);
    ctx.fillStyle = "#fff5df";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.min(type.size + 8, 42)}px serif`;
    ctx.fillText(type.char, x + cell / 2, y + cell / 2);
  });
  const link = document.createElement("a");
  link.download = `${state.settings.workTitle || "movable-type"}${locked ? "-锁版" : ""}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function truncateCanvas(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---- 设置区 ----
els.paperSize.addEventListener("change", async () => {
  const next = els.paperSize.value;
  if (next === state.settings.paperSize) return;
  const label = els.paperSize.options[els.paperSize.selectedIndex].textContent;
  const summary = `纸张改为「${label}」`;
  const reason = await requireRevision(summary);
  if (!reason) {
    els.paperSize.value = state.settings.paperSize;
    return;
  }
  state.settings.paperSize = next;
  const grid = getGrid();
  const before = state.placements.length;
  state.placements = state.placements.filter((item) => item.row < grid.rows && item.col < grid.cols);
  const removed = before - state.placements.length;
  if (isLocked()) {
    registerRevision(
      removed ? `${summary}，${removed}个落字超出新网格被移除` : summary,
      String(reason)
    );
  }
  renderAll();
});

els.flowMode.addEventListener("change", async () => {
  const next = els.flowMode.value;
  if (next === state.settings.flowMode) return;
  const label = els.flowMode.options[els.flowMode.selectedIndex].textContent;
  const summary = `排版方向改为「${label}」`;
  const reason = await requireRevision(summary);
  if (!reason) {
    els.flowMode.value = state.settings.flowMode;
    return;
  }
  state.settings.flowMode = next;
  if (isLocked()) registerRevision(summary, String(reason));
  renderAll();
});

els.gridGap.addEventListener("change", async () => {
  const next = Number(els.gridGap.value);
  if (next === state.settings.gridGap) return;
  const summary = `网格间距改为 ${next}px`;
  const reason = await requireRevision(summary);
  if (!reason) {
    els.gridGap.value = state.settings.gridGap;
    return;
  }
  state.settings.gridGap = next;
  if (isLocked()) registerRevision(summary, String(reason));
  renderAll();
});

els.workTitle.addEventListener("change", async () => {
  const next = els.workTitle.value;
  if (next === state.settings.workTitle) return;
  const summary = `作品名改为「${next.trim() || "未命名作品"}」`;
  const reason = await requireRevision(summary);
  if (!reason) {
    els.workTitle.value = state.settings.workTitle;
    return;
  }
  state.settings.workTitle = next;
  if (isLocked()) registerRevision(summary, String(reason));
  renderAll();
});

// 锁版前输入直接落本地；锁版后允许先在框内编辑，确认失焦时再走改版弹窗
els.workTitle.addEventListener("input", () => {
  if (isLocked()) return;
  state.settings.workTitle = els.workTitle.value;
  saveState();
});

els.gridGap.addEventListener("input", () => {
  if (isLocked()) return;
  state.settings.gridGap = Number(els.gridGap.value);
  renderStage();
  saveState();
});

els.typeForm.addEventListener("submit", addType);
els.inventorySearch.addEventListener("input", renderInventory);
els.styleFilter.addEventListener("change", renderInventory);
els.wearFilter.addEventListener("change", renderInventory);
els.saveDraftBtn.addEventListener("click", saveDraft);
els.exportBtn.addEventListener("click", exportPreview);

els.clearBoardBtn.addEventListener("click", async () => {
  if (state.placements.length === 0) return;
  const summary = "清空整个版面的全部落字";
  const reason = await requireRevision(summary);
  if (reason === null) return;
  state.placements = [];
  if (isLocked()) registerRevision(summary, String(reason));
  renderAll();
});

els.typeList.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-delete-type]");
  if (deleteButton) {
    const typeId = deleteButton.dataset.deleteType;
    const item = state.inventory.find((entry) => entry.id === typeId);
    const used = state.placements.filter((placement) => placement.typeId === typeId).length;
    const summary = `删除字模「${item?.char || "字"} · ${item?.style || ""}」${used ? `（${used}个落字一并移除）` : ""}`;
    const reason = await requireRevision(summary);
    if (reason === null) return;
    state.inventory = state.inventory.filter((entry) => entry.id !== typeId);
    state.placements = state.placements.filter((placement) => placement.typeId !== typeId);
    if (state.selectedTypeId === typeId) state.selectedTypeId = state.inventory[0]?.id || null;
    if (isLocked()) registerRevision(summary, String(reason));
    renderAll();
    return;
  }
  const card = event.target.closest("[data-type-id]");
  if (!card) return;
  state.selectedTypeId = card.dataset.typeId;
  renderInventory();
  renderUsage();
});

els.typeList.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-type-id]");
  if (!card) return;
  event.dataTransfer.setData("text/plain", card.dataset.typeId);
});

els.stage.addEventListener("dragover", (event) => {
  if (event.target.closest(".cell")) event.preventDefault();
});

els.stage.addEventListener("drop", async (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  event.preventDefault();
  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  const typeId = event.dataTransfer.getData("text/plain");
  if (!typeId) return;
  const summary = placementSummary(row, col, typeId);
  const reason = await requireRevision(summary);
  if (reason === null) return;
  placeType(row, col, typeId);
  if (isLocked()) registerRevision(summary, String(reason));
  renderAll();
});

els.stage.addEventListener("click", async (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  if (!state.selectedTypeId) return;
  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  const summary = placementSummary(row, col, state.selectedTypeId);
  const reason = await requireRevision(summary);
  if (reason === null) return;
  placeType(row, col);
  if (isLocked()) registerRevision(summary, String(reason));
  renderAll();
});

// ---- 锁版 ----
els.printCountInput.addEventListener("input", () => {
  state.lock.printCount = els.printCountInput.value;
  saveState();
  renderLockPanel();
});

els.proofreaderInput.addEventListener("input", () => {
  state.lock.proofreader = els.proofreaderInput.value;
  saveState();
  renderLockPanel();
});

els.lockForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const evaluation = evaluateLock();
  if (!evaluation.ok) {
    // 任一条件不满足：整次拒绝，版面不变
    renderLockPanel();
    els.lockErrors.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }],
      { duration: 220 }
    );
    return;
  }
  state.lock.status = "locked";
  state.lock.printCount = Number(state.lock.printCount);
  state.lock.proofreader = state.lock.proofreader.trim();
  state.lock.lockedAt = new Date().toISOString();
  renderAll();
});

els.clearRevisionsBtn.addEventListener("click", () => {
  if (state.lock.revisions.length === 0) return;
  state.lock.revisions = [];
  renderAll();
});

// ---- 改版弹窗 ----
els.revisionConfirmBtn.addEventListener("click", () => {
  const reason = els.revisionReason.value.trim();
  if (!reason) {
    els.revisionFormHint.hidden = false;
    els.revisionReason.focus();
    return;
  }
  closeRevisionDialog(reason);
});

els.revisionCancelBtn.addEventListener("click", () => closeRevisionDialog(null));
els.revisionModal.addEventListener("click", (event) => {
  if (event.target === els.revisionModal) closeRevisionDialog(null);
});
els.revisionReason.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    els.revisionConfirmBtn.click();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.revisionModal.hidden) closeRevisionDialog(null);
});

// ---- 草稿 ----
els.draftList.addEventListener("click", async (event) => {
  const loadButton = event.target.closest("[data-load-draft]");
  const deleteButton = event.target.closest("[data-delete-draft]");
  if (loadButton) {
    const draft = state.drafts.find((item) => item.id === loadButton.dataset.loadDraft);
    if (!draft) return;
    const boardLocked = isLocked();
    let revisionReason = "";
    if (boardLocked) {
      // 锁版中载入草稿属于版面/设置调整，必须填写改版依据，载入后回到待校对
      const confirmed = await requireRevision(`载入草稿「${draft.title}」，载入后回到待校对并追加改版记录`);
      if (confirmed === null) return;
      revisionReason = confirmed;
    }
    state.settings = structuredClone(draft.settings);
    state.placements = structuredClone(draft.placements);
    state.lock = {
      ...structuredClone(defaultState.lock),
      ...structuredClone(draft.lock || {}),
      revisions: Array.isArray(draft.lock?.revisions) ? structuredClone(draft.lock.revisions) : []
    };
    if (boardLocked) {
      state.lock.status = "proofing";
      state.lock.lockedAt = null;
      state.lock.revisions.push({
        id: crypto.randomUUID(),
        summary: `载入草稿「${draft.title}」`,
        reason: revisionReason,
        at: new Date().toISOString()
      });
    }
    renderAll();
  }
  if (deleteButton) {
    state.drafts = state.drafts.filter((item) => item.id !== deleteButton.dataset.deleteDraft);
    renderAll();
  }
});

renderAll();
