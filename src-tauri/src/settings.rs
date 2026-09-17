/**
 * 应用设置：userData/settings.json（对应 Electron 版的 src/main/config.ts）。
 * 默认值必须与渲染层 DEFAULT_SETTINGS 对齐，否则界面首次打开会闪一下。
 */
use serde_json::{json, Value as Json};
use std::fs;
use std::path::PathBuf;

pub fn default_settings(library_root: &str) -> Json {
    json!({
        "libraryRoot": library_root,
        "preferOriginal": true,
        "listConcurrency": 2,
        "downloadConcurrency": 3,
        "delayMs": 220,
        "retries": 4,
        "thumbSize": 512,
        "theme": "dark",
        "accent": "#7c9cff",
        "naming": "id-slug",
        "proxy": "",
        "sidebarCollapsed": false,
        "sidebarWidth": 248,
        "setupCompleted": false,
        "pageSize": 60
    })
}

/** 建议的图库位置：安装版放「图片/GuguGallery」，开发态放仓库下的 data/demo */
pub fn suggested_library_root(packaged: bool) -> String {
    if !packaged {
        if let Ok(cwd) = std::env::current_dir() {
            return cwd.join("data").join("demo").to_string_lossy().to_string();
        }
    }
    let home = std::env::var("USERPROFILE").unwrap_or_default();
    format!("{home}\\Pictures\\GuguGallery")
}

pub struct SettingsStore {
    file: PathBuf,
    value: Json,
    default_root: String,
}

impl SettingsStore {
    pub fn load(file: PathBuf, default_root: &str) -> Self {
        let mut value = default_settings(default_root);
        if let Ok(text) = fs::read_to_string(&file) {
            if let Ok(saved) = serde_json::from_str::<Json>(&text) {
                merge(&mut value, &saved);
            }
        }
        let mut store = Self {
            file,
            value,
            default_root: default_root.to_string(),
        };
        // 老配置没有 setupCompleted 字段时，按「已完成」处理，别让老用户又走一遍向导
        if store.value.get("setupCompleted").is_none() {
            store.value["setupCompleted"] = json!(true);
        }
        store.value["libraryRoot"] = json!(store.library_root());
        store
    }

    pub fn get(&self) -> Json {
        self.value.clone()
    }

    pub fn library_root(&self) -> String {
        self.value
            .get("libraryRoot")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .unwrap_or_else(|| self.default_root.clone())
    }

    pub fn set(&mut self, patch: &Json) -> Json {
        merge(&mut self.value, patch);
        let _ = self.save();
        self.get()
    }

    pub fn save(&self) -> std::io::Result<()> {
        if let Some(dir) = self.file.parent() {
            let _ = fs::create_dir_all(dir);
        }
        fs::write(&self.file, serde_json::to_string_pretty(&self.value)?)
    }
}

fn merge(base: &mut Json, patch: &Json) {
    if let (Some(dst), Some(src)) = (base.as_object_mut(), patch.as_object()) {
        for (k, v) in src {
            dst.insert(k.clone(), v.clone());
        }
    }
}
