// Files written by the app in Documents\Strafe Evolution (profile exports, share images).
// File names come from the front end, so they are checked strictly: plain names only,
// no folders, no "..", a fixed extension.
use std::fs;
use std::path::PathBuf;
use std::time::SystemTime;

const FOLDER_NAME: &str = "Strafe Evolution";
const MAX_PROFILE_BYTES: u64 = 20 * 1024 * 1024;

fn app_folder() -> Result<PathBuf, String> {
    let documents = tauri::api::path::document_dir().ok_or("Documents folder not found")?;
    let folder = documents.join(FOLDER_NAME);
    fs::create_dir_all(&folder).map_err(|e| format!("Cannot create {}: {}", folder.display(), e))?;
    Ok(folder)
}

fn checked_name(name: &str, extension: &str) -> Result<String, String> {
    let valid = !name.is_empty()
        && name.len() <= 100
        && !name.starts_with('.')
        && !name.contains("..")
        && name.ends_with(extension)
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.');
    if valid {
        Ok(name.to_string())
    } else {
        Err(format!("Invalid file name: {}", name))
    }
}

/// Writes a profile (JSON text) and returns the full path of the file.
#[tauri::command]
pub fn export_profile(file_name: String, content: String) -> Result<String, String> {
    let name = checked_name(&file_name, ".json")?;
    let path = app_folder()?.join(name);
    fs::write(&path, content).map_err(|e| format!("Cannot write {}: {}", path.display(), e))?;
    Ok(path.display().to_string())
}

/// Profile files of the app folder, newest first.
#[tauri::command]
pub fn list_profiles() -> Result<Vec<String>, String> {
    let folder = app_folder()?;
    let entries = fs::read_dir(&folder).map_err(|e| format!("Cannot read {}: {}", folder.display(), e))?;

    let mut files: Vec<(SystemTime, String)> = entries
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().to_string();
            if checked_name(&name, ".json").is_err() {
                return None;
            }
            let modified = entry.metadata().and_then(|m| m.modified()).unwrap_or(SystemTime::UNIX_EPOCH);
            Some((modified, name))
        })
        .collect();
    files.sort_by_key(|file| std::cmp::Reverse(file.0));
    Ok(files.into_iter().map(|(_, name)| name).collect())
}

/// Reads a profile file of the app folder.
#[tauri::command]
pub fn read_profile(file_name: String) -> Result<String, String> {
    let name = checked_name(&file_name, ".json")?;
    let path = app_folder()?.join(name);
    let size = fs::metadata(&path).map_err(|e| format!("Cannot open {}: {}", path.display(), e))?.len();
    if size > MAX_PROFILE_BYTES {
        return Err("Profile file is too large".to_string());
    }
    fs::read_to_string(&path).map_err(|e| format!("Cannot read {}: {}", path.display(), e))
}

/// Writes a PNG image and returns the full path of the file.
#[tauri::command]
pub fn save_image(file_name: String, bytes: Vec<u8>) -> Result<String, String> {
    let name = checked_name(&file_name, ".png")?;
    let path = app_folder()?.join(name);
    fs::write(&path, bytes).map_err(|e| format!("Cannot write {}: {}", path.display(), e))?;
    Ok(path.display().to_string())
}
