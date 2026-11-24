#!/bin/sh
set -eu
release="$1"
here="$(cd "$(dirname "$0")" && pwd)"
port=48761
work="$(mktemp -d)"
cp -R "$release" "$work/good"
python3 -m http.server "$port" --bind 127.0.0.1 --directory "$work" >/dev/null 2>&1 &
server=$!
trap 'kill $server 2>/dev/null; rm -rf "$work"' EXIT
sleep 1

run() { HOME="$work/home-$1" OPENAEO_BASE_URL="http://127.0.0.1:$port/$1" sh "$here/install.sh"; }

echo "1. good release installs and runs"
run good
"$work/home-good/.local/bin/openaeo" --version

echo "2. a corrupted archive is refused"
cp -R "$work/good" "$work/corrupt"
for f in "$work"/corrupt/*.tar.gz; do printf 'x' >> "$f"; done
if run corrupt 2>"$work/err"; then echo "FAIL: corrupted archive was installed"; exit 1; fi
grep -q "did not match its checksum" "$work/err"
[ ! -e "$work/home-corrupt/.local/bin/openaeo" ]

echo "3. a missing checksum entry is refused"
cp -R "$work/good" "$work/nosum"
: > "$work/nosum/checksums.txt"
if run nosum 2>"$work/err"; then echo "FAIL: installed without a checksum"; exit 1; fi
grep -q "no entry" "$work/err"

echo "4. a missing release is reported"
mkdir "$work/empty"
if run empty 2>"$work/err"; then echo "FAIL: installed from nothing"; exit 1; fi
grep -q "Could not download" "$work/err"

echo "ALL INSTALLER CHECKS PASSED"
