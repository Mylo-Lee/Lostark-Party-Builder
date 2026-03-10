import { SYN_TYPES, CLASSES } from './data.js';
import * as State from './state.js';
import { saveState } from './state.js';
import { getActiveParty } from './party.js';
import { filterDropdown } from './dropdown.js';

// ── 헬퍼 ──────────────────────────────────────────────────────

/**
 * 캐릭터 ID로 {player, char} 쌍을 찾습니다.
 * @param {number} cid
 */
function findChar(cid) {
  for (const p of State.players) {
    const c = p.chars.find(c => c.id === cid);
    if (c) return { player: p, char: c };
  }
  // 미할당 캐릭터도 탐색
  if (State.unassignedChars) {
    const uc = State.unassignedChars.find(c => c.id === cid);
    if (uc) return { player: { id: 'unassigned', name: '미할당', color: '#888' }, char: uc };
  }
  return null;
}

/**
 * 파티에 배치된 {player, char} 쌍 목록을 반환합니다.
 * @param {{slots:Array}} party
 */
function getPartyChars(party) {
  return party.slots
    .filter(x => x !== null)
    .map(cid => findChar(cid))
    .filter(Boolean);
}

// ── 렌더링 메인 ───────────────────────────────────────────────

/** 모든 UI를 갱신합니다. */
export function renderAll() {
  renderTabs();
  renderPartySlots();
  renderSynergy();
  renderAllSummary();
  renderExpeditions();
  renderTempStorage();
  saveState();
}

/** 플레이어 리스트 (하위 호환용 — addPlayer 등에서 호출) */
export function renderPlayerList() {
  renderExpeditions();
  renderTempStorage();
}

// ── 파티 탭 ───────────────────────────────────────────────────

export function renderTabs() {
  document.getElementById('partyTabs').innerHTML = State.parties.map(p => `
    <div class="party-tab ${p.id === State.activePartyId ? 'active' : ''}"
         onclick="App.setActiveParty(${p.id})">
      ${p.label}
      ${State.parties.length > 1
      ? `<span class="tab-close" onclick="event.stopPropagation(); App.removeParty(${p.id})">×</span>`
      : ''}
    </div>
  `).join('');

  const ap = getActiveParty();
  if (ap) document.getElementById('activePartyLabel').textContent = ap.label;
}

// ── 원정대 관리 (가운데 컬럼) ─────────────────────────────────

export function renderExpeditions() {
  const rosterList = document.getElementById('rosterList');
  if (!rosterList) return;

  const ap = getActiveParty();
  const activeSlots = ap ? ap.slots : [];
  const partyFull = activeSlots.filter(x => x !== null).length >= 4;

  const partyPlayerIds = new Set(
    activeSlots
      .filter(x => x !== null)
      .map(cid => { const r = findChar(cid); return r ? r.player.id : null; })
      .filter(x => x && x !== 'unassigned')
  );

  const usedElsewhere = new Map();
  State.parties.forEach(party => {
    if (party.id === State.activePartyId) return;
    party.slots.filter(x => x !== null).forEach(cid => {
      if (!usedElsewhere.has(cid)) usedElsewhere.set(cid, []);
      usedElsewhere.get(cid).push(party.label);
    });
  });

  if (!State.players.length) {
    rosterList.innerHTML = '<div class="empty-hint" style="padding:20px 10px;">원정대를 추가하고<br>캐릭터를 드래그하여 등록하세요</div>';
  } else {
    rosterList.innerHTML = State.players.map(p => buildPlayerBlockHTML(p, {
      activeSlots, partyFull, partyPlayerIds, usedElsewhere,
    })).join('');
  }

  // 열린 플레이어의 드롭다운 목록 초기화
  State.players.forEach(p => { if (p.open) filterDropdown(p.id); });
}

// ── 임시 보관함 (오른쪽 컬럼) ─────────────────────────────────

export function renderTempStorage() {
  const unassignedArea = document.getElementById('unassignedArea');
  const tempCount = document.getElementById('tempCount');
  if (!unassignedArea) return;

  const ap = getActiveParty();
  const activeSlots = ap ? ap.slots : [];
  const partyFull = activeSlots.filter(x => x !== null).length >= 4;

  const usedElsewhere = new Map();
  State.parties.forEach(party => {
    if (party.id === State.activePartyId) return;
    party.slots.filter(x => x !== null).forEach(cid => {
      if (!usedElsewhere.has(cid)) usedElsewhere.set(cid, []);
      usedElsewhere.get(cid).push(party.label);
    });
  });

  if (tempCount) tempCount.textContent = State.unassignedChars.length;

  if (State.unassignedChars && State.unassignedChars.length > 0) {
    const cardsHtml = State.unassignedChars.map(c =>
      buildCharCardHTML(c, null, { activeSlots, partyFull, pInParty: false, usedElsewhere, source: 'unassigned' })
    ).join('');
    unassignedArea.innerHTML = cardsHtml;
  } else {
    unassignedArea.innerHTML = '<div class="empty-hint" style="padding:20px 10px;">검색 후 캐릭터를 추가하면<br>이곳에 임시 보관됩니다</div>';
  }
}

