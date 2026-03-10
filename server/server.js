import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
import { fetchSiblings, fetchProfile } from './api.js';
import {
  upsertCharacter,
  upsertSiblingsBatch,
  getCharacter,
  getAllCharacters,
  getSiblings,
  getSearchHistory,
} from './db.js';

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.LOSTARK_API_KEY;

if (!API_KEY) {
  console.error('❌ LOSTARK_API_KEY가 .env에 설정되지 않았습니다.');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

// ── 정적 파일 서빙 (프로젝트 루트) ──────────────────────────
app.use(express.static(path.join(__dirname, '..')));

// ── API 라우트 ───────────────────────────────────────────────

/**
 * GET /api/search/:name
 * 1. 로스트아크 API로 siblings 조회
 * 2. DB에 siblings 저장
 * 3. 각 캐릭터의 프로필을 조회하여 DB에 저장
 * 4. 결과 반환
 */
app.get('/api/search/:name', async (req, res) => {
  const characterName = req.params.name;
  const forceRefresh = req.query.force === 'true';

  try {
    // 1️⃣ 캐시 확인 (forceRefresh가 아닐 때만)
    if (!forceRefresh) {
      const history = getSearchHistory(characterName);
      if (history && history.length > 0) {
        return res.json({
          searchName: characterName,
          count: history.length,
          characters: history,
          fromDb: true
        });
      }
    }

    // 2️⃣ API 호출 전 기존 DB 데이터 백업 (비교용)
    const oldHistory = getSearchHistory(characterName) || [];
    const oldLevelMap = {};
    oldHistory.forEach(c => { oldLevelMap[c.CharacterName] = c.ItemMaxLevel; });

    // 3️⃣ siblings 목록 조회 API 호출
    const siblings = await fetchSiblings(characterName, API_KEY);
    if (!siblings || !siblings.length) {
      return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다.' });
    }

    // 💡 참고: ?force=true 일 때는 모달에서 비교 후 "선택 적용" 시에만 DB를 업데이트하므로 여기서 바로 DB에 저장하지 않습니다.
    // 기존 검색 캐시 로직: !forceRefresh인데 history가 없어서 여기까지 온 경우는 최초 검색이므로 DB 자동 저장.
    if (!forceRefresh) {
      upsertSiblingsBatch(characterName, siblings);
    }

    // 4️⃣ 각 캐릭터 프로필 조회 (병렬)
    const profilePromises = siblings.slice(0, 10).map(async (sib) => {
      try {
        const profile = await fetchProfile(sib.CharacterName, API_KEY);
        if (profile) {
          if (!forceRefresh) {
            upsertCharacter({
              character_name: profile.CharacterName,
              server_name: profile.ServerName,
              class_name: profile.CharacterClassName,
              item_level: parseFloat(String(profile.ItemMaxLevel || '0').replace(',', '')),
              combat_level: profile.CharacterLevel || 0,
              guild_name: profile.GuildName || null,
              title: profile.Title || null,
              raw_json: JSON.stringify(profile),
            });
          }
          return { ...sib, profile };
        }
        return sib;
      } catch {
        return sib;
      }
    });

    const results = await Promise.all(profilePromises);

    // 5️⃣ 응답 데이터 구성 (levelDiff 추가)
    const enriched = results.map(r => {
      const currentLevel = r.profile?.ItemMaxLevel
        ? parseFloat(String(r.profile.ItemMaxLevel).replace(',', ''))
        : parseFloat(String(r.ItemMaxLevel || '0').replace(',', ''));

      const oldLevel = oldLevelMap[r.CharacterName] || 0;
      const levelDiff = oldLevel > 0
        ? Math.round((currentLevel - oldLevel) * 100) / 100
        : 0;

      return {
        CharacterName: r.CharacterName,
        ServerName: r.ServerName,
        CharacterClassName: r.profile?.CharacterClassName || r.CharacterClassName,
        ItemMaxLevel: currentLevel ? currentLevel.toLocaleString('en-US', { minimumFractionDigits: 2 }) : null,
        CharacterLevel: r.profile?.CharacterLevel || r.CharacterLevel,
        GuildName: r.profile?.GuildName || null,
        Title: r.profile?.Title || null,
        levelDiff: levelDiff
      };
    });

    res.json({
      searchName: characterName,
      count: enriched.length,
      characters: enriched,
      fromDb: false,
      isRefresh: forceRefresh,
      oldData: forceRefresh ? oldHistory : []
    });
  } catch (err) {
    console.error('검색 오류:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/update-characters
 * 프론트엔드에서 API 갱신 내역을 승인했을 때, 최신 데이터를 DB에 일괄 업데이트
 */
app.post('/api/update-characters', (req, res) => {
  const { searchName, characters } = req.body;

  if (!searchName || !characters || !Array.isArray(characters)) {
    return res.status(400).json({ error: '잘못된 요청입니다.' });
  }

  try {
    upsertSiblingsBatch(searchName, characters);

    characters.forEach(c => {
      upsertCharacter({
        character_name: c.CharacterName,
        server_name: c.ServerName,
        class_name: c.CharacterClassName,
        item_level: parseFloat(String(c.ItemMaxLevel || '0').replace(',', '')),
        combat_level: c.CharacterLevel || 0,
        guild_name: c.GuildName || null,
        title: c.Title || null,
        raw_json: JSON.stringify(c)
      });
    });

    res.json({ success: true, message: 'DB 업데이트 완료' });
  } catch (err) {
    console.error('업데이트 오류:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/characters
 * DB에 저장된 전체 캐릭터 목록
 */
app.get('/api/characters', (req, res) => {
  try {
    const chars = getAllCharacters();
    res.json(chars);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/character/:name
 * DB에서 특정 캐릭터 조회
 */
app.get('/api/character/:name', (req, res) => {
  try {
    const char = getCharacter(req.params.name);
    if (!char) return res.status(404).json({ error: '캐릭터가 DB에 없습니다.' });
    res.json(char);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/siblings/:name
 * DB에서 siblings 조회
 */
app.get('/api/siblings/:name', (req, res) => {
  try {
    const sibs = getSiblings(req.params.name);
    res.json(sibs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 서버 시작 ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ 서버 실행중: http://localhost:${PORT}`);
  console.log(`📁 정적 파일: ${path.join(__dirname, '..')}`);
});
