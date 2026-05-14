use std::fs;
use std::path::{Path, PathBuf};

fn copy_dir_all(src: &Path, dst: &Path) {
    fs::create_dir_all(dst).ok();
    if let Ok(entries) = fs::read_dir(src) {
        for entry in entries.flatten() {
            let dst_path = dst.join(entry.file_name());
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                copy_dir_all(&entry.path(), &dst_path);
            } else {
                fs::copy(entry.path(), &dst_path).ok();
            }
        }
    }
}

fn main() {
    // Volver a copiar _internal/ solo si cambia (evita copias innecesarias)
    println!("cargo:rerun-if-changed=binaries/_internal");

    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let profile      = std::env::var("PROFILE").unwrap_or_else(|_| "debug".to_string());

    let internal_src = PathBuf::from(&manifest_dir).join("binaries").join("_internal");
    let internal_dst = PathBuf::from(&manifest_dir)
        .join("target")
        .join(&profile)
        .join("_internal");

    if internal_src.exists() {
        copy_dir_all(&internal_src, &internal_dst);
    }

    tauri_build::build()
}
