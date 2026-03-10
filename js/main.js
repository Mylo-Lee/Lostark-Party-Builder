/**
 * main.js — 앱 진입점
 *
 * ES Module을 사용하지만, HTML의 onclick 속성은 전역 스코프에 접근합니다.
 * 따라서 모든 핸들러를 window.App 네임스페이스에 등록하여
 * 인라인 이벤트("App.addPlayer()" 등)가 정상 동작하도록 합니다.
 */
import { SYN_TYPES, CLASSES, PLAYER_COLORS } from './data.js';
import * as State from './state.js';
import { loadState } from './state.js';
import { addParty, removeParty, setActiveParty } from './party.js';
import {
  addPlayer, removePlayer, togglePlayer, renamePlayer,
  addChar, removeChar, setPlayerPR,
  toggleChar, removeFromSlot,
  dragStart, allowDrop, dragEnter, dragLeave, dropChar, dropToTemp
} from './player.js';
import { closeAllDropdowns, toggleDropdown, filterDropdown, selectClass } from './dropdown.js';
import { renderAll } from './render.js';
import { searchCharacter, updateCharactersDb } from './api-client.js';

// ── API 검색 + 모달 ──────────────────────────────────────────

let modalCharacters = [];   // 검색된 캐릭터 목록
let modalSelected = [];     // 선택 상태 (boolean[])
let lastSearchName = '';    // 마지막으로 검색한 이름

/**
 * API 검색 → 성공 시 모달 팝업을 엽니다.
 */
