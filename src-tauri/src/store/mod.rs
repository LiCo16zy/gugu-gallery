/**
 * 仓储层（Rust 版）：领域对象 <-> SQL。
 *
 * 从 Electron 版的 src/main/store/repository.ts 一比一搬过来，SQL 与筛选语义保持一致，
 * 这样界面上 63 项交互断言与既有单测才有意义。
 * 与旧实现的唯一区别：SQLite 是**原生**的（rusqlite），不再是 WASM 版整库进内存。
 */
pub mod schema;

use chrono::{SecondsFormat, Utc};
use rusqlite::types::Value as SqlValue;
use rusqlite::{params_from_iter, Connection, OptionalExtension, Row};
use serde::Deserialize;
use serde_json::{json, Value as Json};
use std::path::Path;

pub fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

/** 打开（或新建）索引库，并做轻量迁移 */
pub fn open(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(schema::SCHEMA_SQL)?;
    migrate(&conn)?;
    Ok(conn)
}

fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    let mut has_page = false;
    {
        let mut stmt = conn.prepare("PRAGMA table_info(items)")?;
        let mut rows = stmt.query([])?;
        while let Some(row) = rows.next()? {
            let name: String = row.get(1)?;
            if name == "page" {
                has_page = true;
            }
        }
    }
    if !has_page {
        conn.execute_batch("ALTER TABLE items ADD COLUMN page INTEGER")?;
    }
    conn.execute_batch("CREATE INDEX IF NOT EXISTS idx_items_page ON items (page)")?;

    let current: Option<String> = conn
        .query_row("SELECT value FROM meta WHERE key = 'schema_version'", [], |r| r.get(0))
        .optional()?;
    let want = schema::SCHEMA_VERSION.to_string();
    if current.as_deref() != Some(want.as_str()) {
        conn.execute(
            "INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?1)",
            [want],
        )?;
    }
    Ok(())
}

/* ------------------------------------------------------------------ 查询条件 */

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GalleryQuery {
    pub text: Option<String>,
    pub plate: Option<String>,
    pub word: Option<String>,
    pub target_word: Option<String>,
    pub tags: Option<Vec<String>>,
    pub tag_mode: Option<String>,
    pub exclude_tags: Option<Vec<String>>,
    pub favorite: Option<bool>,
    pub downloaded: Option<String>,
    pub min_width: Option<i64>,
    pub min_height: Option<i64>,
    pub orientation: Option<String>,
    pub page_from: Option<i64>,
    pub page_to: Option<i64>,
    pub month_from: Option<String>,
    pub month_to: Option<String>,
    pub sort: Option<String>,
    pub cursor: Option<String>,
    pub limit: Option<i64>,
}

impl GalleryQuery {
    pub fn limit_or(&self, fallback: i64) -> i64 {
        self.limit.unwrap_or(fallback).clamp(1, 500)
    }
    pub fn offset(&self) -> i64 {
        self.cursor
            .as_deref()
            .and_then(|c| c.parse::<i64>().ok())
            .unwrap_or(0)
    }
}

const ITEM_SELECT: &str = r#"
SELECT i.*,
       f.rel_path  AS file_rel_path,
       f.thumb_rel AS file_thumb_rel,
       f.ext       AS file_ext,
       f.bytes     AS file_bytes,
       f.sha256    AS file_sha256,
       f.width     AS file_width,
       f.height    AS file_height,
       f.downloaded_at AS file_downloaded_at,
       (SELECT GROUP_CONCAT(t.name, char(31))
          FROM item_tags it JOIN tags t ON t.id = it.tag_id
         WHERE it.item_id = i.id) AS tag_names
FROM items i
LEFT JOIN files f ON f.item_id = i.id AND f.variant = 'original'
"#;

fn next_month(month: &str) -> String {
    let parts: Vec<i64> = month.split('-').filter_map(|p| p.parse().ok()).collect();
    if parts.len() < 2 || parts[1] < 1 || parts[1] > 12 {
        return month.to_string();
    }
    let (y, m) = (parts[0], parts[1]);
    if m == 12 {
        format!("{}-01", y + 1)
    } else {
        format!("{}-{:02}", y, m + 1)
    }
}

