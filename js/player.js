import { CLASSES, PLAYER_COLORS } from './data.js';
import * as State from './state.js';
import { getActiveParty } from './party.js';
import { renderAll, renderPlayerList } from './render.js';

// ── 플레이어 CRUD ──────────────────────────────────────────────

/**
 * 빈 이름 칸(Player)을 새로 생성합니다. 검색바 밑의 + 버튼을 누르면 호출됩니다.
 */
export function addPlayer() {
  const id = Date.now();
  const name = ''; // 빈 이름으로 시작
  const color = PLAYER_COLORS[State.players.length % PLAYER_COLORS.length];

  // 새 플레이어 추가 시 기존 플레이어 오픈 상태 유지
  State.players.push({ id, name, color, chars: [], open: true });
  State.playerPR[id] = 'must';
  State.selectedClass[id] = CLASSES[0].name;

  renderPlayerList();
}

/**
 * 플레이어 이름을 변경합니다. (DOM 인풋에서 onchange/onblur 발생 시 호출)
 * @param {number} pid 
 * @param {string} newName 
 */
export function renamePlayer(pid, newName) {
  const player = State.players.find(p => p.id === pid);
  if (player) {
    player.name = newName.trim();
    State.saveState();
    // 포커스를 잃을 우려가 있으므로 여기선 전체 렌더링 대신 상태만 저장하거나 이름 표시부만 업데이트를 권장합니다만,
    // 구조 상 renderPlayerList를 해야 다른 파티 슬롯 등도 업데이트 됩니다.
    renderAll();
  }
}

/**
 * 플레이어를 삭제하고 해당 플레이어의 캐릭터를 모든 파티 슬롯에서 제거합니다.
 * @param {number} pid 플레이어 ID
 */
export function removePlayer(pid) {
  const player = State.players.find(p => p.id === pid);
  if (player) {
    player.chars.forEach(c => {
      State.parties.forEach(party => {
        const si = party.slots.indexOf(c.id);
        if (si !== -1) party.slots[si] = null;
      });
    });
  }
  State.setPlayers(State.players.filter(p => p.id !== pid));
  delete State.playerPR[pid];
  delete State.selectedClass[pid];
  renderAll();
}

/**
 * 플레이어 아코디언을 토글합니다. 한 번에 하나만 열립니다.
 * @param {number} pid 플레이어 ID
 */
export function togglePlayer(pid) {
  const player = State.players.find(p => p.id === pid);
  if (!player) return;

  const opening = !player.open;
  if (opening) State.players.forEach(pl => { pl.open = false; });
  player.open = opening;
  renderPlayerList();
}

// ── 캐릭터 CRUD ────────────────────────────────────────────────

/**
 * 플레이어에게 선택된 직업의 캐릭터를 추가합니다.
 * @param {number} pid 플레이어 ID
 */
export function addChar(pid) {
  const clsName = State.selectedClass[pid] || CLASSES[0].name;
  const cls = CLASSES.find(c => c.name === clsName);
  if (!cls) return;

  const id = Date.now() + Math.random();
  const player = State.players.find(p => p.id === pid);
  player.chars.push({ id, cls, pr: State.playerPR[pid] || 'must' });
  renderAll();
}

/**
 * 캐릭터를 삭제하고 모든 파티 슬롯에서 제거합니다.
 * @param {number|string} pid 플레이어 ID 또는 'unassigned'
 * @param {number} cid 캐릭터 ID
 */
export function removeChar(pid, cid) {
  State.parties.forEach(party => {
    const si = party.slots.indexOf(cid);
    if (si !== -1) party.slots[si] = null;
  });

  if (pid === 'unassigned') {
    State.unassignedChars = State.unassignedChars.filter(c => c.id !== cid);
  } else {
    const player = State.players.find(p => p.id === pid);
    if (player) player.chars = player.chars.filter(c => c.id !== cid);
  }

  renderAll();
}

/**
 * 플레이어의 채용 우선순위(PR)를 변경합니다.
 * @param {number} pid 플레이어 ID
 * @param {'must'|'flex'|'nope'} pr
 */
export function setPlayerPR(pid, pr) {
  State.playerPR[pid] = pr;
  ['must', 'flex', 'nope'].forEach(type => {
    const btn = document.getElementById(`prb-${pid}-${type}`);
    if (btn) btn.classList.toggle('active', type === pr);
  });
}

