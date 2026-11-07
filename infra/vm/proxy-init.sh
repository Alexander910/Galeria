#!/bin/bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
cloud-init status --wait || true
apt-get update -qq
apt-get install -y -qq haproxy curl gnupg debian-keyring debian-archive-keyring apt-transport-https
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
apt-get update -qq
apt-get install -y -qq caddy
cat > /etc/haproxy/haproxy.cfg <<'HAPROXY'
global
    log /dev/log local0
    user haproxy
    group haproxy
    daemon
    stats socket /run/haproxy/admin.sock mode 660 level admin
defaults
    log global
    mode http
    option httplog
    timeout connect 5s
    timeout client 120s
    timeout server 120s
frontend nogal_http
    bind 127.0.0.1:8081
    default_backend nogal_apps
backend nogal_apps
    balance roundrobin
    option redispatch
    retries 2
    retry-on conn-failure empty-response response-timeout
    option httpchk
    http-check send meth GET uri /api/health ver HTTP/1.1 hdr Host localhost:8080
    http-check expect status 200
    http-response set-header X-Nogal-Backend %[srv_name]
    server app1 10.44.2.10:8080 check inter 3s fall 2 rise 2
    server app2 10.44.2.11:8080 check inter 3s fall 2 rise 2
listen local_status
    bind 127.0.0.1:8404
    stats enable
    stats uri /stats
HAPROXY
cat > /etc/caddy/Caddyfile <<'CADDY'
__PUBLIC_HOST__ {
    encode gzip
    reverse_proxy 127.0.0.1:8081
    header {
        X-Content-Type-Options nosniff
        Referrer-Policy strict-origin-when-cross-origin
    }
}
CADDY
haproxy -c -f /etc/haproxy/haproxy.cfg
caddy validate --config /etc/caddy/Caddyfile
systemctl enable --now haproxy caddy
systemctl restart haproxy caddy
