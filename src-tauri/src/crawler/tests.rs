/**
 * 解析层回归测试（从 Electron 版的 tests/parser.test.ts 逐条搬过来）。
 * 用的是同一批真实 HTML 样本：站点改版时这些测试会第一时间失败。
 */
use super::http::sniff_format;
use super::parser::{parse_caption, parse_detail, parse_list_items, parse_nav, parse_pagination};
use super::site::{decode_item_param, list_url, original_url, parse_human_size, preview_url, SiteTarget};

fn fixture(name: &str) -> String {
    let path = format!("{}/tests/fixtures/{}", env!("CARGO_MANIFEST_DIR"), name);
    std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("读不到样本 {path}: {e}"))
}

fn category_target() -> SiteTarget {
    SiteTarget {
        kind: "category".into(),
        plate: Some("ACG图片".into()),
        word: Some("Pixiv萌图".into()),
        url: None,
    }
}

#[test]
fn 构造分类列表地址() {
    assert_eq!(
        list_url(&category_target(), 1).unwrap(),
        "https://www.guguxz.com/search/index/plate/ACG%E5%9B%BE%E7%89%87/wd/Pixiv%E8%90%8C%E5%9B%BE.html"
    );
    assert!(list_url(&category_target(), 3).unwrap().contains("?page=3"));
    let home = SiteTarget { kind: "home".into(), ..Default::default() };
    assert_eq!(list_url(&home, 2).unwrap(), "https://www.guguxz.com/?page=2");
    let search = SiteTarget { kind: "search".into(), word: Some("分享".into()), ..Default::default() };
    assert!(list_url(&search, 1).unwrap().contains("/search/index/wd/%E5%88%86%E4%BA%AB.html"));
}

#[test]
fn 构造图片地址() {
    let path = "d/y/orig/f13f94/item/d57986f9b5cb481bd9f97fe00b74cf68.png";
    assert_eq!(
        original_url(path),
        "https://www.guguxz.com/index/imageBed?item=d/y/orig/f13f94/item/d57986f9b5cb481bd9f97fe00b74cf68.png&dw=true"
    );
    assert!(preview_url(path).contains("item=ZC95L29yaWcvZjEzZjk0"));
}

#[test]
fn 解开标准_base64() {
    assert_eq!(
        decode_item_param("ZC95L29yaWcvZjEzZjk0L2l0ZW0vZDU3OTg2ZjliNWNiNDgxYmQ5Zjk3ZmUwMGI3NGNmNjgucG5n").unwrap(),
        "d/y/orig/f13f94/item/d57986f9b5cb481bd9f97fe00b74cf68.png"
    );
}

#[test]
fn base64_接受明文路径并拒绝非法输入() {
    assert_eq!(decode_item_param("d/y/orig/acbab8/item/abc.png").unwrap(), "d/y/orig/acbab8/item/abc.png");
    assert!(decode_item_param("not base64!!!").is_none());
}

#[test]
fn 尺寸描述解析() {
    let (w, h, bytes, uploader) = parse_caption("2160x3456 1.69M [匿名-分享]");
    assert_eq!(w, Some(2160));
    assert_eq!(h, Some(3456));
    assert_eq!(bytes, Some((1.69 * 1024f64 * 1024f64).round() as i64));
    assert_eq!(uploader.as_deref(), Some("匿名-分享"));

    let (_, _, kb, _) = parse_caption("1856x1280 222.38K [匿名-分享]");
    assert_eq!(kb, Some((222.38 * 1024f64).round() as i64));
}

#[test]
fn 人类可读大小换算() {
    assert_eq!(parse_human_size("1.69M"), Some((1.69 * 1024f64 * 1024f64).round() as i64));
    assert_eq!(parse_human_size("222.38K"), Some((222.38 * 1024f64).round() as i64));
    assert_eq!(parse_human_size("512"), Some(512));
    assert_eq!(parse_human_size("abc"), None);
}

#[test]
fn 列表页解析出全部十个条目且字段完整() {
    let html = fixture("list-pixiv.html");
    let items = parse_list_items(&html);
    assert_eq!(items.len(), 10);
    let first = &items[0];
    assert_eq!(first.id, 19521);
    assert!(first.detail_url.contains("/id/19521.html"));
    assert_eq!(first.width, Some(2160));
    assert_eq!(first.height, Some(1080));
    assert_eq!(first.remote_path.as_deref(), Some("d/y/orig/acbab8/item/0b70bb331c620d066380564c077ed4f5.png"));
    assert_eq!(first.plate.as_deref(), Some("ACG图片"));
    assert_eq!(first.word.as_deref(), Some("Pixiv萌图"));
    assert_eq!(first.views, Some(3));
    assert_eq!(first.published_at.as_deref(), Some("2026-09-14 10:00"));
    assert!(first.tags.iter().any(|t| t == "明日方舟"));
}