/// 与 TS 版 buildWhere 等价：返回 (WHERE 子句, 参数)
fn build_where(q: &GalleryQuery) -> (String, Vec<SqlValue>) {
    let mut clauses: Vec<String> = Vec::new();
    let mut params: Vec<SqlValue> = Vec::new();

    if let Some(plate) = q.plate.as_deref().filter(|s| !s.is_empty()) {
        clauses.push("i.plate = ?".into());
        params.push(SqlValue::Text(plate.to_string()));
    }
    if let Some(word) = q.word.as_deref().filter(|s| !s.is_empty()) {
        clauses.push("i.word = ?".into());
        params.push(SqlValue::Text(word.to_string()));
    }
    if let Some(target) = q.target_word.as_deref().filter(|s| !s.is_empty()) {
        clauses.push("i.id IN (SELECT item_id FROM item_targets WHERE word = ?)".into());
        params.push(SqlValue::Text(target.to_string()));
    }
    if q.favorite.unwrap_or(false) {
        clauses.push("i.favorite = 1".into());
    }
    match q.downloaded.as_deref() {
        Some("only") => clauses.push("f.id IS NOT NULL".into()),
        Some("never") => clauses.push("f.id IS NULL".into()),
        _ => {}
    }
    if let Some(w) = q.min_width.filter(|v| *v > 0) {
        clauses.push("COALESCE(i.width, 0) >= ?".into());
        params.push(SqlValue::Integer(w));
    }
    if let Some(h) = q.min_height.filter(|v| *v > 0) {
        clauses.push("COALESCE(i.height, 0) >= ?".into());
        params.push(SqlValue::Integer(h));
    }
    if let Some(from) = q.month_from.as_deref().filter(|s| !s.is_empty()) {
        clauses.push("COALESCE(i.published_at, '') >= ?".into());
        params.push(SqlValue::Text(format!("{from}-01 00:00")));
    }
    if let Some(to) = q.month_to.as_deref().filter(|s| !s.is_empty()) {
        clauses.push("COALESCE(i.published_at, '') < ?".into());
        params.push(SqlValue::Text(format!("{} 00:00", next_month(to))));
    }
    if let Some(p) = q.page_from {
        clauses.push("i.page IS NOT NULL AND i.page >= ?".into());
        params.push(SqlValue::Integer(p));
    }
    if let Some(p) = q.page_to {
        clauses.push("i.page IS NOT NULL AND i.page <= ?".into());
        params.push(SqlValue::Integer(p));
    }
    match q.orientation.as_deref() {
        Some("landscape") => clauses.push("i.width > i.height".into()),
        Some("portrait") => clauses.push("i.height > i.width".into()),
        Some("square") => clauses.push("i.width = i.height".into()),
        _ => {}
    }

    let tags: Vec<String> = q
        .tags
        .clone()
        .unwrap_or_default()
        .into_iter()
        .filter(|t| !t.is_empty())
        .collect();
    if !tags.is_empty() {
        let marks = vec!["?"; tags.len()].join(",");
        if q.tag_mode.as_deref() == Some("all") {
            clauses.push(format!(
                "i.id IN (SELECT it.item_id FROM item_tags it JOIN tags t ON t.id = it.tag_id
                          WHERE t.name IN ({marks}) GROUP BY it.item_id HAVING COUNT(DISTINCT t.name) = ?)"
            ));
            for t in &tags {
                params.push(SqlValue::Text(t.clone()));
            }
            params.push(SqlValue::Integer(tags.len() as i64));
        } else {
            clauses.push(format!(
                "i.id IN (SELECT it.item_id FROM item_tags it JOIN tags t ON t.id = it.tag_id WHERE t.name IN ({marks}))"
            ));
            for t in &tags {
                params.push(SqlValue::Text(t.clone()));
            }
        }
    }

    let exclude: Vec<String> = q
        .exclude_tags
        .clone()
        .unwrap_or_default()
        .into_iter()
        .filter(|t| !t.is_empty())
        .collect();
    if !exclude.is_empty() {
        let marks = vec!["?"; exclude.len()].join(",");
        clauses.push(format!(
            "i.id NOT IN (SELECT it.item_id FROM item_tags it JOIN tags t ON t.id = it.tag_id WHERE t.name IN ({marks}))"
        ));
        for t in &exclude {
            params.push(SqlValue::Text(t.clone()));
        }
    }

    let text = q.text.clone().unwrap_or_default().trim().to_string();
    if !text.is_empty() {
        let escaped = text.replace('%', "\\%").replace('_', "\\_");
        let like = format!("%{escaped}%");
        clauses.push(
            r#"(i.title LIKE ? ESCAPE '\' OR i.plate LIKE ? ESCAPE '\' OR i.word LIKE ? ESCAPE '\'
                OR i.pixiv_id LIKE ? ESCAPE '\' OR i.uploader LIKE ? ESCAPE '\'
                OR i.id IN (SELECT it.item_id FROM item_tags it JOIN tags t ON t.id = it.tag_id
                            WHERE t.name LIKE ? ESCAPE '\'))"#
                .to_string(),
        );
        for _ in 0..6 {
            params.push(SqlValue::Text(like.clone()));
        }
    }

    let where_sql = if clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", clauses.join(" AND "))
    };
    (where_sql, params)
}

