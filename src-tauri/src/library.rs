/**
 * 图库的磁盘布局与路径安全（对应 Electron 版的 src/main/media/library.ts）。
 *
 * <libraryRoot>/
 *   index.db              SQLite 索引
 *   originals/<一级>/<二级>/<文件名>   原图
 *   thumbs/<id>.jpg      缩略图
 *   .tmp/                下载中转
 */
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Clone)]
pub struct Library {
    pub root: PathBuf,
    pub originals_dir: PathBuf,
    pub thumbs_dir: PathBuf,
    pub tmp_dir: PathBuf,
    pub db_path: PathBuf,
}

impl Library {
    pub fn new(root: &str) -> Self {
        let root = PathBuf::from(root);
        Self {
            originals_dir: root.join("originals"),
            thumbs_dir: root.join("thumbs"),
            tmp_dir: root.join(".tmp"),
            db_path: root.join("index.db"),
            root,
        }
    }

    pub fn ensure(&self) -> std::io::Result<()> {
        fs::create_dir_all(&self.originals_dir)?;
        fs::create_dir_all(&self.thumbs_dir)?;
        fs::create_dir_all(&self.tmp_dir)?;
        Ok(())
    }

    /// 相对路径 -> 绝对路径（并阻止越权访问）
    pub fn resolve_inside(&self, rel: &str) -> Option<PathBuf> {
        let rel = rel.replace('\\', "/");
        let joined = self.root.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR));
        let normalized = normalize(&joined);
        let root = normalize(&self.root);
        if normalized == root || !normalized.starts_with(&root) {
            return None;
        }
        Some(normalized)
    }

    pub fn original_rel_path(
        &self,
        id: i64,
        plate: Option<&str>,
        word: Option<&str>,
        slug: &str,
        ext: &str,
        naming: &str,
        pixiv_id: Option<&str>,
        sha256: Option<&str>,
    ) -> String {
        let plate = safe_segment(plate.unwrap_or("未分类"));
        let word = safe_segment(word.unwrap_or("全部"));
        let ext = ext.trim_start_matches('.').to_lowercase();
        let ext = if ext.is_empty() { "jpg".to_string() } else { ext };
        let slug: String = safe_segment(slug).chars().take(48).collect();

        let name = match naming {
            "id" => format!("{id}.{ext}"),
            "pixiv" => match pixiv_id {
                Some(p) if !p.is_empty() => format!("pid{p}.{ext}"),
                _ => format!("{id}.{ext}"),
            },
            "hash" => {
                let h = sha256.unwrap_or("");
                let h = if h.is_empty() { id.to_string() } else { h.to_string() };
                format!("{}.{ext}", &h[..h.len().min(16)])
            }
            _ => {
                if !slug.is_empty() && slug != id.to_string() {
                    format!("{id}_{slug}.{ext}")
                } else {
                    format!("{id}.{ext}")
                }
            }
        };
        format!("originals/{plate}/{word}/{name}")
    }

    pub fn thumb_rel_path(&self, id: i64) -> String {
        format!("thumbs/{id}.jpg")
    }

    pub fn tmp_path(&self, name: &str) -> PathBuf {
        self.tmp_dir.join(name)
    }

    pub fn remove(&self, rel: &str) {
        if let Some(p) = self.resolve_inside(rel) {
            let _ = fs::remove_file(p);
        }
    }

    pub fn cleanup_tmp(&self) {
        let _ = fs::remove_dir_all(&self.tmp_dir);
        let _ = fs::create_dir_all(&self.tmp_dir);
    }
}

fn normalize(p: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for comp in p.components() {
        match comp {
            std::path::Component::ParentDir => {
                out.pop();
            }
            std::path::Component::CurDir => {}
            other => out.push(other.as_os_str()),
        }
    }
    out
}

/// 去掉文件名里的非法字符，保留中文
pub fn safe_segment(input: &str) -> String {
    let mut s = String::with_capacity(input.len());
    for ch in input.chars() {
        if matches!(ch, '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|') || (ch as u32) < 0x20 {
            s.push('_');
        } else {
            s.push(ch);
        }
    }
    let trimmed = s.trim_end_matches(['.', ' ']).to_string();
    trimmed.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// 由标题 / 标签拼出文件名片段
pub fn build_slug(parts: &[Option<&str>]) -> String {
    let joined = parts
        .iter()
        .flatten()
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    let stripped: String = joined
        .chars()
        .filter(|c| !matches!(c, '[' | ']' | '（' | '）' | '(' | ')'))
        .collect();
    let mut out = String::new();
    let mut last_dash = false;
    for ch in stripped.chars() {
        if ch == '-' {
            if last_dash {
                continue;
            }
            last_dash = true;
        } else {
            last_dash = false;
        }
        out.push(ch);
    }
    out
}

pub fn ext_of(path: &str) -> String {
    path.rsplit_once('.')
        .map(|(_, e)| e.to_lowercase())
        .filter(|e| e.len() <= 5 && !e.contains('/'))
        .unwrap_or_default()
}
