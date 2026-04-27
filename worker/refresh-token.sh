#!/usr/bin/env bash
# Square OAuth トークン自動リフレッシュ
# crontab: */45 * * * * /Users/nk/dev/vscode-mcp/.vscode/カンボジア花火2026/worker/refresh-token.sh >> /tmp/hanabi-token-refresh.log 2>&1

set -e
source ~/.claude/.env

TOKEN_FILE="$HOME/.mcp-auth/mcp-remote-0.1.37/8ad55d0c65e075419fde9de78437d533_tokens.json"
CLIENT_ID="ybWR8VHLW1ohjcXu"
TOKEN_ENDPOINT="https://mcp.squareup.com/token"

REFRESH_TOKEN=$(python3 -c "import json; d=json.load(open('$TOKEN_FILE')); print(d['refresh_token'])")

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Refreshing Square token..."

RESPONSE=$(curl -s -X POST "$TOKEN_ENDPOINT" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token&refresh_token=${REFRESH_TOKEN}&client_id=${CLIENT_ID}")

ACCESS_TOKEN=$(python3 -c "import json,sys; d=json.loads('$RESPONSE'); print(d.get('access_token',''))" 2>/dev/null || echo "")

if [ -z "$ACCESS_TOKEN" ]; then
  echo "[ERROR] Token refresh failed: $RESPONSE"
  exit 1
fi

# Save to cache
python3 << PYEOF
import json
with open('$TOKEN_FILE', 'w') as f:
    json.dump(json.loads(r"""$RESPONSE"""), f, indent=2)
PYEOF

# Update Cloudflare Worker secret
curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/hanabi2026-dashboard/secrets" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"SQUARE_ACCESS_TOKEN\",\"text\":\"${ACCESS_TOKEN}\",\"type\":\"secret_text\"}" \
  > /dev/null

NEW_REFRESH=$(python3 -c "import json; print(json.loads(r'$RESPONSE').get('refresh_token',''))" 2>/dev/null || echo "")
if [ -n "$NEW_REFRESH" ]; then
  curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/hanabi2026-dashboard/secrets" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"SQUARE_REFRESH_TOKEN\",\"text\":\"${NEW_REFRESH}\",\"type\":\"secret_text\"}" \
    > /dev/null
fi

echo "[OK] Token refreshed: ${ACCESS_TOKEN:0:30}..."