fn build_order(sort: Option<&str>) -> &'static str {
    match sort.unwrap_or("newest") {
        "oldest" => "COALESCE(i.published_at, i.indexed_at) ASC, i.id ASC",
        "views" => "COALESCE(i.views, 0) DESC, i.id DESC",
        "size" => "COALESCE(f.bytes, i.bytes, 0) DESC, i.id DESC",
        "resolution" => "(COALESCE(i.width,0) * COALESCE(i.height,0)) DESC, i.id DESC",
        "title" => "i.title ASC, i.id ASC",
        "random" => "RANDOM()",
        _ => "COALESCE(i.published_at, i.indexed_at) DESC, i.id DESC",
    }
}

/* -------------------------------------------------------------------- 映射器 */

fn col_i64(row: &Row, name: &str) -> Option<i64> {
    row.get::<_, Option<i64>>(name).ok().flatten()
}
fn col_str(row: &Row, name: &str) -> Option<String> {
    row.get::<_, Option<String>>(name).ok().flatten()
}
fn parse_tag_names(value: Option<String>) -> Vec<String> {
    value
        .unwrap_or_default()
        .split('\u{1f}')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

fn map_item_summary(row: &Row) -> rusqlite::Result<Json> {
    let id = col_i64(row, "id").unwrap_or(0);
    let has_file = col_str(row, "file_rel_path").is_some();
    Ok(json!({
        "id": id,
        "title": col_str(row, "title").unwrap_or_default(),
        "plate": col_str(row, "plate"),
        "word": col_str(row, "word"),
        "width": col_i64(row, "width"),
        "height": col_i64(row, "height"),
        "bytes": col_i64(row, "bytes"),
        "publishedAt": col_str(row, "published_at"),
        "views": col_i64(row, "views"),
        "tags": parse_tag_names(col_str(row, "tag_names")),
        "pixivId": col_str(row, "pixiv_id"),
        "favorite": col_i64(row, "favorite").unwrap_or(0) == 1,
        "rating": col_i64(row, "rating").unwrap_or(0),
        "fileStatus": if has_file { "ready" } else { "missing" },
        "ext": col_str(row, "file_ext").or_else(|| col_str(row, "remote_ext")),
        "fileBytes": col_i64(row, "file_bytes"),
        "thumbUrl": if has_file { Json::String(format!("{}{id}", crate::media::THUMB_BASE)) } else { Json::Null },
        "imageUrl": if has_file { Json::String(format!("{}{id}", crate::media::MEDIA_BASE)) } else { Json::Null }
    }))
}

fn map_item_detail(row: &Row) -> rusqlite::Result<Json> {
    let mut base = map_item_summary(row)?;
    let obj = base.as_object_mut().expect("对象");
    obj.insert("detailUrl".into(), json!(col_str(row, "detail_url").unwrap_or_default()));
    obj.insert("sourceUrl".into(), json!(col_str(row, "source_url")));
    obj.insert("uploader".into(), json!(col_str(row, "uploader")));
    obj.insert("pixivArtistUrl".into(), json!(col_str(row, "pixiv_artist_url")));
    obj.insert("likes".into(), json!(col_i64(row, "likes").unwrap_or(0)));
    obj.insert("collects".into(), json!(col_i64(row, "collects").unwrap_or(0)));
    obj.insert("remotePath".into(), json!(col_str(row, "remote_path")));
    obj.insert("previewUrl".into(), json!(col_str(row, "preview_url")));
    obj.insert("downloadUrl".into(), json!(col_str(row, "download_url")));
    obj.insert("sha256".into(), json!(col_str(row, "file_sha256")));
    obj.insert("relPath".into(), json!(col_str(row, "file_rel_path")));
    obj.insert("downloadedAt".into(), json!(col_str(row, "file_downloaded_at")));
    obj.insert("indexedAt".into(), json!(col_str(row, "indexed_at")));
    Ok(base)
}

/* -------------------------------------------------------------------- 读接口 */

pub fn list_items(conn: &Connection, q: &GalleryQuery) -> rusqlite::Result<Json> {
    let (where_sql, params) = build_where(q);
    let limit = q.limit_or(60);
    let offset = q.offset();

    let count_sql = format!(
        "SELECT COUNT(*) FROM items i LEFT JOIN files f ON f.item_id = i.id AND f.variant = 'original' {where_sql}"
    );
    let total: i64 = conn.query_row(&count_sql, params_from_iter(params.iter()), |r| r.get(0))?;

    let order = build_order(q.sort.as_deref());
    let sql = format!("{ITEM_SELECT} {where_sql} ORDER BY {order} LIMIT ? OFFSET ?");
    let mut all = params.clone();
    all.push(SqlValue::Integer(limit));
    all.push(SqlValue::Integer(offset));

    let mut stmt = conn.prepare(&sql)?;
    let items: Vec<Json> = stmt
        .query_map(params_from_iter(all.iter()), |row| map_item_summary(row))?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let next_offset = offset + items.len() as i64;
    Ok(json!({
        "items": items,
        "total": total,
        "nextCursor": if next_offset < total && !items.is_empty() { Json::String(next_offset.to_string()) } else { Json::Null }
    }))
}

pub fn get_item(conn: &Connection, id: i64) -> rusqlite::Result<Option<Json>> {
    let sql = format!("{ITEM_SELECT} WHERE i.id = ?");
    conn.query_row(&sql, [id], |row| map_item_detail(row)).optional()
}

pub fn facets(conn: &Connection) -> rusqlite::Result<Json> {
    let mut plates: Vec<(String, i64, Vec<Json>, )> = Vec::new();
    {
        let mut stmt = conn.prepare(
            "SELECT plate AS plate, word AS word, COUNT(*) AS count
             FROM items WHERE plate IS NOT NULL AND word IS NOT NULL
             GROUP BY plate, word ORDER BY plate, count DESC",
        )?;
        let mut rows = stmt.query([])?;
        while let Some(row) = rows.next()? {
            let plate: String = row.get("plate")?;
            let word: String = row.get("word")?;
            let count: i64 = row.get("count")?;
            match plates.iter_mut().find(|p| p.0 == plate) {
                Some(entry) => {
                    entry.1 += count;
                    entry.2.push(json!({ "name": word, "count": count }));
                }
                None => plates.push((plate, count, vec![json!({ "name": word, "count": count })])),
            }
        }
    }
    plates.sort_by(|a, b| b.1.cmp(&a.1));
    let plates_json: Vec<Json> = plates
        .into_iter()
        .map(|(name, count, words)| json!({ "name": name, "count": count, "words": words }))
        .collect();

    let top_tags = query_facets(
        conn,
        "SELECT t.name AS name, COUNT(*) AS count
         FROM item_tags it JOIN tags t ON t.id = it.tag_id
         GROUP BY t.id ORDER BY count DESC, t.name LIMIT 120",
    )?;
    let words = query_facets(
        conn,
        "SELECT word AS name, COUNT(*) AS count FROM items WHERE word IS NOT NULL GROUP BY word",
    )?;
    let targets = query_facets(
        conn,
        "SELECT word AS name, COUNT(*) AS count FROM item_targets GROUP BY word",
    )?;

    Ok(json!({
        "plates": plates_json,
        "topTags": top_tags,
        "words": words,
        "targets": targets
    }))
}

fn query_facets(conn: &Connection, sql: &str) -> rusqlite::Result<Vec<Json>> {
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map([], |row| {
        Ok(json!({
            "name": row.get::<_, String>("name")?,
            "count": row.get::<_, i64>("count")?
        }))
    })?;
    rows.collect()
}

pub fn stats(conn: &Connection, library_root: &str, db_bytes: i64) -> rusqlite::Result<Json> {
    let items: i64 = conn.query_row("SELECT COUNT(*) FROM items", [], |r| r.get(0))?;
    let downloaded: i64 =
        conn.query_row("SELECT COUNT(*) FROM files WHERE variant = 'original'", [], |r| r.get(0))?;
    let favorites: i64 =
        conn.query_row("SELECT COUNT(*) FROM items WHERE favorite = 1", [], |r| r.get(0))?;
    let total_bytes: i64 =
        conn.query_row("SELECT COALESCE(SUM(bytes),0) FROM files", [], |r| r.get(0))?;
    let sources: i64 = conn.query_row("SELECT COUNT(*) FROM sources", [], |r| r.get(0))?;
    let f = facets(conn)?;

    Ok(json!({
        "items": items,
        "downloaded": downloaded,
        "favorites": favorites,
        "totalBytes": total_bytes,
        "plates": f["plates"].clone(),
        "topTags": f["topTags"].clone(),
        "sources": sources,
        "libraryRoot": library_root,
        "dbBytes": db_bytes
    }))
}

/** 只读查询：把任意 SELECT 结果转成 JSON 数组（给 jobs / sources 用） */
fn rows_to_json(conn: &Connection, sql: &str, params: Vec<SqlValue>) -> rusqlite::Result<Vec<Json>> {
    let mut stmt = conn.prepare(sql)?;
    let names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let mut out = Vec::new();
    let mut rows = stmt.query(params_from_iter(params.iter()))?;
    while let Some(row) = rows.next()? {
        let mut obj = serde_json::Map::new();
        for (i, name) in names.iter().enumerate() {
            let value: SqlValue = row.get(i)?;
            let v = match value {
                SqlValue::Null => Json::Null,
                SqlValue::Integer(n) => json!(n),
                SqlValue::Real(f) => json!(f),
                SqlValue::Text(t) => json!(t),
                SqlValue::Blob(_) => Json::Null,
            };
            obj.insert(name.clone(), v);
        }
        out.push(Json::Object(obj));
    }
    Ok(out)
}

pub fn list_jobs(conn: &Connection, limit: i64) -> rusqlite::Result<Vec<Json>> {
    rows_to_json(
        conn,
        "SELECT * FROM jobs ORDER BY id DESC LIMIT ?",
        vec![SqlValue::Integer(limit)],
    )
}

pub fn list_sources(conn: &Connection) -> rusqlite::Result<Vec<Json>> {
    let rows = rows_to_json(
        conn,
        "SELECT s.*, (SELECT COUNT(*) FROM items i WHERE i.source_url = s.url) AS item_count
         FROM sources s ORDER BY s.id DESC",
        vec![],
    )?;
    Ok(rows
        .into_iter()
        .map(|r| {
            json!({
                "id": r["id"].clone(),
                "kind": r["kind"].clone(),
                "plate": r["plate"].clone(),
                "word": r["word"].clone(),
                "url": r["url"].clone(),
                "title": r["title"].clone(),
                "enabled": r["enabled"].as_i64().unwrap_or(0) == 1,
                "itemCount": r["item_count"].clone(),
                "lastCrawledAt": r["last_crawled_at"].clone()
            })
        })
        .collect())
}

/* -------------------------------------------------------------------- 写接口 */

pub fn set_favorite(conn: &Connection, id: i64, value: bool) -> rusqlite::Result<bool> {
    conn.execute(
        "UPDATE items SET favorite = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![if value { 1 } else { 0 }, now_iso(), id],
    )?;
    Ok(value)
}

pub fn set_rating(conn: &Connection, id: i64, value: i64) -> rusqlite::Result<i64> {
    conn.execute(
        "UPDATE items SET rating = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![value, now_iso(), id],
    )?;
    Ok(value)
}

pub fn delete_items(conn: &Connection, ids: &[i64]) -> rusqlite::Result<i64> {
    if ids.is_empty() {
        return Ok(0);
    }
    let marks = vec!["?"; ids.len()].join(",");
    let params: Vec<SqlValue> = ids.iter().map(|i| SqlValue::Integer(*i)).collect();
    let tx = conn.unchecked_transaction()?;
    tx.execute(&format!("DELETE FROM item_tags WHERE item_id IN ({marks})"), params_from_iter(params.iter()))?;
    tx.execute(&format!("DELETE FROM item_targets WHERE item_id IN ({marks})"), params_from_iter(params.iter()))?;
    tx.execute(&format!("DELETE FROM files WHERE item_id IN ({marks})"), params_from_iter(params.iter()))?;
    tx.execute(&format!("DELETE FROM items WHERE id IN ({marks})"), params_from_iter(params.iter()))?;
    tx.commit()?;
    Ok(ids.len() as i64)
}

/** 原图相对路径（自定义协议要用） */
pub fn file_rel_path(conn: &Connection, item_id: i64, variant: &str) -> rusqlite::Result<Option<String>> {
    conn.query_row(
        "SELECT rel_path FROM files WHERE item_id = ?1 AND variant = ?2",
        rusqlite::params![item_id, variant],
        |r| r.get::<_, String>(0),
    )
    .optional()
}

pub fn thumb_rel_path(conn: &Connection, item_id: i64) -> rusqlite::Result<Option<String>> {
    conn.query_row(
        "SELECT thumb_rel FROM files WHERE item_id = ?1 AND variant = 'original'",
        [item_id],
        |r| r.get::<_, Option<String>>(0),
    )
    .optional()
    .map(|v| v.flatten())
}


/* ------------------------------------------------------------ 抓取写入路径 */

#[derive(Debug, Clone, Default)]
pub struct ItemUpsert {
    pub id: i64,
    pub detail_url: String,
    pub source_url: Option<String>,
    pub plate: Option<String>,
    pub word: Option<String>,
    pub title: String,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub bytes: Option<i64>,
    pub uploader: Option<String>,
    pub views: Option<i64>,
    pub published_at: Option<String>,
    pub remote_path: Option<String>,
    pub remote_ext: Option<String>,
    pub preview_url: Option<String>,
    pub download_url: Option<String>,
    pub page: Option<i64>,
    /// 抓取目标的关键词（搜索类目标才有）：记「从哪个应用分类找到它的」
    pub target_word: Option<String>,
    pub tags: Vec<String>,
}

/// 批量写入列表页解析结果；已存在的条目保留收藏 / 评分 / 详情补全标记
pub fn upsert_items(conn: &Connection, items: &[ItemUpsert]) -> rusqlite::Result<(i64, i64)> {
    let mut inserted = 0i64;
    let ts = now_iso();
    for it in items {
        let before: Option<i64> = conn
            .query_row("SELECT id FROM items WHERE id = ?1", [it.id], |r| r.get(0))
            .optional()?;
        conn.execute(
            "INSERT INTO items (id, detail_url, source_url, plate, word, title, width, height, bytes,
                                uploader, views, published_at, remote_path, remote_ext,
                                preview_url, download_url, page, indexed_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19)
             ON CONFLICT(id) DO UPDATE SET
               detail_url   = excluded.detail_url,
               source_url   = COALESCE(excluded.source_url, items.source_url),
               plate        = COALESCE(excluded.plate, items.plate),
               word         = COALESCE(excluded.word, items.word),
               title        = CASE WHEN excluded.title <> '' THEN excluded.title ELSE items.title END,
               width        = COALESCE(excluded.width, items.width),
               height       = COALESCE(excluded.height, items.height),
               bytes        = COALESCE(excluded.bytes, items.bytes),
               uploader     = COALESCE(excluded.uploader, items.uploader),
               views        = COALESCE(excluded.views, items.views),
               published_at = COALESCE(items.published_at, excluded.published_at),
               remote_path  = COALESCE(excluded.remote_path, items.remote_path),
               remote_ext   = COALESCE(excluded.remote_ext, items.remote_ext),
               preview_url  = COALESCE(excluded.preview_url, items.preview_url),
               download_url = COALESCE(excluded.download_url, items.download_url),
               page         = COALESCE(excluded.page, items.page),
               updated_at   = excluded.updated_at",
            rusqlite::params![
                it.id, it.detail_url, it.source_url, it.plate, it.word, it.title, it.width, it.height,
                it.bytes, it.uploader, it.views, it.published_at, it.remote_path, it.remote_ext,
                it.preview_url, it.download_url, it.page, ts, ts
            ],
        )?;
        if before.is_none() {
            inserted += 1;
        }
        if let Some(word) = it.target_word.as_deref() {
            conn.execute(
                "INSERT OR IGNORE INTO item_targets (item_id, word) VALUES (?1, ?2)",
                rusqlite::params![it.id, word],
            )?;
        }
        if !it.tags.is_empty() {
            replace_tags(conn, it.id, &it.tags)?;
        }
    }
    Ok((inserted, items.len() as i64 - inserted))
}

