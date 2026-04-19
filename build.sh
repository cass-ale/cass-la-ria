#!/usr/bin/env bash
# ============================================================
# Build Script — Cass la Ria
#
# Content-hash cache busting for a plain static site.
# Computes MD5 hashes of CSS/JS files, copies them with hashed
# filenames to dist/, and rewrites HTML references to match.
#
# This follows the industry-standard "immutable content + long
# max-age" pattern recommended by Jake Archibald (Chrome team):
# https://jakearchibald.com/2016/caching-best-practices/
#
# How it works:
#   1. Copies all source files to dist/
#   2. For each CSS/JS file, computes an 8-char content hash
#   3. Renames the file: styles.css → styles.a1b2c3d4.css
#   4. Rewrites all HTML references to use the hashed filename
#   5. Removes old ?v=N query strings (no longer needed)
#
# The hashed filenames guarantee that:
#   - Changed files get new URLs → browser fetches fresh copy
#   - Unchanged files keep same URL → browser uses cache (zero network)
#   - No manual version bumping required
#   - No race conditions between old HTML + new CSS/JS
#
# Reference: https://robertwpearce.com/content-hashing-static-assets-to-break-caches-with-md5sum-and-bash.html
# Reference: https://web.dev/articles/use-long-term-caching
# ============================================================

set -o errexit
set -o errtrace
set -o nounset
set -o pipefail

BUILD_DIR="./dist"

# ============================================================
# Step 1: Clean and copy everything to dist/
# ============================================================
echo "→ Cleaning build directory..."
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

# Copy all files except dist/ itself, .git, and build.sh
echo "→ Copying source files to ${BUILD_DIR}/..."
# Use find + cp to replicate rsync --exclude behavior
find . -mindepth 1 -maxdepth 1 \
  ! -name 'dist' \
  ! -name '.git' \
  ! -name 'build.sh' \
  ! -name 'README.md' \
  ! -name '.gitignore' \
  -exec cp -a {} "${BUILD_DIR}/" \;

# ============================================================
# Step 2: Hash CSS and JS files, build a mapping
# ============================================================
echo "→ Computing content hashes..."

# Associative array: original_path → hashed_path
# We use parallel arrays for bash 3 compatibility
orig_files=()
hash_files=()
orig_basenames=()
hash_basenames=()

# Find all CSS and JS files (excluding sw.js which must keep its name)
while IFS= read -r file; do
  # Get the 8-char content hash
  hash=$(md5sum "${BUILD_DIR}/${file}" | cut -c1-8)

  # Split filename
  dir=$(dirname "${file}")
  base=$(basename "${file}")
  name="${base%.*}"
  ext="${base##*.}"

  # New hashed filename
  hashed_base="${name}.${hash}.${ext}"
  hashed_file="${dir}/${hashed_base}"

  # Rename the file in dist/
  mv "${BUILD_DIR}/${file}" "${BUILD_DIR}/${hashed_file}"

  # Store the mapping for HTML rewriting
  orig_files+=("${file}")
  hash_files+=("${hashed_file}")
  orig_basenames+=("${base}")
  hash_basenames+=("${hashed_base}")

  echo "   ${file} → ${hashed_file}"
done < <(cd "${BUILD_DIR}" && find css js -type f \( -name "*.css" -o -name "*.js" \) ! -name "sw.js" | sort)

# ============================================================
# Step 3: Rewrite HTML references to use hashed filenames
# ============================================================
echo "→ Rewriting HTML references..."

for html_file in "${BUILD_DIR}"/*.html; do
  [ -f "${html_file}" ] || continue

  for i in "${!orig_basenames[@]}"; do
    orig="${orig_basenames[$i]}"
    hashed="${hash_basenames[$i]}"
    orig_path="${orig_files[$i]}"
    hashed_path="${hash_files[$i]}"

    # Replace references like: css/fonts.css?v=4 → css/fonts.a1b2c3d4.css
    # Also handles: /css/fonts.css?v=4 (with leading slash, used in 404.html)
    # The ?v=N suffix is removed since the hash replaces it
    sed -i "s|${orig_path}?v=[0-9]*|${hashed_path}|g" "${html_file}"

    # Also replace bare references without ?v= (in case any exist)
    # Use word boundary to avoid partial matches
    sed -i "s|${orig_path}\"|${hashed_path}\"|g" "${html_file}"

    # Handle absolute paths (404.html uses /css/ and /js/)
    sed -i "s|/${orig_path}?v=[0-9]*|/${hashed_path}|g" "${html_file}"
    sed -i "s|/${orig_path}\"|/${hashed_path}\"|g" "${html_file}"
  done

  echo "   Updated: $(basename "${html_file}")"
done

# ============================================================
# Step 4: Verify — no ?v= query strings should remain
# ============================================================
echo "→ Verifying no stale ?v= references remain..."
stale=$(grep -rn '\.css?v=\|\.js?v=' "${BUILD_DIR}"/*.html 2>/dev/null || true)
if [ -n "${stale}" ]; then
  echo "⚠ WARNING: Found stale ?v= references:"
  echo "${stale}"
  exit 1
else
  echo "   ✓ All references use content-hashed filenames"
fi

# ============================================================
# Step 5: Summary
# ============================================================
echo ""
echo "✓ Build complete!"
echo "  Source files: $(find . -maxdepth 1 -name '*.html' | wc -l) HTML, $(find css js -name '*.css' -o -name '*.js' 2>/dev/null | wc -l) CSS/JS"
echo "  Output: ${BUILD_DIR}/"
echo "  Hashed files: ${#orig_files[@]}"
echo ""
echo "  CSS/JS files now use content-hashed filenames."
echo "  Set Cache-Control: max-age=31536000, immutable for css/ and js/."
echo "  HTML files use max-age=0, must-revalidate (always fresh)."
