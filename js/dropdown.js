import { CLASSES } from './data.js';
import * as State from './state.js';

// ── 직업 선택 드롭다운 ────────────────────────────────────────

/**
 * 모든 열린 드롭다운을 닫습니다. (document click 이벤트에 등록)
 */
export function closeAllDropdowns() {
    document.querySelectorAll('.search-dropdown.open').forEach(dd => {
        dd.classList.remove('open');
    });
}

/**
 * 특정 플레이어의 직업 선택 드롭다운을 토글합니다.
 * @param {number} pid 플레이어 ID
 * @param {Event} event 클릭 이벤트
 */
export function toggleDropdown(pid, event) {
    event.stopPropagation();

    const dd = document.getElementById(`dd-${pid}`);
    if (!dd) return;

    const isOpen = dd.classList.contains('open');

    // 먼저 모든 드롭다운 닫기
    closeAllDropdowns();

    if (!isOpen) {
        dd.classList.add('open');
        // 필터 입력란 초기화 및 포커스
        const filterInput = document.getElementById(`ddf-${pid}`);
        if (filterInput) {
            filterInput.value = '';
            setTimeout(() => filterInput.focus(), 50);
        }
        // 드롭다운 목록 렌더링
        filterDropdown(pid);
    }
}

/**
 * 드롭다운 내 직업 목록을 필터링하여 렌더링합니다.
 * @param {number} pid 플레이어 ID
 */
export function filterDropdown(pid) {
    const filterInput = document.getElementById(`ddf-${pid}`);
    const listEl = document.getElementById(`ddl-${pid}`);
    if (!listEl) return;

    const query = filterInput ? filterInput.value.trim().toLowerCase() : '';

    const filtered = CLASSES.filter(c =>
        c.name.toLowerCase().includes(query)
    );

    if (!filtered.length) {
        listEl.innerHTML = '<div class="search-no-result">일치하는 직업이 없습니다</div>';
        return;
    }

    listEl.innerHTML = filtered.map(c => {
        const roleClass = c.role === 'support' ? 'support' : 'dps';
        const isSelected = (State.selectedClass[pid] || CLASSES[0].name) === c.name;
        return `
      <div class="search-item ${isSelected ? 'highlighted' : ''}"
           onclick="App.selectClass(${pid}, '${c.name.replace(/'/g, "\\'")}')">
        <div class="search-item-icon ${roleClass}">${c.icon}</div>
        <span class="search-item-name">${c.name}</span>
        <span class="search-item-role ${roleClass}">${c.role === 'support' ? '서포' : '딜러'}</span>
      </div>`;
    }).join('');
}

/**
 * 드롭다운에서 직업을 선택합니다.
 * @param {number} pid 플레이어 ID
 * @param {string} className 선택된 직업명
 */
export function selectClass(pid, className) {
    State.selectedClass[pid] = className;

    const cls = CLASSES.find(c => c.name === className) || CLASSES[0];
    const inputEl = document.getElementById(`ddi-${pid}`);
    if (inputEl) {
        inputEl.value = `${cls.icon}  ${cls.name}`;
    }

    // 드롭다운 닫기
    const dd = document.getElementById(`dd-${pid}`);
    if (dd) dd.classList.remove('open');
}
