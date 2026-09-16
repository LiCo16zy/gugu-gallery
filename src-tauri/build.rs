/**
 * 构建脚本：
 *  1. 让 tauri-build 生成上下文（图标、权限清单、资源清单）
 *  2. 把 package.json 的版本号与仓库根目录路径注入成编译期常量
 *     —— 界面里显示的版本必须和发布版本一致，不能写死在 Rust 侧
 */
use std::{env, fs, path::PathBuf};

fn main() {
    let root = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap())
        .parent()
        .expect("src-tauri 应有上级目录")
        .to_path_buf();

    let pkg = fs::read_to_string(root.join("package.json")).expect("读取 package.json 失败");
    let version = pkg
        .split("\"version\": \"")
        .nth(1)
        .and_then(|rest| rest.split('"').next())
        .unwrap_or("0.0.0")
        .to_string();

    println!("cargo:rustc-env=GUGU_APP_VERSION={version}");
    println!("cargo:rerun-if-changed=../package.json");

    tauri_build::build()
}