/// 站点标签是「替换」语义；应用侧标签（item_targets 对应）要留住
fn replace_tags(conn: &Connection, item_id: i64, tags: &[String]) -> rusqlite::Result<()> {
    let mut merged: Vec<String> = tags.to_vec();
    {
        let mut stmt = conn.prepare("SELECT word FROM item_targets WHERE item_id = ?1")?;
        let mut rows = stmt.query([item_id])?;
        while let Some(row) = rows.next()? {
            let word: String = row.get(0)?;
            let tag = category_tag_for(&word);
            if !merged.contains(&tag) {
                merged.push(tag);
            }
        }
    }
    conn.execute("DELETE FROM item_tags WHERE item_id = ?1", [item_id])?;
    for raw in merged {
        let name = raw.trim().to_string();
        if name.is_empty() {
            continue;
        }
        conn.execute("INSERT OR IGNORE INTO tags (name) VALUES (?1)", [name.clone()])?;
        let tag_id: i64 = conn.query_row("SELECT id FROM tags WHERE name = ?1", [name], |r| r.get(0))?;
        conn.execute(
            "INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?1, ?2)",
            rusqlite::params![item_id, tag_id],
        )?;
    }
    Ok(())
}


/// 待补详情页的条目：rich = 0 表示还没抓过详情页
/// （Pixiv 作品号 / 画师主页 / 完整标签只有详情页才有）
pub fn items_needing_detail(conn: &Connection, ids: &[i64]) -> rusqlite::Result<Vec<(i64, String)>> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let marks = vec!["?"; ids.len()].join(",");
    let params: Vec<SqlValue> = ids.iter().map(|i| SqlValue::Integer(*i)).collect();
    let sql = format!(
        "SELECT id, detail_url FROM items
          WHERE id IN ({marks}) AND COALESCE(rich, 0) = 0 AND COALESCE(detail_url, '') <> ''"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(params.iter()), |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
    })?;
    rows.collect()
}

