// ── 서버 API 클라이언트 ──────────────────────────────────────
/**
 * 로스트아크 파티 빌더 - 프론트엔드 API 클라이언트
 */

const API_BASE_URL = 'http://localhost:3000/api';

/**
 * 특정 닉네임으로 계정 내 캐릭터 목록을 검색합니다.
 * @param {string} characterName 검색할 캐릭터명
 * @param {boolean} force true면 캐시를 무시하고 최신 API에서 갱신합니다.
 * @returns {Promise<Object>} 검색 결과 (characters 배열, count 등)
 */
export async function searchCharacter(characterName, force = false) {
  try {
    const url = `${API_BASE_URL}/search/${encodeURIComponent(characterName)}?force=${force}`;
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '검색 요청에 실패했습니다.');
    }
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

/**
 * 비교 팝업에서 갱신을 선택했을 때 서버 DB를 업데이트합니다.
 * @param {string} searchName 검색한 소유주 원래 기준 이름
 * @param {Array} characters 최신 캐릭터 목록
 * @returns {Promise<Object>} 성공 여부 메시지
 */
export async function updateCharactersDb(searchName, characters) {
  try {
    const response = await fetch(`${API_BASE_URL}/update-characters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchName, characters })
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'DB 업데이트 실패');
    }
    return await response.json();
  } catch (error) {
    console.error('API Update Error:', error);
    throw error;
  }
}

/**
 * DB에 저장된 전체 캐릭터 목록 조회
 * @returns {Promise<Array>}
 */
export async function getSavedCharacters() {
  const res = await fetch(`${API_BASE_URL}/characters`);
  if (!res.ok) throw new Error('캐릭터 목록 조회 실패');
  return res.json();
}

/**
 * DB에서 특정 캐릭터 조회
 * @param {string} name
 * @returns {Promise<Object>}
 */
export async function getSavedCharacter(name) {
  const res = await fetch(`${API_BASE_URL}/character/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error('캐릭터 조회 실패');
  return res.json();
}