#[test]
fn 条目_id_不重复且都有原图路径() {
    let html = fixture("list-pixiv.html");
    let items = parse_list_items(&html);
    let mut ids: Vec<i64> = items.iter().map(|i| i.id).collect();
    let before = ids.len();
    ids.sort_unstable();
    ids.dedup();
    assert_eq!(ids.len(), before);
    for item in &items {
        assert!(item.remote_path.is_some(), "条目 {} 缺原图路径", item.id);
    }
}

#[test]
fn 分页信息() {
    let html = fixture("list-pixiv.html");
    assert_eq!(parse_pagination(&html), (Some(1430), Some(14294)));
}

#[test]
fn 排行页与首页同样可解析() {
    let ranking = parse_list_items(&fixture("list-ranking.html"));
    assert!(!ranking.is_empty());
    assert!(ranking[0].remote_path.is_some());
    let home = parse_list_items(&fixture("home.html"));
    assert_eq!(home.len(), 10);
}

#[test]
fn 空页返回空数组() {
    assert!(parse_list_items("<html><body>什么都没有</body></html>").is_empty());
}

#[test]
fn 导航解析出分类树并丢掉示例模板() {
    let plates = parse_nav(&fixture("home.html"));
    let acg = plates.iter().find(|p| p.name == "ACG图片").expect("应有 ACG图片");
    assert!(acg.words.iter().any(|w| w == "Pixiv萌图"));
    assert!(acg.words.iter().any(|w| w == "电脑壁纸"));
    assert!(plates.iter().any(|p| p.name == "搞笑图片"), "注释里的分类也该采到");
    assert!(!plates.iter().any(|p| p.name.contains("分类名")), "模板占位名必须丢掉");
    assert!(plates.iter().all(|p| p.words.iter().all(|w| !w.contains("分类名"))));
}

#[test]
fn 详情页基础字段() {
    let detail = parse_detail(&fixture("detail-19519.html"), Some(19519));
    assert_eq!(detail.id, Some(19519));
    assert_eq!(detail.width, Some(2160));
    assert_eq!(detail.height, Some(3456));
    assert_eq!(detail.bytes, Some((1.69 * 1024f64 * 1024f64).round() as i64));
    assert_eq!(detail.uploader.as_deref(), Some("匿名"));
    assert_eq!(detail.views, Some(6));
    assert_eq!(detail.published_at.as_deref(), Some("2026-09-14"));
}

#[test]
fn 详情页标签与分类() {
    let detail = parse_detail(&fixture("detail-19519.html"), Some(19519));
    for t in ["碧蓝档案", "女孩子", "海滩"] {
        assert!(detail.tags.iter().any(|x| x == t), "缺标签 {t}");
    }
    for c in ["ACG图片", "Pixiv萌图"] {
        assert!(detail.categories.iter().any(|x| x == c), "缺分类 {c}");
    }
}

#[test]
fn 详情页_pixiv_信息与原图路径() {
    let detail = parse_detail(&fixture("detail-19519.html"), Some(19519));
    assert_eq!(detail.pixiv_id.as_deref(), Some("115534247"));
    assert_eq!(detail.pixiv_artist_url.as_deref(), Some("https://www.pixiv.net/users/50077972"));
    assert_eq!(detail.remote_path.as_deref(), Some("d/y/orig/f13f94/item/d57986f9b5cb481bd9f97fe00b74cf68.png"));
}

#[test]
fn 图片格式嗅探() {
    assert_eq!(sniff_format(&[0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]), Some(("jpg", "image/jpeg")));
    assert_eq!(
        sniff_format(&[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).map(|v| v.0),
        Some("png")
    );
    let mut webp = [0u8; 12];
    webp[0..4].copy_from_slice(b"RIFF");
    webp[8..12].copy_from_slice(b"WEBP");
    assert_eq!(sniff_format(&webp).map(|v| v.0), Some("webp"));
    assert_eq!(sniff_format(&[0u8; 12]), None);
}
