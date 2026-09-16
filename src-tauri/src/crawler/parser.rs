/**
 * 列表页 / 详情页 HTML -> 结构化数据（纯函数，便于单测）。
 * 与 Electron 版的 src/main/crawler/parser.ts 一一对应，正则语义保持一致。
 *
 * 说明：这里刻意用 [[:space:]] / [0-9] 这类**不含反斜杠**的写法，
 * 避免在多层模板里转义丢失导致正则静默失效（踩过一次：\s 变成 s，整页解析不出条目）。
 */
use super::site::{decode_item_param, parse_human_size, SITE_ORIGIN};
use regex::Regex;
use serde::Serialize;

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RawListItem {
    pub id: i64,
    pub detail_url: String,
    pub remote_path: Option<String>,
    pub title: String,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub bytes: Option<i64>,
    pub uploader: Option<String>,
    pub tags: Vec<String>,
    pub published_at: Option<String>,
    pub plate: Option<String>,
    pub word: Option<String>,
    pub views: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct RawNavPlate {
    pub name: String,
    pub words: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RawDetail {
    pub id: Option<i64>,
    pub title: String,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub bytes: Option<i64>,
    pub uploader: Option<String>,
    pub views: Option<i64>,
    pub likes: Option<i64>,
    pub collects: Option<i64>,
    pub published_at: Option<String>,
    pub categories: Vec<String>,
    pub tags: Vec<String>,
    pub pixiv_id: Option<String>,
    pub pixiv_artist_url: Option<String>,
    pub remote_path: Option<String>,
}

/* ------------------------------------------------------------------ 工具 */

const SP: &str = "[[:space:]]";

fn re(pattern: &str) -> Regex {
    Regex::new(pattern).unwrap_or_else(|e| panic!("内置正则非法: {pattern} -> {e}"))
}

pub fn decode_entities(text: &str) -> String {
    let entity_re = re("&(#x?[0-9a-fA-F]+|[a-zA-Z]+);");
    entity_re
        .replace_all(text, |caps: &regex::Captures| {
            let code = &caps[1];
            if code.starts_with("#x") || code.starts_with("#X") {
                return u32::from_str_radix(&code[2..], 16)
                    .ok()
                    .and_then(char::from_u32)
                    .map(|c| c.to_string())
                    .unwrap_or_else(|| caps[0].to_string());
            }
            if let Some(stripped) = code.strip_prefix('#') {
                return stripped
                    .parse::<u32>()
                    .ok()
                    .and_then(char::from_u32)
                    .map(|c| c.to_string())
                    .unwrap_or_else(|| caps[0].to_string());
            }
            match code {
                "amp" => "&".into(),
                "lt" => "<".into(),
                "gt" => ">".into(),
                "quot" => "\"".into(),
                "apos" => "'".into(),
                "nbsp" => " ".into(),
                _ => caps[0].to_string(),
            }
        })
        .to_string()
}

fn strip_tags(html: &str) -> String {
    let no_tags = re("<[^>]*>").replace_all(html, " ").to_string();
    let decoded = decode_entities(&no_tags);
    let squashed = re(&format!("{SP}+")).replace_all(&decoded, " ").to_string();
    squashed.trim().to_string()
}

fn first_match(html: &str, pattern: &str) -> Option<String> {
    re(pattern).captures(html).and_then(|c| c.get(1).map(|m| m.as_str().to_string()))
}

fn to_int(text: Option<&str>) -> Option<i64> {
    let text = text?;
    let cleaned: String = text
        .chars()
        .filter(|c| !matches!(c, ',' | '，') && !c.is_whitespace())
        .collect();
    re("-?[0-9]+").find(&cleaned)?.as_str().parse().ok()
}

/// 从 `<h2>2160x3456 1.69M [匿名-分享]</h2>` 里拆出尺寸 / 大小 / 上传者
pub fn parse_caption(caption: &str) -> (Option<i64>, Option<i64>, Option<i64>, Option<String>) {
    let text = strip_tags(caption);
    let dim_re = re("([0-9]{2,5})[[:space:]]*[x×*][[:space:]]*([0-9]{2,5})");
    let dim = dim_re.captures(&text);
    let mut width = None;
    let mut height = None;
    let mut tail: &str = &text;
    if let Some(caps) = &dim {
        width = caps.get(1).and_then(|m| m.as_str().parse().ok());
        height = caps.get(2).and_then(|m| m.as_str().parse().ok());
        if let Some(m) = caps.get(0) {
            tail = &text[m.end().min(text.len())..];
        }
    }
    let size_re = format!("(?i)([0-9][0-9.]*[[:space:]]*[kmg]?b?)");
    let mut bytes = first_match(tail, &size_re).and_then(|s| parse_human_size(&s.split_whitespace().collect::<String>()));
    if bytes == Some(0) {
        bytes = None;
    }
    let uploader = first_match(&text, "\\[([^\\]]+)\\]").map(|s| s.trim().to_string());
    (width, height, bytes, uploader)
}

/// 解析列表页底部「共<b>1430</b>页<b>14294</b>条数据」
pub fn parse_pagination(html: &str) -> (Option<i64>, Option<i64>) {
    let block = first_match(html, "<p class='pageRemark'[^>]*>([[:space:][:print:]]*?)</p>");
    let scope = block.unwrap_or_else(|| html.to_string());
    let pages_pat = format!("共[[:space:]]*<b>[[:space:]]*([0-9]+)[[:space:]]*</b>[[:space:]]*页");
    let items_pat = format!("</b>[[:space:]]*页[[:space:]]*<b>[[:space:]]*([0-9]+)[[:space:]]*</b>[[:space:]]*条");
    let pages = first_match(&scope, &pages_pat).and_then(|s| s.parse().ok());
    let items = first_match(&scope, &items_pat).and_then(|s| s.parse().ok());
    (pages, items)
}

/* -------------------------------------------------------------- 导航分类 */

fn is_template_placeholder(name: &str) -> bool {
    name.contains("分类名")
}

/// 解析顶部导航（只用于「重新读取分类」的展示）
pub fn parse_nav(html: &str) -> Vec<RawNavPlate> {
    let Some(start) = html.find("<nav>") else { return Vec::new() };
    let Some(end) = html.find("</nav>") else { return Vec::new() };
    let nav = &html[start..end];

    let anchor_re = re("<a class=\"nav_one\"|<a[^>]*href=\"([^\"]*/search/index/wd/[^\"]+[.]html)\"");
    let mut starts: Vec<usize> = Vec::new();
    for m in anchor_re.find_iter(nav) {
        starts.push(m.start());
    }
    let mut plates: Vec<RawNavPlate> = Vec::new();
    let link_re = re("href=\"[^\"]*/wd/([^\"/]+)[.]html\"");

    for (i, from) in starts.iter().enumerate() {
        let to = starts.get(i + 1).copied().unwrap_or(nav.len());
        let segment = &nav[*from..to];
        let name_html = first_match(segment, "(?s)</span>(.*?)</p>").unwrap_or_default();
        let name = strip_tags(&name_html);
        if name.is_empty() || name.chars().count() > 20 || is_template_placeholder(&name) {
            continue;
        }
        let scope = match segment.find("nav_two") {
            Some(idx) => {
                let after = segment[idx..].find('>').map(|p| idx + p + 1).unwrap_or(idx);
                &segment[after..]
            }
            None => segment,
        };
        let mut words: Vec<String> = Vec::new();
        for caps in link_re.captures_iter(scope) {
            let raw = &caps[1];
            let decoded = urlencoding::decode(raw).map(|c| c.to_string()).unwrap_or_else(|_| raw.to_string());
            if !decoded.is_empty() && decoded != "排行" && !is_template_placeholder(&decoded) && !words.contains(&decoded) {
                words.push(decoded);
            }
        }
        match plates.iter_mut().find(|p| p.name == name) {
            Some(existing) => {
                for w in words {
                    if !existing.words.contains(&w) {
                        existing.words.push(w);
                    }
                }
            }
            None => plates.push(RawNavPlate { name, words }),
        }
    }
    plates
}

/* ---------------------------------------------------------------- 列表页 */

pub fn parse_list_items(html: &str) -> Vec<RawListItem> {
    let anchor_re = re("(?s)<a[[:space:]][^>]*href=\"([^\"]*?/id/([0-9]+)[.]html)\"[^>]*>(.*?)</a>");
    let mut out = Vec::new();
    let mut seen: Vec<i64> = Vec::new();

    for caps in anchor_re.captures_iter(html) {
        let href = caps.get(1).map(|m| m.as_str()).unwrap_or("");
        let Some(id) = caps.get(2).and_then(|m| m.as_str().parse::<i64>().ok()) else { continue };
        let block = caps.get(3).map(|m| m.as_str()).unwrap_or("");
        if !block.contains("article_cover_list") || seen.contains(&id) {
            continue;
        }
        seen.push(id);

        let caption = first_match(block, "(?s)<h2>(.*?)</h2>").unwrap_or_default();
        let (width, height, bytes, uploader) = parse_caption(&caption);
        let tags_html = first_match(block, "(?s)<div class=\"content\">.*?<p>(.*?)</p>")
            .or_else(|| first_match(block, "(?s)<p>(.*?)</p>"))
            .unwrap_or_default();
        let tags: Vec<String> = re("\\[([^\\]]+)\\]")
            .captures_iter(&tags_html)
            .map(|c| decode_entities(&c[1]).trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        let date_text = strip_tags(&first_match(block, "(?s)<span>(.*?)</span>").unwrap_or_default());
        let em_text = strip_tags(&first_match(block, "(?s)<em>(.*?)</em>").unwrap_or_default());
        let published_at = first_match(&date_text, "([0-9]{4}-[0-9]{2}-[0-9]{2}(?:[ T][0-9]{2}:[0-9]{2}(?::[0-9]{2})?)?)");
        let views = first_match(&em_text, "([0-9]+)[[:space:]]*浏览").and_then(|s| s.parse().ok());
        let categories: Vec<String> = re("[[:space:]]*[0-9]+[[:space:]]*浏览.*$")
            .replace(&em_text, "")
            .trim()
            .split_whitespace()
            .map(|s| s.to_string())
            .collect();

        let detail_url = if href.starts_with("http") {
            decode_entities(href)
        } else {
            format!("{SITE_ORIGIN}{}", decode_entities(href))
        };

        out.push(RawListItem {
            id,
            detail_url,
            remote_path: extract_remote_path(block),
            title: strip_tags(&caption),
            width,
            height,
            bytes,
            uploader,
            tags,
            published_at,
            plate: categories.first().cloned(),
            word: categories.get(1).cloned(),
            views,
        });
    }
    out
}

fn extract_remote_path(block: &str) -> Option<String> {
    let comment_pat = "(?s)<!--[^>]*?files[.]guguxz[.]com/[^?]*[?]item=([^[:space:]\"'<&]+)";
    if let Some(c) = first_match(block, comment_pat) {
        if let Some(p) = decode_item_param(&decode_entities(&c)) {
            return Some(p);
        }
    }
    if let Some(img) = first_match(block, "imageBed[?]item=([A-Za-z0-9+/=_-]+)") {
        if let Some(p) = decode_item_param(&img) {
            return Some(p);
        }
    }
    first_match(block, "item=(d/[A-Za-z0-9_./-]+[.][A-Za-z0-9]{2,5})")
}

/* ---------------------------------------------------------------- 详情页 */

pub fn parse_detail(html: &str, fallback_id: Option<i64>) -> RawDetail {
    let id_from_dom = to_int(first_match(html, "(?s)<div id=\"archive_id\">[[:space:]]*([0-9]+)[[:space:]]*</div>").as_deref());
    let title = strip_tags(&first_match(html, "(?s)<div class=\"article_div2\">[[:space:]]*<h2>(.*?)</h2>").unwrap_or_default());
    let (cw, ch, cbytes, cuploader) = parse_caption(&title);

    let width_direct = to_int(first_match(html, "图片分辨率：[[:space:]]*([0-9]+)[[:space:]]*[x×]").as_deref());
    let height_direct = to_int(first_match(html, "图片分辨率：[[:space:]]*[0-9]+[[:space:]]*[x×][[:space:]]*([0-9]+)").as_deref());
    let size_text = first_match(html, "(?i)图片大小：[[:space:]]*([0-9.]+[[:space:]]*[kmg]?b?)");
    let uploader = first_match(html, "发布者：[[:space:]]*([^<]+)");

    let likes = first_match(html, "(?s)点赞</span>[[:space:]]*+[[:space:]]*<em>[[:space:]]*([0-9]+)").and_then(|s| s.parse().ok());
    let collects = first_match(html, "(?s)收藏</span>[[:space:]]*+[[:space:]]*<em>[[:space:]]*([0-9]+)").and_then(|s| s.parse().ok());

    let p1 = first_match(html, "(?s)<p class=\"p1\">(.*?)</p>").unwrap_or_default();
    let categories: Vec<String> = re("/search/index/wd/[^\"]*\"[^>]*>[[:space:]]*([^<]+?)[[:space:]]*<")
        .captures_iter(&p1)
        .map(|c| decode_entities(&c[1]).trim().to_string())
        .collect();
    let published_at = first_match(&p1, "<span>[[:space:]]*([0-9]{4}-[0-9]{2}-[0-9]{2})[[:space:]]*</span>");
    let views = to_int(first_match(&p1, "<span>[[:space:]]*([0-9]+)[[:space:]]*浏览[[:space:]]*</span>").as_deref());

    let em_html = first_match(html, "(?s)<em>[[:space:]]*<!--view-图片属性标签-->(.*?)</em>")
        .or_else(|| first_match(html, "(?s)<em>(.*?)</em>[[:space:]]*</div>"))
        .unwrap_or_default();
    let mut tags: Vec<String> = Vec::new();
    for c in re("/search/index/wd/[^\"']*[\"'][^>]*>[[:space:]]*([^<]+?)[[:space:]]*<").captures_iter(&em_html) {
        let t = decode_entities(&c[1]).trim().to_string();
        if !t.is_empty() && !tags.contains(&t) {
            tags.push(t);
        }
    }

    let pixiv_id = first_match(html, "Pid=([0-9]+)");
    let artist_id = first_match(html, "https://www[.]pixiv[.]net/users/([0-9]+)");
    let pixiv_artist_url = artist_id.map(|id| format!("https://www.pixiv.net/users/{id}"));

    let dw_pat = "imageBed[?]item=(d/[A-Za-z0-9_./-]+[.][A-Za-z0-9]{2,5})&(?:amp;)?dw=true";
    let mut remote_path = first_match(html, dw_pat).map(|p| decode_entities(&p));
    if remote_path.is_none() {
        if let Some(b64) = first_match(html, "imageBed[?]item=([A-Za-z0-9+/=_-]+)") {
            remote_path = decode_item_param(&b64);
        }
    }

    RawDetail {
        id: id_from_dom.or(fallback_id),
        title,
        width: width_direct.or(cw),
        height: height_direct.or(ch),
        bytes: size_text
            .and_then(|s| parse_human_size(&s.split_whitespace().collect::<String>()))
            .or(cbytes),
        uploader: uploader.map(|s| decode_entities(&s).trim().to_string()).or(cuploader),
        views,
        likes,
        collects,
        published_at,
        categories,
        tags,
        pixiv_id,
        pixiv_artist_url,
        remote_path,
    }
}
