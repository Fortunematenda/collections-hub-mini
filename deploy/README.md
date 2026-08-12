# Server deploy

Folder created on the server:

```text
/var/www/collections-hub-mini
```

## One-shot install (SSH as root)

```bash
# optional: install git first
apt-get update && apt-get install -y git curl

# clone into a temp path OR download the setup script after clone
git clone https://github.com/Fortunematenda/collections-hub-mini.git /var/www/collections-hub-mini
cd /var/www/collections-hub-mini
bash deploy/setup-server.sh
```

## After install

1. Edit secrets:

```bash
nano /var/www/collections-hub-mini/.env
```

Set at least:

- `ADMIN_PASSWORD`
- `SMTP_PASS`
- `JWT_SECRET` (script may already randomize this)
- Twilio keys when ready
- Keep `VITE_API_URL=` empty on the server (same-origin `/api`)

2. Rebuild UI if you change any `VITE_*` value:

```bash
cd /var/www/collections-hub-mini
npm run build
systemctl restart collections-hub
```

3. Check service:

```bash
systemctl status collections-hub
journalctl -u collections-hub -f
```

App listens on **port 8787**. Point Nginx/SSL at it using `deploy/nginx.example.conf`.

## Update later

```bash
cd /var/www/collections-hub-mini
git pull
npm ci
npm run build
systemctl restart collections-hub
```
