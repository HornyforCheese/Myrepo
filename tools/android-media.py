"""Connect the original subtitle, recording and transcoding calls to packaged Android binaries."""
import sys
from pathlib import Path

root = Path(sys.argv[1])
def change(name, old, new):
    path = root / name
    text = path.read_text()
    if text.count(old) != 1:
        raise ValueError(f"Unexpected anchor in {name}: {old}")
    path.write_text(text.replace(old, new, 1))

# Android extracts native executables to a read-only executable directory.
transcode = "src-tauri/src/transcode.rs"
for binary in ["ffmpeg", "ffprobe"]:
    signature = f"pub fn locate_{binary}() -> Option<std::path::PathBuf> {{"
    change(transcode, signature, signature + f"""
    #[cfg(target_os = "android")]
    {{
        let maps = std::fs::read_to_string("/proc/self/maps").ok()?;
        let path = maps.lines().filter_map(|line| line.split_whitespace().last())
            .find(|path| path.starts_with('/') && path.ends_with("/libharbor_lib.so"))?;
        let tool = std::path::Path::new(path).parent()?.join("libmutiny_{binary}.so");
        return tool.is_file().then_some(tool);
    }}
""")
for module in ["sub_extract", "dvr"]:
    change("src-tauri/src/lib.rs", f"#[cfg(desktop)]\nmod {module};", f"mod {module};")
mobile = "src-tauri/src/mobile.rs"
change(mobile, ".manage(proxy_state)", ".manage(proxy_state)\n        .manage(crate::dvr::DvrState::new())")
change(mobile, "            lan_ip,", """            lan_ip,
            crate::sub_extract::subtitle_extract,
            crate::sub_extract::subtitle_extract_ass,
            crate::dvr::dvr_start,
            crate::dvr::dvr_stop,
            crate::dvr::dvr_list,
            crate::dvr::dvr_default_dir,""")
dvr = "src-tauri/src/dvr.rs"
change(dvr, 'let mpv_bin = locate_mpv()', '#[cfg(target_os = "android")]\n    let mpv_bin = crate::transcode::locate_ffmpeg().ok_or("FFmpeg unavailable")?;\n    #[cfg(not(target_os = "android"))]\n    let mpv_bin = locate_mpv()')
change(dvr, '    cmd.arg("--no-terminal")', '''    #[cfg(target_os = "android")]
    cmd.args(["-nostdin", "-loglevel", "error", "-rw_timeout", "60000000", "-i"])
        .arg(&args.url).args(["-map", "0:v?", "-map", "0:a?", "-c", "copy", "-f", "mpegts", "-n"])
        .arg(&output_path);
    #[cfg(not(target_os = "android"))]
    cmd.arg("--no-terminal")''')
change(dvr, 'let base = app\n', '''#[cfg(target_os = "android")]
    let base = app.path().app_data_dir().map_err(|e| e.to_string())?;
    #[cfg(not(target_os = "android"))]
    let base = app
''')
gradle = "src-tauri/gen/android/app/build.gradle.kts"
change(gradle, "android {", "android {\n    packaging { jniLibs.useLegacyPackaging = true }")