// ── 플레이어(원정대) 블록 HTML ────────────────────────────────

function buildPlayerBlockHTML(p, { activeSlots, partyFull, partyPlayerIds, usedElsewhere }) {
  const pInParty = partyPlayerIds.has(p.id);
  const pr = State.playerPR[p.id] || 'must';
  const curClsName = State.selectedClass[p.id] || CLASSES[0].name;
  const curCls = CLASSES.find(c => c.name === curClsName) || CLASSES[0];

  const charsHtml = p.chars.length
    ? p.chars.map(c => buildCharCardHTML(c, p, { activeSlots, partyFull, pInParty, usedElsewhere })).join('')
    : `<div style="font-size:12px;color:var(--text-dim);padding:4px 2px;">캐릭터를 드래그하여 추가하세요</div>`;

  const inPartyBadge = pInParty
    ? `<div style="font-size:11px;padding:2px 8px;border-radius:7px;background:rgba(200,150,42,.15);color:var(--gold-light);border:1px solid var(--gold-dim);font-weight:600;">IN</div>`
    : '';

  const nameInputHtml = `<input class="player-name-input" type="text" value="${p.name}" 
                         placeholder="원정대명" 
                         style="background: transparent; border: none; outline: none; color:${p.color}; font-size:14px; font-weight:700; width: 100%; border-bottom: 1px dashed ${p.color}55;"
                         onclick="event.stopPropagation()" 
                         onchange="App.renamePlayer(${p.id}, this.value)" 
                         onblur="App.renamePlayer(${p.id}, this.value)" />`;

  return `
    <div class="player-block" style="border-color:${p.color}33;"
         ondragover="App.allowDrop(event)"
         ondragenter="App.dragEnter(event)"
         ondragleave="App.dragLeave(event)"
         ondrop="App.dropChar(event, ${p.id})">
      <div class="player-header" onclick="App.togglePlayer(${p.id})">
        <div class="player-color-bar" style="background:${p.color};"></div>
        <div class="player-name-text" style="color:${p.color}; display: flex; align-items:center;">
          ${nameInputHtml}
        </div>
        <div class="player-meta">
          <span class="player-char-count">${p.chars.length}캐릭</span>
          ${inPartyBadge}
          <span class="player-toggle ${p.open ? 'open' : ''}">▶</span>
          <button class="btn-icon" style="font-size:15px;"
                  onclick="event.stopPropagation(); App.removePlayer(${p.id})">×</button>
        </div>
      </div>

      <div class="player-body ${p.open ? '' : 'hidden'}">
        <!-- 직업 선택 드롭다운 -->
        <div class="row" style="margin-bottom:0;">
          <div class="search-select-wrap">
            <input class="search-input" id="ddi-${p.id}" readonly
                   value="${curCls.icon}  ${curCls.name}"
                   onclick="App.toggleDropdown(${p.id}, event)"
                   placeholder="직업 직접선택...">
            <span class="search-input-arrow">▾</span>
            <div class="search-dropdown" id="dd-${p.id}" onclick="event.stopPropagation()">
              <input class="search-filter-input" id="ddf-${p.id}"
                     placeholder="직업 검색..."
                     oninput="App.filterDropdown(${p.id})"
                     onkeydown="event.stopPropagation()">
              <div class="search-list" id="ddl-${p.id}"></div>
            </div>
          </div>
          <button class="btn-gold" onclick="App.addChar(${p.id})" style="padding:9px 16px;">+</button>
        </div>

        <!-- PR 선택 -->
        <div class="pr-mini">
          <button class="pr-mini-btn must ${pr === 'must' ? 'active' : ''}"
                  id="prb-${p.id}-must" onclick="App.setPlayerPR(${p.id}, 'must')">■ 필수</button>
          <button class="pr-mini-btn flex ${pr === 'flex' ? 'active' : ''}"
                  id="prb-${p.id}-flex" onclick="App.setPlayerPR(${p.id}, 'flex')">◈ 세팅</button>
          <button class="pr-mini-btn nope ${pr === 'nope' ? 'active' : ''}"
                  id="prb-${p.id}-nope" onclick="App.setPlayerPR(${p.id}, 'nope')">✕ 비추</button>
        </div>

        <!-- 캐릭터 목록 -->
        <div style="margin-top:10px;">${charsHtml}</div>
      </div>
    </div>`;
}

