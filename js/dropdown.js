import { CLASSES } from './data.js';
import * as State from './state.js';

// ── 드롭다운 관리 ──────────────────────────────────────────────

/**
 * 클릭 이벤트가 드롭다운 외부에서 발생하면 모든 드롭다운을 닫습니다.
 * @param {MouseEvent} e
 */
export function closeAllDropdowns(e) {
  document.querySelectorAll('.search-dropdown.open').forEach(dd => {
    if (!dd.parentElement.contains(e.target)) dd.classList.remove('open');
  });
}

/**
 * 특정 플레이어의 드롭다운을 열거나 닫습니다.
 * @param {number} pid 플레이어 ID
 * @param {MouseEvent} e
 */
export function toggleDropdown(pid, e) {
  e.stopPropagation();
  const dd = document.getElementById(`dd-${pid}`);
  const wasOpen = dd.classList.contains('open');

  // 다른 모든 드롭다운 닫기
  document.querySelectorAll('.search-dropdown.open').forEach(d => d.classList.remove('open'));

  if (!wasOpen) {
    dd.classList.add('open');
    const filterInput = document.getElementById(`ddf-${pid}`);
    filterInput.value = '';
    filterDropdown(pid);
    setTimeout(() => filterInput.focus(), 50);
  }
}

/**
 * 검색어로 드롭다운 목록을 필터링합니다.
 * @param {number} pid 플레이어 ID
 */
export function filterDropdown(pid) {
  const query = (document.getElementById(`ddf-${pid}`)?.value || '').toLowerCase();
  const list = document.getElementById(`ddl-${pid}`);
  if (!list) return;

  const filtered = CLASSES.filter(c =>
    c.name.toLowerCase().includes(query) ||
    (c.role === 'support' ? '서포터' : '딜러').includes(query)
  );

  if (!filtered.length) {
    list.innerHTML = `<div class="search-no-result">검색 결과 없음</div>`;
    return;
  }

  list.innerHTML = filtered.map(c => `
    <div class="search-item" onclick="App.selectClass(${pid}, '${c.name}')">
      <div class="search-item-icon ${c.role}">${c.icon}</div>
      <span class="search-item-name">${c.name}</span>
      <span class="search-item-role ${c.role}">${c.role === 'support' ? '서포터' : '딜러'}</span>
    </div>
  `).join('');
}

/**
 * 드롭다운에서 직업을 선택합니다.
 * @param {number} pid 플레이어 ID
 * @param {string} className 직업명
 */
export function selectClass(pid, className) {
  State.selectedClass[pid] = className;
  const input = document.getElementById(`ddi-${pid}`);
  const cls = CLASSES.find(c => c.name === className);
  if (input && cls) input.value = `${cls.icon}  ${cls.name}`;

  const dd = document.getElementById(`dd-${pid}`);
  if (dd) dd.classList.remove('open');
}
