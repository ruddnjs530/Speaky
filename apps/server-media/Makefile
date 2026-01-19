# Proxy Makefile
# Delegates all commands to the Root Makefile
# Usage: make dev, make lint, make proto

ROOT_DIR := ../..

.PHONY: all
all:
	$(MAKE) -C $(ROOT_DIR) build-media

dev:
	$(MAKE) -C $(ROOT_DIR) dev-media

lint:
	$(MAKE) -C $(ROOT_DIR) lint-go

fmt:
	$(MAKE) -C $(ROOT_DIR) fmt-go

proto:
	$(MAKE) -C $(ROOT_DIR) proto

test:
	$(MAKE) -C $(ROOT_DIR) test-media

setup:
	$(MAKE) -C $(ROOT_DIR) setup-media
