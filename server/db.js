import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'characters.db');

const db = new Database(DB_PATH);

// WAL 모드 — 동시 읽기 성능 향상
db.pragma('journal_mode = WAL');

// ── 테이블 생성 ──────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS characters (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    character_name  TEXT UNIQUE NOT NULL,
    server_name     TEXT,
    class_name      TEXT,
    item_level      REAL,
    combat_level    INTEGER,
    guild_name      TEXT,
    title           TEXT,
    raw_json        TEXT,
    updated_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS siblings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    search_name     TEXT NOT NULL,
    character_name  TEXT NOT NULL,
    server_name     TEXT,
    class_name      TEXT,
    item_level      REAL,
    updated_at      TEXT DEFAULT (datetime('now')),
    UNIQUE(search_name, character_name)
  );
`);

// ── Prepared Statements ──────────────────────────────────────

const stmtUpsertCharacter = db.prepare(`
  INSERT INTO characters (character_name, server_name, class_name, item_level, combat_level, guild_name, title, raw_json, updated_at)
  VALUES (@character_name, @server_name, @class_name, @item_level, @combat_level, @guild_name, @title, @raw_json, datetime('now'))
  ON CONFLICT(character_name)
  DO UPDATE SET
    server_name  = excluded.server_name,
    class_name   = excluded.class_name,
    item_level   = excluded.item_level,
    combat_level = excluded.combat_level,
    guild_name   = excluded.guild_name,
    title        = excluded.title,
    raw_json     = excluded.raw_json,
    updated_at   = datetime('now')
`);

const stmtUpsertSibling = db.prepare(`
  INSERT INTO siblings (search_name, character_name, server_name, class_name, item_level, updated_at)
  VALUES (@search_name, @character_name, @server_name, @class_name, @item_level, datetime('now'))
  ON CONFLICT(search_name, character_name)
  DO UPDATE SET
    server_name = excluded.server_name,
    class_name  = excluded.class_name,
    item_level  = excluded.item_level,
    updated_at  = datetime('now')
`);

// ── 공개 함수 ────────────────────────────────────────────────

/** 캐릭터 프로필을 DB에 upsert */
export function upsertCharacter(data) {
  return stmtUpsertCharacter.run(data);
}

/** siblings 레코드를 DB에 upsert */
export function upsertSibling(data) {
  return stmtUpsertSibling.run(data);
}

/** 여러 sibling을 트랜잭션으로 일괄 insert */
export const upsertSiblingsBatch = db.transaction((searchName, siblings) => {
  for (const sib of siblings) {
    stmtUpsertSibling.run({
      search_name: searchName,
      character_name: sib.CharacterName,
      server_name: sib.ServerName,
      class_name: sib.CharacterClassName,
      item_level: parseFloat(String(sib.ItemMaxLevel || '0').replace(',', '')),
    });
  }
});

/** 캐릭터명으로 DB에서 조회 */
export function getCharacter(name) {
  return db.prepare('SELECT * FROM characters WHERE character_name = ?').get(name);
}

/** DB에 저장된 전체 캐릭터 목록 */
export function getAllCharacters() {
  return db.prepare('SELECT * FROM characters ORDER BY item_level DESC').all();
}

/** 검색명 기준 siblings 목록 */
export function getSiblings(searchName) {
  return db.prepare('SELECT * FROM siblings WHERE search_name = ? ORDER BY item_level DESC').all(searchName);
}

/** 
 * 이전에 검색한 소유주(search_name)에 속한 모든 캐릭터의 전체 정보를 반환합니다. 
 * siblings 테이블과 characters 테이블을 JOIN하여 데이터를 가져옵니다.
 */
export function getSearchHistory(searchName) {
  return db.prepare(`
    SELECT 
      c.character_name as CharacterName,
      c.server_name as ServerName,
      c.class_name as CharacterClassName,
      c.item_level as ItemMaxLevel,
      c.combat_level as CharacterLevel,
      c.guild_name as GuildName,
      c.title as Title
    FROM siblings s
    JOIN characters c ON s.character_name = c.character_name
    WHERE s.search_name = ?
    ORDER BY c.item_level DESC
  `).all(searchName);
}

export default db;
