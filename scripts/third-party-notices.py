"""Keep the licenses of every npm package actually bundled in main.js."""
from pathlib import Path
import json
root = Path(__file__).resolve().parents[1]
meta = json.loads((root / 'outputs/obsidian-outlook-drop/bundle-meta.json').read_text())
packages = {}
for name in meta['inputs']:
    if 'node_modules/' not in name:
        continue
    folder = (root / name).parent
    while folder != root:
        if (folder / 'package.json').exists():
            info = json.loads((folder / 'package.json').read_text())
            if 'name' in info:
                packages[info['name']] = (folder, info)
                break
        folder = folder.parent
parts = ['# Third-party notices\n\nThese packages are bundled in `main.js`. The plugin uses the external Obsidian API provided by Obsidian.\n']
for name, (folder, info) in sorted(packages.items()):
    licenses = sorted(path for path in folder.iterdir() if path.is_file() and path.name.lower().startswith(('license', 'licence', 'copying')))
    if not licenses:
        raise RuntimeError(f'No license file found for {name}')
    parts.append(f"\n## {name} {info['version']}\n\nLicense: {info.get('license', 'see below')}\n")
    for path in licenses:
        parts.append('\n```text\n' + path.read_text().rstrip() + '\n```\n')
(root / 'THIRD_PARTY_NOTICES.md').write_text(''.join(parts))
print(f'Preserved license files for {len(packages)} bundled packages.')
