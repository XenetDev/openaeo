#!/bin/sh
set -eu

main() {
	base="${OPENAEO_BASE_URL:-https://github.com/xenetdev/openaeo/releases/latest/download}"
	dir="${OPENAEO_INSTALL_DIR:-$HOME/.local/bin}"

	os="$(uname -s)"
	arch="$(uname -m)"
	case "$os" in
		Darwin) os="darwin" ;;
		Linux) os="linux" ;;
		*) fail "OpenAEO supports macOS and Linux. This looks like $os." ;;
	esac
	case "$arch" in
		arm64 | aarch64) arch="arm64" ;;
		x86_64 | amd64) arch="x64" ;;
		*) fail "OpenAEO does not have a build for $arch processors yet." ;;
	esac

	command -v curl >/dev/null 2>&1 || fail "curl is needed to install OpenAEO."
	command -v tar >/dev/null 2>&1 || fail "tar is needed to install OpenAEO."

	name="openaeo-$os-$arch"
	tmp="$(mktemp -d)"
	trap 'rm -rf "$tmp"' EXIT INT TERM

	say "Downloading OpenAEO for $os $arch"
	curl -fsSL "$base/$name.tar.gz" -o "$tmp/$name.tar.gz" || fail "Could not download $base/$name.tar.gz"
	curl -fsSL "$base/checksums.txt" -o "$tmp/checksums.txt" || fail "Could not download the checksum list."

	expected="$(awk -v f="$name.tar.gz" '$2 == f { print $1 }' "$tmp/checksums.txt")"
	[ -n "$expected" ] || fail "The checksum list has no entry for $name.tar.gz."
	if command -v sha256sum >/dev/null 2>&1; then
		actual="$(sha256sum "$tmp/$name.tar.gz" | awk '{ print $1 }')"
	elif command -v shasum >/dev/null 2>&1; then
		actual="$(shasum -a 256 "$tmp/$name.tar.gz" | awk '{ print $1 }')"
	else
		fail "sha256sum or shasum is needed to verify the download."
	fi
	[ "$expected" = "$actual" ] || fail "The download did not match its checksum, so nothing was installed. Try again."

	tar -xzf "$tmp/$name.tar.gz" -C "$tmp"
	[ -f "$tmp/$name" ] || fail "The download did not contain the OpenAEO program."
	mkdir -p "$dir"
	chmod 755 "$tmp/$name"
	mv -f "$tmp/$name" "$dir/openaeo"

	say "Installed to $dir/openaeo"
	case ":$PATH:" in
		*":$dir:"*) say "Run: openaeo" ;;
		*)
			say "Add this folder to your PATH, then run openaeo:"
			say "  export PATH=\"$dir:\$PATH\""
			;;
	esac
}

say() { printf '%s\n' "$*"; }

fail() {
	printf 'OpenAEO install failed: %s\n' "$*" >&2
	exit 1
}

main "$@"
