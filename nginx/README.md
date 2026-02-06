# Nginx Reverse Proxy

- **conf.d/** wird als Volume gemountet (`./nginx/conf.d` → `/etc/nginx/conf.d`) – Config hier bearbeiten, danach `docker compose restart nginx`.
- **default.conf**: Proxy zu `app:3000`, Cache für `/_next/static/`, `/assets/`, Favicon.
- Eigenes **nginx.conf** (global): Datei `nginx.conf` hier anlegen und in docker-compose den auskommentierten Mount für `nginx.conf` aktivieren.