// ── 캐릭터 카드 HTML ──────────────────────────────────────────

/**
 * 캐릭터 카드 HTML을 생성합니다.
 * 직업 아이콘 + 캐릭터 닉네임 + 아이템 레벨 표시
 */
function buildCharCardHTML(c, player, { activeSlots, partyFull, pInParty, usedElsewhere, source }) {
  const inParty = activeSlots.includes(c.id);
  const playerAlreadyIn = pInParty && !inParty;
  const disabled = (partyFull && !inParty) || playerAlreadyIn;
  const others = usedElsewhere.get(c.id);

  const jsSourceParam = source === 'unassigned' ? `'unassigned'` : player.id;
  const jsRemoveHandler = source === 'unassigned'
    ? `event.stopPropagation(); App.removeChar('unassigned', ${c.id})`
    : `event.stopPropagation(); App.removeChar(${player.id}, ${c.id})`;

  const removeBtnHtml = `<button class="btn-icon" style="font-size:14px;"
               onclick="${jsRemoveHandler}">×</button>`;

  // 캐릭터명: charName이 있으면 표시, 없으면 직업명만
  const displayName = c.charName || c.cls.name;
  // 아이템 레벨
  const levelText = c.itemLevel ? `Lv.${c.itemLevel}` : '';

  return `
    <div class="char-card pr-${c.pr} ${inParty ? 'in-party' : ''} ${disabled ? 'disabled-card' : ''}"
         draggable="true"
         ondragstart="App.dragStart(event, ${jsSourceParam}, ${c.id})"
         ondragend="this.classList.remove('dragging')"
         onclick="App.toggleChar(${c.id})">
      <div class="class-icon ${c.cls.role}">${c.cls.icon}</div>
      <div style="flex:1;min-width:0;">
        <div class="char-class-name">${displayName}</div>
        ${c.charName ? `<div style="font-size:11px;color:var(--text-dim);">${c.cls.name}</div>` : ''}
        ${others ? `<div class="char-other-party">[${others.join(', ')}]</div>` : ''}
      </div>
      ${levelText ? `<div class="sr-level" style="font-size:12px;font-weight:700;color:var(--gold-light);white-space:nowrap;">${levelText}</div>` : ''}
      ${removeBtnHtml}
    </div>`;
}

// ── 파티 슬롯 ─────────────────────────────────────────────────

export function renderPartySlots() {
  const party = getActiveParty();
  const container = document.getElementById('partySlots');
  if (!party) { container.innerHTML = ''; return; }

  const count = party.slots.filter(x => x !== null).length;
  document.getElementById('slotCount').textContent = count;

  container.innerHTML = party.slots.map((cid, i) => {
    if (cid === null) {
      return `<div class="slot">
        <div class="slot-num">${i + 1}</div>
        <div style="font-size:20px;color:var(--text-dim);">+</div>
        <div class="slot-empty-text">빈 슬롯</div>
      </div>`;
    }
    const r = findChar(cid);
    if (!r) return '';
    const displayName = r.char.charName || r.char.cls.name;
    const levelText = r.char.itemLevel ? `Lv.${r.char.itemLevel}` : '';
    return `<div class="slot filled">
      <div class="slot-num">${i + 1}</div>
      <button class="btn-icon" onclick="App.removeFromSlot(${i})">×</button>
      <div class="slot-icon">${r.char.cls.icon}</div>
      <div class="slot-char-name">${displayName}</div>
      <div class="slot-class-name">${r.char.cls.name}</div>
      ${levelText ? `<div style="font-size:11px;color:var(--gold-light);font-weight:600;margin-top:2px;">${levelText}</div>` : ''}
      <div class="slot-player-name"
           style="background:${r.player.color}22;color:${r.player.color};border:1px solid ${r.player.color}44;">
        ${r.player.name}
      </div>
    </div>`;
  }).join('');

  renderPartyWarning(party, count);
}

/**
 * 파티 구성 경고 메시지를 렌더링합니다.
 */
function renderPartyWarning(party, count) {
  const warn = document.getElementById('partyWarning');
  const chars = getPartyChars(party).map(r => r.char);
  const supporters = chars.filter(c => c.cls.role === 'support');

  if (!count) { warn.innerHTML = ''; return; }

  let msg = '';
  if (count < 4) {
    msg = `<div class="party-warning info">📋 ${4 - count}명 더 선택해주세요</div>`;
  } else if (!supporters.length) {
    msg = `<div class="party-warning warn">⚠ 서포터 없음 — 생존 및 버프 없이 진행</div>`;
  } else if (supporters.length >= 2) {
    msg = `<div class="party-warning ok">✅ 서포터 ${supporters.length}명 포함 — 안정적인 구성</div>`;
  } else {
    msg = `<div class="party-warning info">ℹ 서포터 1명 — 추가 서포터 배치 시 더 안정적</div>`;
  }
  warn.innerHTML = msg;
}

