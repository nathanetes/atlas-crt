#!/bin/sh
# Builds the tape stage. Needs Rust with: rustup target add wasm32-unknown-unknown
set -e
cd "$(dirname "$0")"
RUSTFLAGS="-C target-feature=+simd128" cargo build --release --target wasm32-unknown-unknown
cp "${CARGO_TARGET_DIR:-target}/wasm32-unknown-unknown/release/atlas_vhs.wasm" ../../src/vhs.wasm
ls -la ../../src/vhs.wasm
