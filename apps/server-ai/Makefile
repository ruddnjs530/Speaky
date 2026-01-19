# Proxy Makefile
# Delegates all commands to the Root Makefile

ROOT_DIR := ../..

.PHONY: all
all:
	$(MAKE) -C $(ROOT_DIR) build-ai

dev:
	$(MAKE) -C $(ROOT_DIR) dev-ai

lint:
	$(MAKE) -C $(ROOT_DIR) lint-python

fmt:
	$(MAKE) -C $(ROOT_DIR) fmt-python

proto:
	$(MAKE) -C $(ROOT_DIR) proto

test:
	$(MAKE) -C $(ROOT_DIR) test-ai

setup:
	$(MAKE) -C $(ROOT_DIR) setup-ai
