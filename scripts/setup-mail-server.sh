#!/usr/bin/env bash

# scripts/setup-mail-server.sh
# Automates the setup of Stalwart Mail Server, UFW ports, and Nginx reverse proxy on Ubuntu VPS.
# This script must be run as root on your VPS.

set -euo pipefail

# Output coloring
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}         Stalwart Mail Server Setup for ghufran.net             ${NC}"
echo -e "${BLUE}================================================================${NC}"

# 1. Check Root Privileges
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: This script must be run as root. Run with: sudo ./setup-mail-server.sh${NC}"
  exit 1
fi

# 2. Get Public IP Address
IP_ADDR=$(curl -s https://ifconfig.me || curl -s https://api.ipify.org || echo "YOUR_VPS_IP")
echo -e "${GREEN}[+] Public IP Address: ${IP_ADDR}${NC}"

# 3. Open Firewall Ports (UFW)
echo -e "${BLUE}[*] Configuring UFW Firewall...${NC}"
if command -v ufw >/dev/null 2>&1; then
  # Standard mail server ports
  ufw allow 25/tcp comment 'SMTP Inbound'
  ufw allow 465/tcp comment 'SMTP Secure'
  ufw allow 587/tcp comment 'SMTP Submission'
  ufw allow 993/tcp comment 'IMAP Secure'
  # Web traffic ports (for Let's Encrypt and Admin GUI proxy)
  ufw allow 80/tcp comment 'HTTP Web'
  ufw allow 443/tcp comment 'HTTPS Web'
  
  echo -e "${GREEN}[+] Firewall rules successfully updated.${NC}"
else
  echo -e "${YELLOW}[!] Warning: 'ufw' was not found. Please ensure ports 25, 465, 587, 993, 80, and 443 are open in your cloud provider's firewall dashboard.${NC}"
fi

# 4. Install Stalwart Mail Server
echo -e "${BLUE}[*] Fetching and installing Stalwart Mail Server...${NC}"
if ! command -v stalwart-mail >/dev/null 2>&1; then
  # Run the official Stalwart Mail Server interactive installer script
  curl --proto '=https' --tlsv1.2 -sSf https://raw.githubusercontent.com/stalwartlabs/mail-server/main/scripts/install.sh | sh
  
  # Enable and start the systemd service
  if systemctl list-unit-files | grep -q stalwart-mail; then
    systemctl daemon-reload
    systemctl enable stalwart-mail
    systemctl start stalwart-mail
    echo -e "${GREEN}[+] Stalwart Mail systemd service enabled and started.${NC}"
  fi
  echo -e "${GREEN}[+] Stalwart Mail Server installed successfully.${NC}"
else
  echo -e "${GREEN}[+] Stalwart Mail Server is already installed.${NC}"
fi

# 5. Configure Nginx Reverse Proxy for mail-admin.ghufran.net
NGINX_CONF="/etc/nginx/sites-available/mail-admin"
NGINX_LINK="/etc/nginx/sites-enabled/mail-admin"

echo -e "${BLUE}[*] Configuring Nginx Reverse Proxy for mail-admin.ghufran.net...${NC}"
if [ -d "/etc/nginx" ]; then
  cat << 'EOF' > "$NGINX_CONF"
server {
    listen 80;
    listen [::]:80;
    server_name mail-admin.ghufran.net;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (for live notifications/updates in Stalwart Admin)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

  # Enable the site if not already enabled
  if [ ! -f "$NGINX_LINK" ]; then
    ln -s "$NGINX_CONF" "$NGINX_LINK"
  fi

  # Test Nginx and reload
  if nginx -t; then
    systemctl reload nginx
    echo -e "${GREEN}[+] Nginx configuration loaded and reloaded.${NC}"
  else
    echo -e "${RED}[!] Error: Nginx configuration test failed. Reverting...${NC}"
    rm -f "$NGINX_LINK"
    exit 1
  fi
else
  echo -e "${YELLOW}[!] Warning: Nginx not detected. Please verify Nginx is installed on the VPS.${NC}"
fi

# 6. Let's Encrypt / Certbot Setup Recommendation
echo -e "${BLUE}================================================================${NC}"
echo -e "${GREEN}Stalwart installation and Nginx proxy setup complete!${NC}"
echo -e "${BLUE}================================================================${NC}"
echo -e ""
echo -e "${YELLOW}Next Steps on Your VPS:${NC}"
echo -e "1. Acquire SSL certificates using Certbot for your Admin GUI proxy:"
echo -e "   ${BLUE}sudo certbot --nginx -d mail-admin.ghufran.net${NC}"
echo -e ""
echo -e "2. Point Stalwart Mail Server to use your existing Let's Encrypt certificates"
echo -e "   located at: ${BLUE}/etc/letsencrypt/live/ghufran.net/...${NC} or let Stalwart"
echo -e "   automate certificate retrieval via its built-in ACME page."
echo -e ""
echo -e "3. Open a browser and visit: ${BLUE}http://mail-admin.ghufran.net${NC}"
echo -e "   (or HTTPS once Certbot is configured) to initialize the"
echo -e "   Administrator account and create ${BLUE}contact@ghufran.net${NC}."
echo -e ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${YELLOW}DNS Records to add at your DNS Registrar (Cloudflare/Namecheap):${NC}"
echo -e "----------------------------------------------------------------"
echo -e "A Record:      ${GREEN}mail${NC}  ->  ${GREEN}${IP_ADDR}${NC}"
echo -e "MX Record:     ${GREEN}@${NC}     ->  ${GREEN}10 mail.ghufran.net.${NC}"
echo -e "TXT (SPF):     ${GREEN}@${NC}     ->  ${GREEN}v=spf1 mx ip4:${IP_ADDR} ~all${NC}"
echo -e "TXT (DMARC):   ${GREEN}_dmarc${NC} ->  ${GREEN}v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc-reports@ghufran.net${NC}"
echo -e "----------------------------------------------------------------"
echo -e "Note: The DKIM TXT record can be downloaded from the Stalwart Admin Console"
echo -e "under Domains -> ghufran.net -> Keys after initializing the domain."
echo -e "${BLUE}================================================================${NC}"
