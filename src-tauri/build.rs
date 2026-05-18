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
    println!("cargo:rerun-if-changed=binaries/_internal");
    println!("cargo:rerun-if-changed=../backend/alembic/versions");

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

    // Overlay de versiones Alembic desde el código fuente sobre _internal/.
    // Permite agregar migraciones sin recompilar el sidecar PyInstaller.
    let project_root = PathBuf::from(&manifest_dir).parent().unwrap().to_path_buf();
    let versions_src = project_root.join("backend").join("alembic").join("versions");
    let versions_dst = internal_dst.join("alembic").join("versions");

    if versions_src.exists() {
        copy_dir_all(&versions_src, &versions_dst);
    }

    tauri_build::build()
}
