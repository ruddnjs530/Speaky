#!/bin/bash
set -e

# EC2 Initial Setup Script for Speaky Project
# Installs: Docker, Docker Compose, Git, Tailscale

echo "🚀 Starting EC2 Setup..."

# 1. System Update
echo "📦 Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y

# 2. Install Docker
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "✅ Docker installed. (Please re-login to apply group changes)"
else
    echo "✅ Docker already installed."
fi

# 3. Install Git
if ! command -v git &> /dev/null; then
    echo "🐙 Installing Git..."
    sudo apt-get install -y git
else
    echo "✅ Git already installed."
fi

# 4. Install Tailscale
if ! command -v tailscale &> /dev/null; then
    echo "🔗 Installing Tailscale..."
    curl -fsSL https://tailscale.com/install.sh | sh
else
    echo "✅ Tailscale already installed."
fi

# 5. Final Instructions
echo "
🎉 Setup Complete!

Next Steps:
1. Re-login to apply Docker group changes:
   $ exit
   (Reconnect via SSH)

2. Start Tailscale and login:
   $ sudo tailscale up

3. Clone the repository (if not done yet):
   $ git clone https://github.com/Start-S14/S14P11B103.git
   $ cd S14P11B103

4. Configure .env and Run:
   $ cp .env.example .env
   $ nano .env
   $ docker compose -f docker-compose.ec2.yml up -d --build
"