/// 把详情页抓到的东西并进条目：只补空字段，不动收藏 / 评分 / 应用分类
pub fn apply_detail(
    conn: &Connection,
    item_id: i64,
    detail: &crate::crawler::parser::RawDetail,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE items SET
            title            = CASE WHEN ?2 <> '' THEN ?2 ELSE title END,
            width            = COALESCE(?3, width),
            height           = COALESCE(?4, height),
            bytes            = COALESCE(?5, bytes),
            uploader         = COALESCE(?6, uploader),
            views            = COALESCE(?7, views),
            likes            = COALESCE(?8, likes),
            collects         = COALESCE(?9, collects),
            published_at     = COALESCE(published_at, ?10),
            pixiv_id         = COALESCE(?11, pixiv_id),
            pixiv_artist_url = COALESCE(?12, pixiv_artist_url),
            rich             = 1,
            updated_at       = ?13
          WHERE id = ?1",
        rusqlite::params![
            item_id,
            detail.title,
            detail.width,
            detail.height,
            detail.bytes,
            detail.uploader,
            detail.views,
            detail.likes,
            detail.collects,
            detail.published_at,
            detail.pixiv_id,
            detail.pixiv_artist_url,
            now_iso(),
        ],
    )?;
    if !detail.tags.is_empty() {
        replace_tags(conn, item_id, &detail.tags)?;
    }
    Ok(())
}

