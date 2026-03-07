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
  renderPlayerList();
  renderTabs();
  renderPartySlots();
  renderSynergy();
  renderAllSummary();
  saveState(); // localStorage에 상태 저장
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

// ── 플레이어 목록 ─────────────────────────────────────────────

export function renderPlayerList() {
  const list = document.getElementById('playerList');
  document.getElementById('playerCount').textContent = State.players.length + '명';

  if (!State.players.length) {
    list.innerHTML = '<div class="empty-hint">이름을 추가하면<br>캐릭터를 등록할 수 있습니다</div>';
    return;
  }

  const ap = getActiveParty();
  const activeSlots = ap ? ap.slots : [];
  const partyFull = activeSlots.filter(x => x !== null).length >= 4;

  // 현재 파티에 포함된 플레이어 ID 집합
  const partyPlayerIds = new Set(
    activeSlots
      .filter(x => x !== null)
      .map(cid => { const r = findChar(cid); return r ? r.player.id : null; })
      .filter(Boolean)
  );

  // 다른 파티에서 사용 중인 캐릭터 → 파티 레이블 매핑
  const usedElsewhere = new Map();
  State.parties.forEach(party => {
    if (party.id === State.activePartyId) return;
    party.slots.filter(x => x !== null).forEach(cid => {
      if (!usedElsewhere.has(cid)) usedElsewhere.set(cid, []);
      usedElsewhere.get(cid).push(party.label);
    });
  });

  list.innerHTML = State.players.map(p => buildPlayerBlockHTML(p, {
    activeSlots, partyFull, partyPlayerIds, usedElsewhere,
  })).join('');

  // 열린 플레이어의 드롭다운 목록 초기화
  State.players.forEach(p => { if (p.open) filterDropdown(p.id); });
}

/**
 * 플레이어 블록 HTML을 생성합니다.
 */
function buildPlayerBlockHTML(p, { activeSlots, partyFull, partyPlayerIds, usedElsewhere }) {
  const pInParty = partyPlayerIds.has(p.id);
  const pr = State.playerPR[p.id] || 'must';
  const curClsName = State.selectedClass[p.id] || CLASSES[0].name;
  const curCls = CLASSES.find(c => c.name === curClsName) || CLASSES[0];

  const charsHtml = p.chars.length
    ? p.chars.map(c => buildCharCardHTML(c, p, { activeSlots, partyFull, pInParty, usedElsewhere })).join('')
    : `<div style="font-size:12px;color:var(--text-dim);padding:4px 2px;">캐릭터를 추가해주세요</div>`;

  const inPartyBadge = pInParty
    ? `<div style="font-size:11px;padding:2px 8px;border-radius:7px;background:rgba(200,150,42,.15);color:var(--gold-light);border:1px solid var(--gold-dim);font-weight:600;">IN</div>`
    : '';

  return `
    <div class="player-block" style="border-color:${p.color}33;">
      <div class="player-header" onclick="App.togglePlayer(${p.id})">
        <div class="player-color-bar" style="background:${p.color};"></div>
        <div class="player-name-text" style="color:${p.color};">${p.name}</div>
        <div class="player-meta">
          <span class="player-char-count">${p.chars.length}개</span>
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
                   placeholder="직업 선택...">
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

/**
 * 캐릭터 카드 HTML을 생성합니다.
 */
function buildCharCardHTML(c, player, { activeSlots, partyFull, pInParty, usedElsewhere }) {
  const inParty = activeSlots.includes(c.id);
  const playerAlreadyIn = pInParty && !inParty;
  const disabled = (partyFull && !inParty) || playerAlreadyIn;
  const others = usedElsewhere.get(c.id);

  return `
    <div class="char-card pr-${c.pr} ${inParty ? 'in-party' : ''} ${disabled ? 'disabled-card' : ''}"
         onclick="App.toggleChar(${c.id})">
      <div class="class-icon ${c.cls.role}">${c.cls.icon}</div>
      <div style="flex:1;min-width:0;">
        <div class="char-class-name">${c.cls.name}</div>
        ${others ? `<div class="char-other-party">[${others.join(', ')}]</div>` : ''}
      </div>
      <div class="role-badge ${c.cls.role}">${c.cls.role === 'support' ? '서포' : '딜러'}</div>
      <button class="btn-icon" style="font-size:15px;"
              onclick="event.stopPropagation(); App.removeChar(${player.id}, ${c.id})">×</button>
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
    return `<div class="slot filled">
      <div class="slot-num">${i + 1}</div>
      <button class="btn-icon" onclick="App.removeFromSlot(${i})">×</button>
      <div class="slot-icon">${r.char.cls.icon}</div>
      <div class="slot-char-name">${r.char.cls.name}</div>
      <div class="slot-class-name">${r.char.cls.role === 'support' ? '서포터' : '딜러'}</div>
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
    const members = chars.map(c => `${c.cls.icon} ${c.cls.name}`).join('  /  ');
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

/**
 * 캐릭터 목록에서 시너지 맵과 보유/부재 목록을 계산합니다.
 * @param {Array} chars
 */
function buildSynMap(chars) {
  const synMap = {};
  SYN_TYPES.forEach(s => { synMap[s.key] = []; });
  chars.forEach(c => c.cls.syn.forEach(s => { if (synMap[s]) synMap[s].push(c.cls.name); }));

  const present = SYN_TYPES.filter(s => synMap[s.key].length > 0);
  const missing = SYN_TYPES.filter(s => synMap[s.key].length === 0);

  return { synMap, present, missing };
}
