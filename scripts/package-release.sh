#!/usr/bin/env bash
set -euo pipefail
release_tag=${1:?Usage: package-release.sh VERSION ARCH OUTPUT_DIR}
release_arch=${2:?Missing architecture}
output_dir=${3:?Missing output directory}
[[ "$release_tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?$ ]] || { echo 'Invalid version' >&2; exit 1; }
[[ "$release_arch" == amd64 || "$release_arch" == arm64 ]] || { echo 'Invalid architecture' >&2; exit 1; }
repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
mkdir -p "$output_dir"
output_dir=$(cd -- "$output_dir" && pwd)
staging_dir=$(mktemp -d)
trap 'rm -rf "$staging_dir"' EXIT
bundle_name="mailpass-$release_tag-linux-$release_arch"
bundle_dir="$staging_dir/$bundle_name"
mkdir "$bundle_dir"

sed "s/__VERSION__/$release_tag/g" "$repo_dir/deploy/compose.yml" > "$bundle_dir/compose.yml"
cp "$repo_dir/.env.example" "$repo_dir/deploy/start.sh" "$bundle_dir/"
cp "$repo_dir/deploy/README.md" "$bundle_dir/README.md"
printf '%s\n' "$release_arch" > "$bundle_dir/ARCH"
printf '%s\n' "$release_tag" > "$bundle_dir/VERSION"
chmod +x "$bundle_dir/start.sh"
docker save "mailpass-backend:$release_tag" "mailpass-frontend:$release_tag" | gzip -1 > "$bundle_dir/images.tar.gz"
tar -czf "$output_dir/$bundle_name.tar.gz" -C "$staging_dir" "$bundle_name"
cd "$output_dir"
sha256sum "$bundle_name.tar.gz" > "$bundle_name.tar.gz.sha256"
