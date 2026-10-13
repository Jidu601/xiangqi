#!/usr/bin/env bash
set -euo pipefail
# Requires an existing jidu personal-web deployment. Never removes containers or volumes.
cd /srv/xiangqi
test -f public/cover.jpg
test -f /srv/personal-web/compose.yaml
docker inspect jidu-web-1 jidu-caddy-1 >/dev/null
network=$(docker inspect jidu-web-1 --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' | head -n 1)
docker inspect jidu-caddy-1 --format '{{json .NetworkSettings.Networks}}' | grep -F '"'"$network"'"' >/dev/null
export XIANGQI_GATEWAY_NETWORK="$network"
caddyfile=$(docker inspect jidu-caddy-1 --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}')
test -f "$caddyfile"
grep -q 'forward_auth' "$caddyfile"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="$caddyfile.xiangqi-backup-$stamp"
cp -p "$caddyfile" "$backup"
docker compose -p jidu -f deploy/compose.xiangqi.yaml up -d --build xiangqi
for attempt in {1..30}; do
  health=$(docker inspect jidu-xiangqi-1 --format '{{.State.Health.Status}}')
  if [ "$health" = healthy ]; then break; fi
  sleep 2
done
test "$health" = healthy
# Verify the service from the same network that Caddy uses.
docker exec jidu-web-1 node -e "fetch('http://xiangqi:3188/health').then(async r=>{if(!r.ok)throw Error(r.status);console.log(await r.text())}).catch(e=>{console.error(e.message);process.exit(1)})"
candidate="$caddyfile.xiangqi-candidate-$stamp"
python3 - "$caddyfile" "$candidate" <<'PY'
import sys
source=open(sys.argv[1]).read()
marker='        # chuhe-qimou route\n'
if '/games/xiangqi/' in source:
    if marker not in source or source.count('handle_path /games/xiangqi/*') != 1 or 'reverse_proxy xiangqi:3188' not in source:
        raise SystemExit('Unknown Xiangqi route already exists; inspect before changing configuration')
    open(sys.argv[2],'w').write(source)
    raise SystemExit(0)
anchor='        handle {\n'
if source.count(anchor)!=1:
    raise SystemExit('Unknown gateway structure; refusing automatic patch')
route=marker+'''        redir /games/xiangqi /games/xiangqi/ 308
        handle_path /games/xiangqi/* {
            reverse_proxy xiangqi:3188
        }
'''
if source.find('forward_auth')>source.find(anchor):
    raise SystemExit('Authentication must precede game route')
open(sys.argv[2],'w').write(source.replace(anchor,route+anchor,1))
PY
docker cp "$candidate" jidu-caddy-1:/tmp/xiangqi-candidate
docker exec jidu-caddy-1 caddy validate --config /tmp/xiangqi-candidate --adapter caddyfile
# Write to the mounted file's existing inode; preserve bind mount behavior.
cat "$candidate" > "$caddyfile"
if ! docker exec jidu-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
  cat "$backup" > "$caddyfile"
  docker exec jidu-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
  exit 1
fi
docker exec -i -w /app jidu-web-1 node --input-type=module < deploy/add-project.mjs
printf 'Game deployed; homepage card added. Caddy backup: %s\n' "$backup"
printf 'Verify unauthenticated redirect, authenticated gameplay, cover and homepage card before declaring completion.\n'
