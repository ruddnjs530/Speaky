#!/bin/bash
set -e

echo "🔍 Verifying Speaky Demo Status..."

# 1. Check Port Bindings
echo "--- Service Availability ---"
for port in 5173 8080 8090 50051; do
    if netstat -tuln | grep -q ":$port "; then
        echo "✅ Port $port is active"
    else
        echo "❌ Port $port is NOT active"
    fi
done

# 2. Check Service Health
echo "--- Health Checks ---"

# AI Server (gRPC)
if docker-compose ps server-ai | grep -q "healthy"; then
    echo "✅ AI Server is HEALTHY"
else
    echo "❌ AI Server is NOT Healthy"
fi

# SC Server (HTTP)
if curl -s http://localhost:8080/h2-console > /dev/null; then
    echo "✅ SC Server (H2 Console) is reachable"
else
    echo "❌ SC Server is NOT reachable"
fi

# Media Server (HTTP)
# Since Media is gRPC, we can try to check if the port accepts connections
if nc -z localhost 8090; then
    echo "✅ Media Server gRPC port is open"
else
    echo "❌ Media Server gRPC port is CLOSED"
fi

echo "--- Verification Finished ---"
