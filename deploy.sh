#!/bin/bash
# MCP Orchestrator Deployment Script for Hetzner

set -e

echo "=== MCP Orchestrator Deployment ==="

# Update system
echo "Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

# Install Node.js 20.x
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
echo "Installing PM2..."
sudo npm install -g pm2

# Install nginx if not present
if ! command -v nginx &> /dev/null; then
    echo "Installing nginx..."
    sudo apt-get install -y nginx
fi

# Clone or update repository
REPO_URL="https://github.com/yourusername/mcp-orchestrator.git"
DEPLOY_DIR="/opt/mcp-orchestrator"

if [ -d "$DEPLOY_DIR" ]; then
    echo "Updating existing deployment..."
    cd $DEPLOY_DIR
    git pull origin main
else
    echo "Cloning repository..."
    sudo git clone $REPO_URL $DEPLOY_DIR
    cd $DEPLOY_DIR
fi

# Install dependencies
echo "Installing dependencies..."
npm install --production

# Create logs directory
mkdir -p logs

# Copy environment variables if provided
if [ -f ".env.production" ]; then
    cp .env.production .env
fi

# Start/restart with PM2
echo "Starting MCP Orchestrator with PM2..."
pm2 stop ecosystem.config.js || true
pm2 start ecosystem.config.js --env production
pm2 save

# Setup PM2 startup script
echo "Setting up PM2 startup..."
pm2 startup systemd -u $USER --hp $HOME
pm2 save

# Configure nginx (if not already configured)
NGINX_CONFIG="/etc/nginx/sites-available/mcp-orchestrator"
if [ ! -f "$NGINX_CONFIG" ]; then
    echo "Configuring nginx..."
    sudo tee $NGINX_CONFIG > /dev/null <<EOF
server {
    listen 80;
    server_name mcp.yourdomain.com;
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name mcp.yourdomain.com;
    
    # SSL certificates (replace with your paths)
    ssl_certificate /etc/letsencrypt/live/mcp.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcp.yourdomain.com/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    location /mcp {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        
        # SSE specific settings
        proxy_buffering off;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        
        # Forward headers
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    location /healthz {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
    }
}
EOF

    sudo ln -sf $NGINX_CONFIG /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl reload nginx
fi

echo "=== Deployment Complete ==="
echo ""
echo "Next steps:"
echo "1. Update mcp-config.json with your MCP servers"
echo "2. Set your API keys in mcp-config.json"
echo "3. Configure SSL certificates for your domain"
echo "4. Update nginx config with your actual domain"
echo ""
echo "Useful commands:"
echo "- pm2 status          # Check process status"
echo "- pm2 logs            # View logs"
echo "- pm2 restart all     # Restart orchestrator"
echo "- pm2 monit           # Monitor processes"