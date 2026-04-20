#!/bin/bash
# ============================================================================
# i18n Translation Integrity Check — CI/CD Pipeline Script
# ============================================================================
# Standalone wrapper for full_audit.py that can be used in:
#   - GitHub Actions
#   - Netlify build hooks
#   - Manual CI runs
#   - Weekly scheduled checks
#
# Exit codes:
#   0 = All checks passed
#   1 = CRITICAL or MAJOR issues found (deploy should be blocked)
#   2 = Script error (audit couldn't run)
#
# Usage:
#   ./tests/i18n_integrity.sh                    # Default: run from repo root
#   ./tests/i18n_integrity.sh --json             # Output JSON results
#   ./tests/i18n_integrity.sh --strict           # Treat WARNINGs as failures too
#   ./tests/i18n_integrity.sh --json --strict    # Both flags
#
# Installed: 2026-04-19
# ============================================================================

set -uo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Parse arguments
JSON_OUTPUT=false
STRICT_MODE=false
for arg in "$@"; do
    case "$arg" in
        --json)   JSON_OUTPUT=true ;;
        --strict) STRICT_MODE=true ;;
        --help)
            echo "Usage: $0 [--json] [--strict]"
            echo "  --json    Output results in JSON format"
            echo "  --strict  Treat WARNINGs as failures (exit code 1)"
            exit 0
            ;;
    esac
done

# Find the script directory and repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Locate the audit script
AUDIT_SCRIPT="${SCRIPT_DIR}/full_audit.py"
if [ ! -f "$AUDIT_SCRIPT" ]; then
    echo -e "${RED}ERROR: full_audit.py not found at ${AUDIT_SCRIPT}${NC}" >&2
    exit 2
fi

# Verify i18n.js exists
I18N_FILE="${REPO_ROOT}/js/i18n.js"
if [ ! -f "$I18N_FILE" ]; then
    echo -e "${RED}ERROR: i18n.js not found at ${I18N_FILE}${NC}" >&2
    exit 2
fi

# Verify Python is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}ERROR: python3 not found in PATH${NC}" >&2
    exit 2
fi

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  i18n Translation Integrity Check${NC}"
echo -e "${CYAN}  Repo: ${REPO_ROOT}${NC}"
echo -e "${CYAN}  Time: $(date -u '+%Y-%m-%d %H:%M:%S UTC')${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Run the audit
AUDIT_OUTPUT=$(python3 "$AUDIT_SCRIPT" 2>&1)
AUDIT_EXIT=$?

echo "$AUDIT_OUTPUT"

# If JSON output requested, also cat the results file
if [ "$JSON_OUTPUT" = true ] && [ -f /home/ubuntu/audit_results.json ]; then
    echo ""
    echo "--- JSON RESULTS ---"
    cat /home/ubuntu/audit_results.json
fi

# In strict mode, also check for warnings
if [ "$STRICT_MODE" = true ] && [ $AUDIT_EXIT -eq 0 ]; then
    # Parse the output for warning count
    WARNING_COUNT=$(echo "$AUDIT_OUTPUT" | grep -oP '\d+ WARNING' | grep -oP '\d+' || echo "0")
    if [ "$WARNING_COUNT" -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}STRICT MODE: ${WARNING_COUNT} WARNING(s) found — treating as failure${NC}"
        exit 1
    fi
fi

# Report final result
echo ""
if [ $AUDIT_EXIT -eq 0 ]; then
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✓ i18n INTEGRITY CHECK PASSED                             ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
else
    echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ✗ i18n INTEGRITY CHECK FAILED                             ║${NC}"
    echo -e "${RED}║  Fix all CRITICAL and MAJOR issues before deploying.        ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
fi

exit $AUDIT_EXIT