/// 本地文件不在了：把过期的 files 行清掉，界面就会重新显示「下载」而不是坏图
pub fn drop_file(conn: &Connection, item_id: i64, variant: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "DELETE FROM files WHERE item_id = ?1 AND variant = ?2",
        rusqlite::params![item_id, variant],
    )
}

/// 站点关键词 -> 应用分类显示名（与 shared/categories.ts 的 categoryTagFor 一致）
pub fn category_tag_for(word: &str) -> String {
    match word {
        "泳装类分享" => "泳装分享".to_string(),
        other => other.to_string(),
    }
}

pub fn mark_page(conn: &Connection, source_url: &str, page: i64, item_count: i64) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO page_marks (source_url, page, item_count, fetched_at) VALUES (?1,?2,?3,?4)",
        rusqlite::params![source_url, page, item_count, now_iso()],
    )?;
    Ok(())
}

pub fn has_page_mark(conn: &Connection, source_url: &str, page: i64) -> rusqlite::Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM page_marks WHERE source_url = ?1 AND page = ?2",
        rusqlite::params![source_url, page],
        |r| r.get(0),
    )?;
    Ok(count > 0)
}

pub fn upsert_source(
    conn: &Connection,
    kind: &str,
    plate: Option<&str>,
    word: Option<&str>,
    url: &str,
    title: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO sources (kind, plate, word, url, title, enabled, created_at)
         VALUES (?1,?2,?3,?4,?5,1,?6)
         ON CONFLICT(url) DO UPDATE SET kind = excluded.kind, plate = excluded.plate,
                                        word = excluded.word, title = excluded.title",
        rusqlite::params![kind, plate, word, url, title, now_iso()],
    )?;
    Ok(())
}

