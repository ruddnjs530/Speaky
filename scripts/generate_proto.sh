#!/bin/bash
set -e

# Base directories
PROTO_DIR="/workspace/packages/proto"
OUT_DIR="/workspace/packages/proto/generated"

# Ensure output directories exist
mkdir -p "$OUT_DIR/go"
mkdir -p "$OUT_DIR/python"

echo "Generating Go code..."
protoc \
    --proto_path="$PROTO_DIR" \
    --go_out="$OUT_DIR/go" --go_opt=paths=source_relative \
    --go-grpc_out="$OUT_DIR/go" --go-grpc_opt=paths=source_relative \
    "$PROTO_DIR"/*.proto

echo "Generating Python code..."
python3 -m grpc_tools.protoc \
    --proto_path="$PROTO_DIR" \
    --python_out="$OUT_DIR/python" \
    --grpc_python_out="$OUT_DIR/python" \
    "$PROTO_DIR"/*.proto

# Fix python imports if necessary
# (Optional: Add __init__.py files)
touch "$OUT_DIR/python/__init__.py"

echo "✅ Proto generation complete!"
