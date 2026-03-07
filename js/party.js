import * as State from './state.js';
import { renderAll, renderTabs } from './render.js';

// ── 파티 CRUD ──────────────────────────────────────────────────

/**
 * 새 파티를 추가하고 활성화합니다.
 */
export function addParty() {
  const id = State.incrementPartyCounter();
  State.parties.push({ id, label: `파티 ${id}`, slots: [null, null, null, null] });
  State.setActivePartyId(id);
  renderTabs();
  renderAll();
}

/**
 * 파티를 삭제합니다. 파티가 1개면 삭제하지 않습니다.
 * @param {number} id
 */
export function removeParty(id) {
  if (State.parties.length <= 1) return;
  State.setParties(State.parties.filter(p => p.id !== id));
  if (State.activePartyId === id) {
    State.setActivePartyId(State.parties[State.parties.length - 1].id);
  }
  renderTabs();
  renderAll();
}

/**
 * 활성 파티를 변경합니다.
 * @param {number} id
 */
export function setActiveParty(id) {
  State.setActivePartyId(id);
  renderTabs();
  renderAll();
}

/**
 * 현재 활성 파티 객체를 반환합니다.
 * @returns {{id:number, label:string, slots:Array}|undefined}
 */
export function getActiveParty() {
  return State.parties.find(p => p.id === State.activePartyId);
}