pub fn update_source_stats(
    conn: &Connection,
    url: &str,
    total_pages: Option<i64>,
    total_items: Option<i64>,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE sources SET total_pages = COALESCE(?1, total_pages),
                            total_items = COALESCE(?2, total_items),
                            last_crawled_at = ?3
         WHERE url = ?4",
        rusqlite::params![total_pages, total_items, now_iso(), url],
    )?;
    Ok(())
}

pub fn create_job(conn: &Connection, phase: &str, summary: &str, request_json: &str) -> rusqlite::Result<i64> {
    conn.execute(
        "INSERT INTO jobs (phase, summary, request, stats, started_at) VALUES (?1,?2,?3,'{}',?4)",
        rusqlite::params![phase, summary, request_json, now_iso()],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn finish_job(conn: &Connection, id: i64, phase: &str, stats_json: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE jobs SET phase = ?1, stats = ?2, finished_at = ?3 WHERE id = ?4",
        rusqlite::params![phase, stats_json, now_iso(), id],
    )?;
    Ok(())
}

pub fn apply_file_metrics(
    conn: &Connection,
    id: i64,
    width: Option<i64>,
    height: Option<i64>,
    bytes: i64,
    ext: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE items SET width = COALESCE(?1, width),
                          height = COALESCE(?2, height),
                          bytes = ?3,
                          remote_ext = ?4,
                          updated_at = ?5
         WHERE id = ?6",
        rusqlite::params![width, height, bytes, ext, now_iso(), id],
    )?;
    Ok(())
}

