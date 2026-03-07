const BASE_URL = 'https://developer-lostark.game.onstove.com';

/**
 * 로스트아크 API에 GET 요청을 보냅니다.
 * @param {string} endpoint  예: '/characters/캐릭터명/siblings'
 * @param {string} apiKey    JWT 토큰
 */
async function callApi(endpoint, apiKey) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `bearer ${apiKey}`,
    },
  });

  if (res.status === 429) {
    throw new Error('API 요청 한도 초과 (분당 100회). 잠시 후 다시 시도해주세요.');
  }
  if (res.status === 401) {
    throw new Error('API 인증 실패. API 키를 확인해주세요.');
  }
  if (res.status === 404) {
    return null; // 캐릭터 없음
  }
  if (!res.ok) {
    throw new Error(`API 오류: ${res.status} ${res.statusText}`);
  }

  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}

/**
 * 같은 계정의 전체 캐릭터 목록을 조회합니다.
 * @param {string} characterName
 * @param {string} apiKey
 * @returns {Promise<Array|null>}
 */
export async function fetchSiblings(characterName, apiKey) {
  const encoded = encodeURIComponent(characterName);
  return callApi(`/characters/${encoded}/siblings`, apiKey);
}

/**
 * 캐릭터의 상세 프로필을 조회합니다.
 * @param {string} characterName
 * @param {string} apiKey
 * @returns {Promise<Object|null>}
 */
export async function fetchProfile(characterName, apiKey) {
  const encoded = encodeURIComponent(characterName);
  return callApi(`/armories/characters/${encoded}/profiles`, apiKey);
}