// ── 시너지 분석 ───────────────────────────────────────────────

export function renderSynergy() {
  const panel = document.getElementById('synergyPanel');
  const party = getActiveParty();
  const emptyHint = '<div class="empty-hint">파티를 구성하면 시너지 분석이 표시됩니다</div>';

  if (!party) { panel.innerHTML = emptyHint; return; }
  const chars = getPartyChars(party).map(r => r.char);
  if (!chars.length) { panel.innerHTML = emptyHint; return; }

  const { synMap, present, missing } = buildSynMap(chars);

  const gridHtml = SYN_TYPES.map(s => {
    const providers = synMap[s.key];
    const active = providers.length > 0;
    return `<div class="syn-item ${active ? 'active' : ''}">
      <div class="syn-dot" style="background:${active ? s.color : 'var(--border)'}"></div>
      <div>
        <div class="syn-name" style="color:${active ? s.color : 'var(--text-dim)'}">${s.key}</div>
        <div class="syn-from">${active ? providers.join(', ') : '—'}</div>
      </div>
    </div>`;
  }).join('');

  panel.innerHTML = `
    <div class="syn-grid">${gridHtml}</div>
    <div style="margin-top:12px;padding:11px 14px;background:var(--bg-card);border-radius:8px;border:1px solid var(--border);">
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:6px;letter-spacing:1px;">SUMMARY</div>
      <div style="font-size:14px;line-height:2;">
        ✅ 보유: <span style="color:var(--gold-light);font-weight:700;">${present.length}종</span>
        &nbsp;&nbsp;
        ❌ 부재: <span style="color:#f87171;font-weight:700;">${missing.length}종</span>
      </div>
      ${missing.length
      ? `<div style="font-size:12px;color:var(--text-dim);margin-top:4px;">부재: ${missing.map(s => s.key).join(', ')}</div>`
      : ''}
    </div>`;
}

// ── 전체 파티 요약 ────────────────────────────────────────────

export function renderAllSummary() {
  const el = document.getElementById('allPartySummary');
  const body = document.getElementById('allPartySummaryBody');

  if (State.parties.length <= 1) { el.style.display = 'none'; return; }
  el.style.display = 'block';

  body.innerHTML = State.parties.map(party => {
    const chars = getPartyChars(party).map(r => r.char);
    const isActive = party.id === State.activePartyId;

    if (!chars.length) {
      return `<div class="summary-card ${isActive ? 'active-party' : ''}"
                   onclick="App.setActiveParty(${party.id})">
        <div class="summary-card-title">${party.label}</div>
        <div class="summary-members">비어있음</div>
      </div>`;
    }

    const { present, missing } = buildSynMap(chars);
    const supporters = chars.filter(c => c.cls.role === 'support');
    const members = chars.map(c => `${c.cls.icon} ${c.charName || c.cls.name}`).join('  /  ');
    const missingText = missing.length
      ? `<span style="color:#f87171;">부재 ${missing.length}종 (${missing.map(s => s.key).join(', ')})</span>`
      : `<span style="color:#69f0ae;font-weight:600;">전체 커버</span>`;

    return `<div class="summary-card ${isActive ? 'active-party' : ''}"
                 onclick="App.setActiveParty(${party.id})">
      <div class="summary-card-title">${party.label}
        <span style="font-size:11px;color:var(--text-dim);font-weight:400;">(클릭하여 전환)</span>
      </div>
      <div class="summary-members">${members}</div>
      <div style="font-size:13px;line-height:1.9;">
        서포터 <span style="color:var(--support-color);font-weight:600;">${supporters.length}명</span>
        &nbsp;&nbsp; 시너지 <span style="color:var(--gold-light);font-weight:600;">${present.length}종</span>
        &nbsp;&nbsp; ${missingText}
      </div>
    </div>`;
  }).join('');
}

// ── 시너지 계산 헬퍼 ──────────────────────────────────────────

function buildSynMap(chars) {
  const synMap = {};
  SYN_TYPES.forEach(s => { synMap[s.key] = []; });
  chars.forEach(c => c.cls.syn.forEach(s => { if (synMap[s]) synMap[s].push(c.cls.name); }));

  const present = SYN_TYPES.filter(s => synMap[s.key].length > 0);
  const missing = SYN_TYPES.filter(s => synMap[s.key].length === 0);

  return { synMap, present, missing };
}