async function apiSearch() {
  const input = document.getElementById('apiSearchInput');
  const statusEl = document.getElementById('apiSearchStatus');
  const btn = document.getElementById('apiSearchBtn');

  const name = input.value.trim();
  if (!name) { alert('캐릭터명을 입력해주세요.'); return; }

  btn.disabled = true;
  btn.textContent = '...';
  statusEl.className = 'search-status loading';
  statusEl.innerHTML = '<span class="spinner"></span> 검색 중...';

  try {
    lastSearchName = name;
    const data = await searchCharacter(name);
    statusEl.className = 'search-status';
    statusEl.textContent = `✅ ${data.count}개 캐릭터 발견`;

    // 모달 상태 초기화
    modalCharacters = data.characters;
    modalSelected = data.characters.map(() => true); // 기본 전체 선택

    // DB에서 불러온 데이터인지 판별하여 뱃지/버튼 표시
    const dbBadge = document.getElementById('modalDbBadge');
    const refreshBtn = document.getElementById('modalRefreshBtn');
    if (data.fromDb) {
      dbBadge.style.display = 'inline-block';
      refreshBtn.style.display = 'inline-block';
    } else {
      dbBadge.style.display = 'none';
      refreshBtn.style.display = 'none';
    }

    // 모달 열기
    openSearchModal(name);
  } catch (err) {
    statusEl.className = 'search-status error';
    statusEl.textContent = `❌ ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.textContent = '검색';
  }
}

/**
 * 검색 결과를 모달에 표시합니다.
 */
function openSearchModal(searchName) {
  renderModalCharList();
  updateModalSelectedCount();

  document.getElementById('searchModal').classList.add('open');
  document.body.style.overflow = 'hidden'; // 배경 스크롤 방지
}

/**
 * 모달을 닫습니다.
 */
function closeSearchModal() {
  document.getElementById('searchModal').classList.remove('open');
  document.body.style.overflow = '';
}

/**
 * 모달의 캐릭터 목록을 렌더링합니다.
 */
function renderModalCharList() {
  const container = document.getElementById('modalCharList');

  container.innerHTML = modalCharacters.map((c, i) => {
    const isSupport = isClassSupport(c.CharacterClassName);
    const roleClass = isSupport ? 'support' : 'dps';
    const icon = getClassIcon(c.CharacterClassName);
    const sel = modalSelected[i] ? ' selected' : '';
    const level = c.ItemMaxLevel ? `Lv.${c.ItemMaxLevel}` : `Lv.${c.CharacterLevel || '?'}`;

    return `
      <div class="modal-char-card${sel}" onclick="App.toggleSearchChar(${i})">
        <div class="modal-char-check">✓</div>
        <div class="class-icon ${roleClass}" style="width:28px;height:28px;font-size:13px;">${icon}</div>
        <div class="modal-char-info">
          <div class="modal-char-name">${c.CharacterName}</div>
          <div class="modal-char-details">${c.CharacterClassName} · @${c.ServerName}${c.GuildName ? ` · ⚑ ${c.GuildName}` : ''}</div>
        </div>
        <div class="sr-level">${level}</div>
      </div>`;
  }).join('');
}

/**
 * 개별 캐릭터 선택 토글
 */
function toggleSearchChar(idx) {
  modalSelected[idx] = !modalSelected[idx];
  renderModalCharList();
  updateModalSelectedCount();
}

/**
 * 전체 선택 / 해제 토글
 */
function toggleAllSearchChars() {
  const allSelected = modalSelected.every(Boolean);
  modalSelected = modalSelected.map(() => !allSelected);
  renderModalCharList();
  updateModalSelectedCount();
}

/**
 * 선택 개수 카운터 업데이트
 */
function updateModalSelectedCount() {
  const count = modalSelected.filter(Boolean).length;
  document.getElementById('modalSelectedCount').textContent = `${count}개 선택`;
}

/**
 * 선택된 캐릭터를 미할당 리스트에 등록합니다.
 */
function registerSelectedChars() {
  const selected = modalCharacters.filter((_, i) => modalSelected[i]);
  if (!selected.length) { alert('등록할 캐릭터를 선택해주세요.'); return; }

  // 선택된 캐릭터를 임시 보관함에 추가
  selected.forEach(c => {
    const cls = matchClass(c.CharacterClassName);
    if (cls) {
      State.unassignedChars.unshift({
        id: Date.now() + Math.random(),
        cls,
        pr: 'must',
        charName: c.CharacterName || '',
        itemLevel: c.ItemMaxLevel || c.CharacterLevel || '',
      });
    }
  });

  closeSearchModal();
  renderAll();
}

// ── 클래스 매칭 헬퍼 ─────────────────────────────────────────

function matchClass(apiClassName) {
  let match = CLASSES.find(c => c.name === apiClassName);
  if (match) return match;
  match = CLASSES.find(c => c.name.startsWith(apiClassName) || apiClassName.startsWith(c.name.split('(')[0]));
  if (match) return match;
  return { name: apiClassName, role: 'dps', icon: '⚔️', syn: [] };
}

function isClassSupport(className) {
  const supportClasses = ['바드', '홀리나이트', '도화가', '발키리'];
  return supportClasses.some(s => className.includes(s));
}

function getClassIcon(className) {
  const cls = CLASSES.find(c => c.name.includes(className) || className.includes(c.name.split('(')[0]));
  return cls ? cls.icon : '⚔️';
}

// ── 전역 네임스페이스 등록 ────────────────────────────────────
window.App = {
  // 파티
  addParty, removeParty, setActiveParty,
  // 플레이어 (원정대)
  addPlayer, removePlayer, togglePlayer, renamePlayer,
  addChar, removeChar, setPlayerPR,
  toggleChar, removeFromSlot,
  // 드래그 앤 드롭
  dragStart, allowDrop, dragEnter, dragLeave, dropChar, dropToTemp,
  // 드롭다운
  toggleDropdown, filterDropdown, selectClass,
  // API 검색 + 모달
  apiSearch, closeSearchModal,
  toggleSearchChar, toggleAllSearchChars,
  registerSelectedChars,

  // DB 갱신 모달 관련
  closeUpdateModal: () => {
    document.getElementById('updateModal').classList.remove('open');
  },
  forceRefresh,
  applyUpdate
};

let latestUpdateData = null; // 갱신 모달에서 사용할 최신 데이터 임시 저장

/**
 * 모달의 [🔄 최신 API로 갱신] 버튼 클릭 시 동작
 */
async function forceRefresh() {
  if (!lastSearchName) return;
  const name = lastSearchName;
  const btn = document.getElementById('modalRefreshBtn');

  btn.disabled = true;
  btn.textContent = '갱신 중...';

  try {
    // force=true 로 API 재호출 (DB 캐싱 무시, levelDiff 계산된 데이터 반환)
    const data = await searchCharacter(name, true);
    latestUpdateData = data;

    // 갱신 비교 모달 열기
    openUpdateModal(data.characters);
  } catch (err) {
    alert(`갱신 실패: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 최신 API로 갱신';
  }
}

