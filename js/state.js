// ── 전역 상태 ─────────────────────────────────────────────────
// 모든 모듈은 이 파일에서 상태를 import하여 사용합니다.

import { CLASSES } from './data.js';

const STORAGE_KEY = 'loa_party_builder_state';

/** @type {Array<{id:number, name:string, color:string, chars:Array, open:boolean}>} */
export let players = [];

/** @type {Array<{id:number, label:string, slots:Array<number|null>}>} */
export let parties = [];

/** @type {Array<{id:number, pr:string, cls:Object}>} */
export let unassignedChars = [];

/** @type {number|null} */
export let activePartyId = null;

/** @type {Object<number, 'must'|'flex'|'nope'>} */
export let playerPR = {};

/** @type {number} 파티 ID 카운터 */
export let partyCounter = 0;

/** @type {Object<number, string>} pid → 선택된 직업명 */
export let selectedClass = {};

// ── 상태 변경 헬퍼 (단순 대입을 외부에서 할 수 없으므로 setter 제공) ──
export function setPlayers(next) { players = next; }
export function setParties(next) { parties = next; }
export function setUnassignedChars(next) { unassignedChars = next; }
export function setActivePartyId(id) { activePartyId = id; }
export function setPlayerPRMap(next) { playerPR = next; }
export function setSelectedClass(next) { selectedClass = next; }
export function incrementPartyCounter() { partyCounter++; return partyCounter; }

// ── localStorage 저장/로드 ────────────────────────────────────

/**
 * 현재 상태를 localStorage에 저장합니다.
 * chars의 cls 객체는 name으로 직렬화합니다.
 */
export function saveState() {
  try {
    const data = {
      players: players.map(p => ({
        ...p,
        chars: p.chars.map(c => ({
          id: c.id,
          pr: c.pr,
          charName: c.charName || '',
          itemLevel: c.itemLevel || '',
          clsName: c.cls.name,
          clsRole: c.cls.role,
          clsIcon: c.cls.icon,
          clsSyn: c.cls.syn,
        })),
      })),
      parties,
      unassignedChars: unassignedChars.map(c => ({
        id: c.id,
        pr: c.pr,
        charName: c.charName || '',
        itemLevel: c.itemLevel || '',
        clsName: c.cls.name,
        clsRole: c.cls.role,
        clsIcon: c.cls.icon,
        clsSyn: c.cls.syn,
      })),
      activePartyId,
      playerPR,
      partyCounter,
      selectedClass,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('상태 저장 실패:', e);
  }
}

/**
 * localStorage에서 상태를 복원합니다.
 * @returns {boolean} 복원 성공 여부
 */
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;

    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.players) || !Array.isArray(data.parties)) return false;

    // chars의 clsName으로 CLASSES 객체를 복원
    players = data.players.map(p => ({
      ...p,
      chars: p.chars.map(c => {
        const cls = CLASSES.find(cl => cl.name === c.clsName) || {
          name: c.clsName,
          role: c.clsRole || 'dps',
          icon: c.clsIcon || '⚔️',
          syn: c.clsSyn || [],
        };
        return { id: c.id, pr: c.pr, cls, charName: c.charName || '', itemLevel: c.itemLevel || '' };
      }),
    }));

    parties = data.parties;

    // unassignedChars 복원
    if (data.unassignedChars && Array.isArray(data.unassignedChars)) {
      unassignedChars = data.unassignedChars.map(c => {
        const cls = CLASSES.find(cl => cl.name === c.clsName) || {
          name: c.clsName,
          role: c.clsRole || 'dps',
          icon: c.clsIcon || '⚔️',
          syn: c.clsSyn || [],
        };
        return { id: c.id, pr: c.pr, cls, charName: c.charName || '', itemLevel: c.itemLevel || '' };
      });
    } else {
      unassignedChars = [];
    }

    activePartyId = data.activePartyId;
    playerPR = data.playerPR || {};
    partyCounter = data.partyCounter || 0;
    selectedClass = data.selectedClass || {};

    return true;
  } catch (e) {
    console.warn('상태 복원 실패:', e);
    return false;
  }
}
