"""Apply Android-only changes to a reconstructed Mutiny Windows release tree."""
import json
from pathlib import Path
import sys

root = Path(sys.argv[1]).resolve()
def replace(path, before, after):
    target = root / path
    source = target.read_text()
    if source.count(before) != 1:
        raise ValueError(f"Unexpected source in {path}: {before}")
    target.write_text(source.replace(before, after))

# Hide Games on the first render, and keep it disabled after feature discovery.
replace("src/lib/features/install.ts", "  games: true,", "  games: false,")
replace("src-tauri/src/install_features.rs", 'games: on("games"),',
        'games: !cfg!(target_os = "android") && on("games"),')
replace("src-tauri/src/mobile.rs", "            lan_ip,",
        "            lan_ip,\n            crate::install_features::install_features,")
# Keep shared features such as the music library dock and gamepad navigation.
for runner, module in [("GameDownloadNotificationsRunner", "download-notifications-runner"),
                       ("GameSourceAlertsRunner", "source-alerts-runner")]:
    replace("src/App.tsx", f'import {{ {runner} }} from "@/lib/games/{module}";\n', "")
    replace("src/App.tsx", f"<{runner} />", "")
config_path = root / "src-tauri/tauri.android.conf.json"
config = json.loads(config_path.read_text())
window = next(w for w in config["app"]["windows"] if w["label"] == "main")
window.update(url="index.html", title="Mutiny Media")
config_path.write_text(json.dumps(config, indent=2) + "\n")