/**
 * 갱신 비교 모달을 열고 차이점을 렌더링합니다.
 */
function openUpdateModal(newCharacters) {
  const container = document.getElementById('updateCharList');

  container.innerHTML = newCharacters.map(c => {
    const isSupport = isClassSupport(c.CharacterClassName);
    const roleClass = isSupport ? 'support' : 'dps';
    const icon = getClassIcon(c.CharacterClassName);

    // levelDiff를 표시
    let diffHtml = '';
    if (c.levelDiff > 0) {
      diffHtml = `<span style="color:#69f0ae; font-weight:700; margin-left:8px;">▲ ${c.levelDiff.toFixed(2)}</span>`;
    } else if (c.levelDiff < 0) {
      diffHtml = `<span style="color:#f87171; font-weight:700; margin-left:8px;">▼ ${Math.abs(c.levelDiff).toFixed(2)}</span>`;
    } else {
      diffHtml = `<span style="color:var(--text-dim); margin-left:8px;">- 동일</span>`;
    }

    const currentLevel = c.ItemMaxLevel ? `Lv.${c.ItemMaxLevel}` : `Lv.${c.CharacterLevel || '?'}`;

    return `
      <div class="modal-char-card" style="cursor:default; padding: 10px 14px;">
        <div class="class-icon ${roleClass}" style="width:28px;height:28px;font-size:13px;">${icon}</div>
        <div class="modal-char-info">
          <div class="modal-char-name">${c.CharacterName}</div>
          <div class="modal-char-details">${c.CharacterClassName}</div>
        </div>
        <div class="sr-level" style="display:flex; align-items:center; letter-spacing:0.5px;">
           <span style="color:var(--text);">${currentLevel}</span>
           ${diffHtml}
        </div>
      </div>`;
  }).join('');

  document.getElementById('updateModal').classList.add('open');
}

/**
 * 갱신 모달에서 [✓ 갱신 적용하기] 버튼을 클릭했을 때
 */
async function applyUpdate() {
  if (!latestUpdateData) return;
  const btn = document.getElementById('applyUpdateBtn');
  btn.disabled = true;
  btn.textContent = '적용 중...';

  try {
    // 1. 서버에 최신 데이터 POST 전송하여 DB에 강제 반영
    await updateCharactersDb(latestUpdateData.searchName, latestUpdateData.characters);

    // 2. 현재 열려있는 기존 캐릭터 선택 모달 데이터 교체
    modalCharacters = latestUpdateData.characters;
    // 선택 상태는 개수에 맞게 다시 리셋(전체 선택)
    modalSelected = modalCharacters.map(() => true);
    renderModalCharList();
    updateModalSelectedCount();

    // DB 뱃지 유지, 하지만 이제 최신이므로 갱신 버튼은 숨길수도 있음 (선택사항)
    document.getElementById('modalDbBadge').textContent = '✅ 최신 데이터 적용됨';
    document.getElementById('modalRefreshBtn').style.display = 'none';

    // 3. UI 업데이트 닫기
    document.getElementById('updateModal').classList.remove('open');
    alert('최신 데이터로 갱신되었습니다. 선택 후 등록해주세요.');

  } catch (err) {
    alert(`갱신을 적용하는 중 오류가 발생했습니다: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = '✓ 갱신 적용하기';
  }
}

// ── 초기화 ────────────────────────────────────────────────────
function init() {
  const legend = document.getElementById('synLegend');
  SYN_TYPES.forEach(s => {
    legend.innerHTML += `
      <div class="legend-item">
        <div class="legend-dot" style="background:${s.color}"></div>
        <span>${s.key}</span>
      </div>`;
  });

  // localStorage에서 저장된 상태 복원, 없으면 새 파티 생성
  const restored = loadState();
  if (restored) {
    renderAll();
  } else {
    addParty();
  }

  document.addEventListener('click', closeAllDropdowns);

  // 모달 외부 클릭으로 닫기
  document.getElementById('searchModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) closeSearchModal();
  });
}

init();
