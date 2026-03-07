import { CLASSES, PLAYER_COLORS } from './data.js';
import * as State from './state.js';
import { getActiveParty } from './party.js';
import { renderAll, renderPlayerList } from './render.js';

// ── 플레이어 CRUD ──────────────────────────────────────────────

/**
 * 입력창의 이름으로 새 플레이어를 추가합니다.
 */
export function addPlayer() {
  const input = document.getElementById('playerName');
  const name = input.value.trim();
  if (!name) { alert('이름을 입력해주세요.'); return; }

  const id = Date.now();
  const color = PLAYER_COLORS[State.players.length % PLAYER_COLORS.length];

  // 새 플레이어 추가 시 기존 플레이어 모두 접기
  State.players.forEach(p => { p.open = false; });
  State.players.push({ id, name, color, chars: [], open: true });
  State.playerPR[id] = 'must';
  State.selectedClass[id] = CLASSES[0].name;

  input.value = '';
  renderPlayerList();
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
 * @param {number} pid 플레이어 ID
 * @param {number} cid 캐릭터 ID
 */
export function removeChar(pid, cid) {
  State.parties.forEach(party => {
    const si = party.slots.indexOf(cid);
    if (si !== -1) party.slots[si] = null;
  });
  const player = State.players.find(p => p.id === pid);
  if (player) player.chars = player.chars.filter(c => c.id !== cid);
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
