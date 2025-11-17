#!/bin/bash

# PostgreSQL 18 Uninstall Script for macOS
# Run with: sudo ./uninstall-postgresql18.sh

set -e

echo "Stopping PostgreSQL 18 service..."
sudo launchctl stop postgresql-18 2>/dev/null || echo "Service already stopped or not running"

echo "Unloading launchd service..."
sudo launchctl unload /Library/LaunchDaemons/postgresql-18.plist 2>/dev/null || echo "Service already unloaded"

echo "Removing launchd service file..."
sudo rm -f /Library/LaunchDaemons/postgresql-18.plist

echo "Removing PostgreSQL 18 installation directory..."
sudo rm -rf /Library/PostgreSQL/18

echo "Removing PgBouncer (if exists)..."
sudo rm -rf /Library/PgBouncer 2>/dev/null || echo "PgBouncer not found"

echo ""
echo "PostgreSQL 18 has been uninstalled."
echo ""
echo "Note: The 'postgres' user account still exists."
echo "To remove it, run: sudo dscl . -delete /Users/postgres"
echo ""
echo "You may also want to remove PostgreSQL from your PATH."
echo "Check these files for PostgreSQL references:"
echo "  - ~/.zshrc"
echo "  - ~/.bash_profile"
echo "  - ~/.bashrc"

