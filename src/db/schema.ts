export const SCHEMA_VERSION = 3;

export const CREATE_DECKS = `
CREATE TABLE IF NOT EXISTS decks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  code        TEXT NOT NULL,
  description TEXT,
  accent      TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  enabled     INTEGER NOT NULL DEFAULT 1
);`;

export const CREATE_CARDS = `
CREATE TABLE IF NOT EXISTS cards (
  id          TEXT PRIMARY KEY,
  deck_id     TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  question    TEXT NOT NULL,
  code        TEXT,
  options     TEXT,
  answer      TEXT NOT NULL,
  payload     TEXT NOT NULL DEFAULT '{}',
  explain     TEXT NOT NULL,
  tags        TEXT NOT NULL DEFAULT '[]',
  difficulty  INTEGER NOT NULL DEFAULT 2,
  ai_explain  TEXT,
  source      TEXT NOT NULL DEFAULT 'seed',
  verified_at TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cards_deck ON cards(deck_id);`;

export const CREATE_REVIEW_STATES = `
CREATE TABLE IF NOT EXISTS review_states (
  card_id          TEXT PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
  ease             REAL NOT NULL DEFAULT 2.5,
  interval_days    INTEGER NOT NULL DEFAULT 0,
  reps             INTEGER NOT NULL DEFAULT 0,
  lapses           INTEGER NOT NULL DEFAULT 0,
  due_at           TEXT NOT NULL,
  last_quality     INTEGER,
  last_reviewed_at TEXT,
  status           TEXT NOT NULL DEFAULT 'new'
);
CREATE INDEX IF NOT EXISTS idx_states_due ON review_states(due_at);`;

export const CREATE_REVIEW_LOGS = `
CREATE TABLE IF NOT EXISTS review_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id      TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  deck_id      TEXT NOT NULL,
  quality      INTEGER NOT NULL,
  is_correct   INTEGER NOT NULL,
  elapsed_ms   INTEGER NOT NULL DEFAULT 0,
  answer_raw   TEXT,
  day          TEXT NOT NULL,
  answered_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logs_day ON review_logs(day);
CREATE INDEX IF NOT EXISTS idx_logs_card ON review_logs(card_id);`;

export const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);`;

export const CREATE_TABLES = [
  CREATE_DECKS,
  CREATE_CARDS,
  CREATE_REVIEW_STATES,
  CREATE_REVIEW_LOGS,
  CREATE_SETTINGS,
].join('\n');

export const DEFAULT_SETTINGS: ReadonlyArray<readonly [string, string]> = [
  ['daily_new_limit', '15'],
  ['daily_review_limit', '80'],
  ['enabled_decks', '["ds","co","os","cn","ai","agent"]'],
  ['ai_api_key', ''],
  ['ai_base_url', 'https://api.deepseek.com'],
  ['ai_model', 'deepseek-chat'],
  ['reminder_enabled', 'false'],
  ['reminder_time', '20:30'],
  ['reminder_tip_shown', 'false'],
  ['deck_remote_url', ''],
  ['deck_checked_at', ''],
  ['ai_gen_limit', '10'],
  ['onboarded', 'false'],
];