#[derive(Debug, Clone)]
pub struct QueueItem {
    pub id: i64,
    pub remote_path: Option<String>,
    pub title: String,
}

fn queue_where(q: &GalleryQuery, only_missing: bool) -> (String, Vec<SqlValue>) {
    let (where_sql, params) = build_where(q);
    let cond = if only_missing {
        if where_sql.is_empty() {
            "WHERE f.id IS NULL".to_string()
        } else {
            format!("{where_sql} AND f.id IS NULL")
        }
    } else {
        where_sql
    };
    (cond, params)
}

pub fn list_download_queue(
    conn: &Connection,
    q: &GalleryQuery,
    limit: i64,
    only_missing: bool,
) -> rusqlite::Result<Vec<QueueItem>> {
    let (cond, params) = queue_where(q, only_missing);
    let sql = format!(
        "SELECT i.id, i.remote_path, i.title FROM items i
         LEFT JOIN files f ON f.item_id = i.id AND f.variant = 'original'
         {cond}
         ORDER BY COALESCE(i.published_at, i.indexed_at) DESC, i.id DESC
         LIMIT ?"
    );
    let mut all = params.clone();
    all.push(SqlValue::Integer(limit));
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(all.iter()), |row| {
        Ok(QueueItem {
            id: row.get(0)?,
            remote_path: row.get(1)?,
            title: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
        })
    })?;
    rows.collect()
}

pub fn count_download_queue(conn: &Connection, q: &GalleryQuery, only_missing: bool) -> rusqlite::Result<i64> {
    let (cond, params) = queue_where(q, only_missing);
    let sql = format!(
        "SELECT COUNT(*) FROM items i LEFT JOIN files f ON f.item_id = i.id AND f.variant = 'original' {cond}"
    );
    conn.query_row(&sql, params_from_iter(params.iter()), |r| r.get(0))
}

pub fn list_queue_by_ids(conn: &Connection, ids: &[i64]) -> rusqlite::Result<Vec<QueueItem>> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let marks = vec!["?"; ids.len()].join(",");
    let params: Vec<SqlValue> = ids.iter().map(|i| SqlValue::Integer(*i)).collect();
    let sql = format!("SELECT id, remote_path, title FROM items WHERE id IN ({marks})");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(params.iter()), |row| {
        Ok(QueueItem {
            id: row.get(0)?,
            remote_path: row.get(1)?,
            title: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
        })
    })?;
    rows.collect()
}

pub fn upsert_file(
    conn: &Connection,
    item_id: i64,
    rel_path: &str,
    thumb_rel: Option<&str>,
    ext: &str,
    mime: &str,
    width: Option<i64>,
    height: Option<i64>,
    bytes: i64,
    sha256: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO files (item_id, rel_path, thumb_rel, ext, mime, width, height, bytes, sha256, variant, downloaded_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,'original',?10)
         ON CONFLICT(item_id, variant) DO UPDATE SET
           rel_path = excluded.rel_path,
           thumb_rel = COALESCE(excluded.thumb_rel, files.thumb_rel),
           ext = excluded.ext, mime = excluded.mime, width = excluded.width,
           height = excluded.height, bytes = excluded.bytes, sha256 = excluded.sha256,
           downloaded_at = excluded.downloaded_at",
        rusqlite::params![item_id, rel_path, thumb_rel, ext, mime, width, height, bytes, sha256, now_iso()],
    )?;
    Ok(())
}

pub fn item_meta(conn: &Connection, id: i64) -> rusqlite::Result<Option<(Option<String>, Option<String>, String, Option<String>)>> {
    conn.query_row(
        "SELECT plate, word, COALESCE(title,''), pixiv_id FROM items WHERE id = ?1",
        [id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
    )
    .optional()
}

pub fn has_file(conn: &Connection, item_id: i64) -> rusqlite::Result<bool> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM files WHERE item_id = ?1 AND variant = 'original'",
        [item_id],
        |r| r.get(0),
    )?;
    Ok(n > 0)
}

pub fn item_tags(conn: &Connection, item_id: i64) -> rusqlite::Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT t.name FROM item_tags it JOIN tags t ON t.id = it.tag_id WHERE it.item_id = ?1",
    )?;
    let rows = stmt.query_map([item_id], |row| row.get::<_, String>(0))?;
    rows.collect()
}
