#!/usr/bin/env bash
# Build PIE executables for the APK's native library directory.
set -euo pipefail
dest=$(realpath -m "$1")
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
export ANDROID_NDK_ROOT="${NDK_HOME:?Android NDK is required}"
export PATH="$NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin:$PATH"
cd "$work"
git clone --quiet --depth 1 --branch openssl-3.5.4 https://github.com/openssl/openssl.git ssl
(cd ssl && ./Configure android-arm64 -D__ANDROID_API__=24 no-shared no-tests --prefix="$work/prefix" --libdir=lib && make -j4 build_libs && make install_dev) >ssl-build.log 2>&1 || { tail -80 ssl-build.log; exit 1; }
git clone --quiet --depth 1 --branch n7.1.3 https://github.com/FFmpeg/FFmpeg.git ffmpeg
cd ffmpeg
export PKG_CONFIG_LIBDIR="$work/prefix/lib/pkgconfig"
./configure --enable-cross-compile --target-os=android --arch=aarch64 \
    --cc=aarch64-linux-android24-clang --cxx=aarch64-linux-android24-clang++ \
    --ar=llvm-ar --ranlib=llvm-ranlib --strip=llvm-strip --nm=llvm-nm \
    --disable-shared --enable-static --enable-pic --disable-doc --disable-debug \
    --disable-autodetect --enable-openssl --enable-version3 \
    --pkg-config-flags=--static --extra-ldflags="-pie -Wl,-z,max-page-size=16384" \
    --disable-ffplay --disable-avdevice 2>configure.err || { tail -60 ffbuild/config.log; exit 1; }
make -j4 ffmpeg ffprobe >build.log 2>&1 || { tail -80 build.log; exit 1; }
mkdir -p "$dest"
for tool in ffmpeg ffprobe; do
    llvm-strip "$tool"
    install -m755 "$tool" "$dest/libmutiny_$tool.so"
done
