/** 数据库结构定义。改结构时同步 +1 SCHEMA_VERSION 并补充迁移逻辑。 */

export const SCHEMA_VERSION = 3

export const SCHEMA_SQL = /* sql */ `
PRAGMA journal_mode = MEMORY;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 抓取源：首页 / 分类 / 搜索 / 排行
CREATE TABLE IF NOT EXISTS sources (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  kind            TEXT    NOT NULL,
  plate           TEXT,
  word            TEXT,
  url             TEXT    NOT NULL UNIQUE,
  title           TEXT    NOT NULL,
  enabled         INTEGER NOT NULL DEFAULT 1,
  total_pages     INTEGER,
  total_items     INTEGER,
  last_crawled_at TEXT,
  created_at      TEXT    NOT NULL
);

-- 站点条目（一次投稿 = 一张图）
CREATE TABLE IF NOT EXISTS items (
  id               INTEGER PRIMARY KEY,
  detail_url       TEXT    NOT NULL,
  source_url       TEXT,
  plate            TEXT,
  word             TEXT,
  title            TEXT,
  width            INTEGER,
  height           INTEGER,
  bytes            INTEGER,
  uploader         TEXT,
  views            INTEGER DEFAULT 0,
  likes            INTEGER DEFAULT 0,
  collects         INTEGER DEFAULT 0,
  published_at     TEXT,
  remote_path      TEXT,
  remote_ext       TEXT,
  preview_url      TEXT,
  download_url     TEXT,
  pixiv_id         TEXT,
  pixiv_artist_url TEXT,
  rich             INTEGER NOT NULL DEFAULT 0,
  favorite         INTEGER NOT NULL DEFAULT 0,
  rating           INTEGER NOT NULL DEFAULT 0,
  indexed_at       TEXT    NOT NULL,
  updated_at       TEXT    NOT NULL,
  -- 这条记录是在列表第几页被发现的。下载阶段按页码范围筛选时要用，
  -- 否则「从第 100 页抓到第 200 页」在下载时会退化成「全库任意条目」。
  page             INTEGER
);

CREATE INDEX IF NOT EXISTS idx_items_published ON items (published_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_items_plate     ON items (plate, word);
-- idx_items_page 不在这里建：老库可能还没有 page 列，
-- 建索引会先于补列执行并直接报错。放到 db.ts 的迁移里，补完列再建。
CREATE INDEX IF NOT EXISTS idx_items_favorite  ON items (favorite) WHERE favorite = 1;

CREATE TABLE IF NOT EXISTS tags (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT    NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS item_tags (
  item_id INTEGER NOT NULL,
  tag_id  INTEGER NOT NULL,
  PRIMARY KEY (item_id, tag_id)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_item_tags_tag ON item_tags (tag_id);

-- 条目是被哪个「应用分类」抓回来的（多对多，只增不删）。
-- 为什么不能直接改 items.plate/word：那是站点对这张图的真实分类
-- （站点搜索页返回的详情链接仍然指向图片原本的分类），拿抓取目标去覆盖它
-- 会让同一条记录在两个分类之间来回跳，收藏/下载记录还在，分类却变了。
CREATE TABLE IF NOT EXISTS item_targets (
  item_id INTEGER NOT NULL,
  word    TEXT    NOT NULL,
  PRIMARY KEY (item_id, word)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_item_targets_word ON item_targets (word);

-- 本地已下载的文件
CREATE TABLE IF NOT EXISTS files (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id       INTEGER NOT NULL,
  rel_path      TEXT    NOT NULL,
  thumb_rel     TEXT,
  ext           TEXT,
  mime          TEXT,
  width         INTEGER,
  height        INTEGER,
  bytes         INTEGER,
  sha256        TEXT,
  variant       TEXT    NOT NULL DEFAULT 'original',
  downloaded_at TEXT    NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_files_item    ON files (item_id, variant);
CREATE INDEX        IF NOT EXISTS idx_files_sha256  ON files (sha256);

-- 抓取任务留痕
CREATE TABLE IF NOT EXISTS jobs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  phase       TEXT    NOT NULL,
  summary     TEXT    NOT NULL,
  request     TEXT    NOT NULL,
  stats       TEXT    NOT NULL,
  started_at  TEXT    NOT NULL,
  finished_at TEXT
);

-- 已抓过的列表页，用于断点续爬
CREATE TABLE IF NOT EXISTS page_marks (
  source_url TEXT    NOT NULL,
  page       INTEGER NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT    NOT NULL,
  PRIMARY KEY (source_url, page)
) WITHOUT ROWID;
`