// ── 파티 슬롯 토글 ─────────────────────────────────────────────

/**
 * 캐릭터를 활성 파티에 추가하거나 제거합니다.
 * @param {number} cid 캐릭터 ID
 */
export function toggleChar(cid) {
  const party = getActiveParty();
  if (!party) return;

  const si = party.slots.indexOf(cid);
  if (si !== -1) {
    party.slots[si] = null;
    renderAll();
    return;
  }
  const emptyIdx = party.slots.indexOf(null);
  if (emptyIdx === -1) return; // 슬롯이 꽉 찬 경우
  party.slots[emptyIdx] = cid;
  renderAll();
}

/**
 * 파티 슬롯에서 특정 인덱스의 캐릭터를 제거합니다.
 * @param {number} idx 슬롯 인덱스 (0~3)
 */
export function removeFromSlot(idx) {
  const party = getActiveParty();
  if (party) { party.slots[idx] = null; renderAll(); }
}

// ── 드래그 앤 드롭 ──────────────────────────────────────────────

let draggedCharParams = null; // { fromSource: 'unassigned'|pid, cid: number }

export function dragStart(event, source, cid) {
  draggedCharParams = { source, cid };
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', cid); // Required for Firefox

  // 시각적 피드백을 위해 투명도 주기
  setTimeout(() => {
    event.target.classList.add('dragging');
  }, 0);
}

export function allowDrop(event) {
  event.preventDefault(); // 기본 동작 막기
  event.dataTransfer.dropEffect = 'move';
}

export function dragEnter(event) {
  event.preventDefault();
  const block = event.currentTarget;
  if (block.classList.contains('player-block')) {
    block.classList.add('drag-over');
  }
}

export function dragLeave(event) {
  const block = event.currentTarget;
  if (block.classList.contains('player-block')) {
    block.classList.remove('drag-over');
  }
}

export function dropChar(event, targetPid) {
  event.preventDefault();
  const block = event.currentTarget;
  block.classList.remove('drag-over');

  if (!draggedCharParams) return;

  const { source, cid } = draggedCharParams;
  let charItem = null;

  // 1. 소스 캐릭터 추출
  if (source === 'unassigned') {
    const idx = State.unassignedChars.findIndex(c => c.id === cid);
    if (idx !== -1) {
      charItem = State.unassignedChars[idx];
      State.unassignedChars.splice(idx, 1);
    }
  } else {
    // 기존 특정 플레이어에서 가져오는 경우
    const fromPlayer = State.players.find(p => p.id === source);
    if (fromPlayer) {
      const idx = fromPlayer.chars.findIndex(c => c.id === cid);
      if (idx !== -1) {
        charItem = fromPlayer.chars[idx];
        fromPlayer.chars.splice(idx, 1);
      }
    }
  }

  // 1.5. 파티 슬롯에서 이동된 캐릭터 참조 제거 (정합성 유지)
  if (charItem) {
    State.parties.forEach(party => {
      const si = party.slots.indexOf(cid);
      if (si !== -1) party.slots[si] = null;
    });
  }

  // 2. 타겟 플레이어에 추가
  if (charItem) {
    const toPlayer = State.players.find(p => p.id === targetPid);
    if (toPlayer) {
      toPlayer.chars.push(charItem);
      toPlayer.open = true; // 열리게 설정
    }
  }

  draggedCharParams = null;
  renderAll();
}

/**
 * 캐릭터를 임시 보관함(unassignedChars)으로 드롭합니다.
 */
export function dropToTemp(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');

  if (!draggedCharParams) return;

  const { source, cid } = draggedCharParams;
  if (source === 'unassigned') { draggedCharParams = null; return; } // 이미 임시인 경우

  let charItem = null;
  const fromPlayer = State.players.find(p => p.id === source);
  if (fromPlayer) {
    const idx = fromPlayer.chars.findIndex(c => c.id === cid);
    if (idx !== -1) {
      charItem = fromPlayer.chars[idx];
      fromPlayer.chars.splice(idx, 1);
    }
  }

  // 파티 슬롯에서도 제거
  if (charItem) {
    State.parties.forEach(party => {
      const si = party.slots.indexOf(cid);
      if (si !== -1) party.slots[si] = null;
    });
    State.unassignedChars.push(charItem);
  }

  draggedCharParams = null;
  renderAll();
}
