"""Package only explicit public runtime files. Run npm run build first."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / "manifest.json").read_text())
version = manifest["version"]
assert version == json.loads((root / "package.json").read_text())["version"]
output = root / "outputs" / "release" / version
output.mkdir(parents=True, exist_ok=True)
sources = {
    "main.js": root / "outputs/obsidian-outlook-drop/main.js",
    "manifest.json": root / "manifest.json",
    "styles.css": root / "styles.css",
    "outlook-file-promises": root / "outputs/obsidian-outlook-drop/outlook-file-promises",
    "LICENSE": root / "LICENSE",
    "THIRD_PARTY_NOTICES.md": root / "THIRD_PARTY_NOTICES.md",
}
for name, source in sources.items():
    shutil.copy2(source, output / name)
archive = output / f"mail-drop-{version}-macos.zip"
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zip_file:
    for name in sources:
        zip_file.write(output / name, f"{manifest['id']}/{name}")
files = [*sources, archive.name]
checksums = "".join(f"{hashlib.sha256((output / name).read_bytes()).hexdigest()}  {name}\n" for name in files)
(output / "SHA256SUMS.txt").write_text(checksums)
print(output)
