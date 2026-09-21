#!/usr/bin/env bash
#
# webkit-localstorage.sh
#
# Inspect and manipulate WebKit localStorage databases on macOS.
# Usage: webkit-localstorage.sh <command> [args...]
#
# Commands:
#   list-apps                                 List all bundle IDs with localStorage data
#   dump <bundle-id>                          Dump all keys/values from an app
#   get <bundle-id> <key>                     Get a specific key's value
#   set <bundle-id> <key> <value>             Set a key to a JSON value
#   delete <bundle-id> <key>                  Delete a key
#   is-running <bundle-id>                    Check if app process is running (exit 0 if yes)
#   clear-all <bundle-id>                     Clear all keys from an app's localStorage

set -euo pipefail

WEBKIT_DIR="${HOME}/Library/WebKit"

die() {
  echo "Error: $*" >&2
  exit 1
}

warn() {
  echo "Warning: $*" >&2
}

info() {
  echo "Info: $*" >&2
}

# Find all localstorage.sqlite3 files for a given bundle ID
find_databases() {
  local bundle_id="$1"
  find "${WEBKIT_DIR}/${bundle_id}/WebsiteData" -name "localstorage.sqlite3" 2>/dev/null || true
}

# Check if any database files exist for this bundle ID
has_databases() {
  local bundle_id="$1"
  [ -n "$(find_databases "$bundle_id")" ]
}

# Check if an app (or its process name substring) is currently running
is_app_running() {
  local bundle_id="$1"
  # Extract the main app name from bundle ID (e.g., com.grammarly.web-client -> grammarly)
  local search_term="${bundle_id##*.}"
  pgrep -fiq "$search_term" 2>/dev/null || return 1
}

# Escape a string for SQLite WHERE clause (simple quote doubling)
sql_escape() {
  local str="$1"
  # Replace single quotes with double single quotes for SQL string literals
  printf '%s\n' "${str//\'/\'\'}"
}

# Check if a table exists in a database
table_exists() {
  local db="$1"
  local table="$2"
  sqlite3 "$db" "SELECT name FROM sqlite_master WHERE type='table' AND name='$table';" 2>/dev/null | grep -q "$table"
}

cmd_list_apps() {
  local found=0
  for app_dir in "${WEBKIT_DIR}"/*; do
    [ -d "$app_dir" ] || continue
    local bundle_id="$(basename "$app_dir")"
    if has_databases "$bundle_id"; then
      echo "$bundle_id"
      found=$((found + 1))
    fi
  done
  [ "$found" -gt 0 ] || warn "No WebKit localStorage data found"
}

cmd_dump() {
  local bundle_id="$1"
  [ -n "$bundle_id" ] || die "Usage: dump <bundle-id>"

  local databases
  databases=$(find_databases "$bundle_id")
  [ -n "$databases" ] || die "No localStorage databases found for bundle ID: $bundle_id"

  info "Dumping all keys from $bundle_id:"

  local total_found=0
  while IFS= read -r db; do
    [ -f "$db" ] || continue

    # Check if ItemTable exists
    if ! table_exists "$db" ItemTable; then
      warn "No ItemTable in: $db (might use different schema)"
      continue
    fi

    info "  Database: $db"

    # Query all rows from ItemTable, format as JSON-like key=value pairs
    sqlite3 "$db" <<EOSQL
SELECT key, value FROM ItemTable ORDER BY key;
EOSQL
    total_found=$((total_found + 1))
  done <<< "$databases"

  [ "$total_found" -gt 0 ] || warn "No data found in ItemTable"
}

cmd_get() {
  local bundle_id="$1"
  local key="$2"
  [ -n "$bundle_id" ] || die "Usage: get <bundle-id> <key>"
  [ -n "$key" ] || die "Usage: get <bundle-id> <key>"

  local databases
  databases=$(find_databases "$bundle_id")
  [ -n "$databases" ] || die "No localStorage databases found for bundle ID: $bundle_id"

  local key_escaped
  key_escaped=$(sql_escape "$key")

  while IFS= read -r db; do
    [ -f "$db" ] || continue

    if ! table_exists "$db" ItemTable; then
      continue
    fi

    # Try to find the key in this database
    local value
    value=$(sqlite3 "$db" "SELECT value FROM ItemTable WHERE key='$key_escaped';" 2>/dev/null)
    if [ -n "$value" ]; then
      echo "$value"
      return 0
    fi
  done <<< "$databases"

  warn "Key '$key' not found in any database for $bundle_id"
  return 1
}

cmd_set() {
  local bundle_id="$1"
  local key="$2"
  local value="$3"
  [ -n "$bundle_id" ] || die "Usage: set <bundle-id> <key> <value>"
  [ -n "$key" ] || die "Usage: set <bundle-id> <key> <value>"
  [ -n "$value" ] || die "Usage: set <bundle-id> <key> <value>"

  if is_app_running "$bundle_id"; then
    warn "App is currently running. Quit it first or your changes may be lost."
  fi

  local databases
  databases=$(find_databases "$bundle_id")
  [ -n "$databases" ] || die "No localStorage databases found for bundle ID: $bundle_id"

  # Use the first database found
  local db
  db=$(echo "$databases" | head -n1)
  [ -f "$db" ] || die "Database file not found: $db"

  if ! table_exists "$db" ItemTable; then
    die "No ItemTable found in $db (incompatible database structure)"
  fi

  local key_escaped value_escaped
  key_escaped=$(sql_escape "$key")
  value_escaped=$(sql_escape "$value")

  info "Setting key='$key' in $db"

  # Use INSERT OR REPLACE to either insert or update
  sqlite3 "$db" <<EOSQL
INSERT OR REPLACE INTO ItemTable (key, value) VALUES ('$key_escaped', '$value_escaped');
PRAGMA wal_checkpoint(TRUNCATE);
EOSQL

  info "Successfully set $key (checkpoint committed)"
}

cmd_delete() {
  local bundle_id="$1"
  local key="$2"
  [ -n "$bundle_id" ] || die "Usage: delete <bundle-id> <key>"
  [ -n "$key" ] || die "Usage: delete <bundle-id> <key>"

  if is_app_running "$bundle_id"; then
    warn "App is currently running. Quit it first or your changes may be lost."
  fi

  local databases
  databases=$(find_databases "$bundle_id")
  [ -n "$databases" ] || die "No localStorage databases found for bundle ID: $bundle_id"

  local key_escaped
  key_escaped=$(sql_escape "$key")

  local deleted=0
  while IFS= read -r db; do
    [ -f "$db" ] || continue

    if ! table_exists "$db" ItemTable; then
      continue
    fi

    # Check if the key exists in this database
    local count
    count=$(sqlite3 "$db" "SELECT count(*) FROM ItemTable WHERE key='$key_escaped';" 2>/dev/null)

    if [ "$count" -gt 0 ]; then
      info "Deleting key='$key' from $db"
      sqlite3 "$db" <<EOSQL
DELETE FROM ItemTable WHERE key='$key_escaped';
PRAGMA wal_checkpoint(TRUNCATE);
EOSQL
      deleted=$((deleted + 1))
    fi
  done <<< "$databases"

  if [ "$deleted" -eq 0 ]; then
    warn "Key '$key' not found in any database for $bundle_id"
    return 1
  else
    info "Deleted from $deleted database file(s)"
  fi
}

cmd_clear_all() {
  local bundle_id="$1"
  [ -n "$bundle_id" ] || die "Usage: clear-all <bundle-id>"

  if is_app_running "$bundle_id"; then
    warn "App is currently running. Quit it first or your changes may be lost."
  fi

  local databases
  databases=$(find_databases "$bundle_id")
  [ -n "$databases" ] || die "No localStorage databases found for bundle ID: $bundle_id"

  local cleared=0
  while IFS= read -r db; do
    [ -f "$db" ] || continue

    if ! table_exists "$db" ItemTable; then
      continue
    fi

    info "Clearing all keys from $db"
    sqlite3 "$db" <<EOSQL
DELETE FROM ItemTable;
PRAGMA wal_checkpoint(TRUNCATE);
EOSQL
    cleared=$((cleared + 1))
  done <<< "$databases"

  if [ "$cleared" -eq 0 ]; then
    warn "No databases found to clear for $bundle_id"
    return 1
  else
    info "Cleared $cleared database file(s)"
  fi
}

cmd_is_running() {
  local bundle_id="$1"
  [ -n "$bundle_id" ] || die "Usage: is-running <bundle-id>"

  if is_app_running "$bundle_id"; then
    info "App '$bundle_id' is running"
    return 0
  else
    info "App '$bundle_id' is not running"
    return 1
  fi
}

cmd_help() {
  cat <<EOF
webkit-localstorage.sh - Inspect and modify WebKit localStorage on macOS

Usage: $0 <command> [args...]

Commands:
  list-apps                              List all bundle IDs with localStorage
  dump <bundle-id>                       Dump all keys and values
  get <bundle-id> <key>                  Get a key's value
  set <bundle-id> <key> <value>          Set a key to a value
  delete <bundle-id> <key>               Delete a key
  clear-all <bundle-id>                  Delete all keys from an app
  is-running <bundle-id>                 Check if app is running
  help                                   Show this help message

Examples:
  # List all apps with stored data
  $0 list-apps

  # Get a value
  $0 get "com.grammarly.web-client" "my_key"

  # Delete a key
  $0 delete "com.grammarly.web-client" "aaa_onboarding_state"

  # Set a value
  $0 set "com.superhuman.web-client" "feature_flag" "enabled"

  # Clear everything from an app
  $0 clear-all "com.grammarly.web-client"

For details, see the skill documentation in SKILL.md
EOF
}

main() {
  local cmd="${1:-help}"

  case "$cmd" in
    list-apps)
      cmd_list_apps
      ;;
    dump)
      cmd_dump "${2:-}"
      ;;
    get)
      cmd_get "${2:-}" "${3:-}"
      ;;
    set)
      cmd_set "${2:-}" "${3:-}" "${4:-}"
      ;;
    delete)
      cmd_delete "${2:-}" "${3:-}"
      ;;
    clear-all)
      cmd_clear_all "${2:-}"
      ;;
    is-running)
      cmd_is_running "${2:-}"
      ;;
    help|--help|-h)
      cmd_help
      ;;
    *)
      die "Unknown command: $cmd (try 'help')"
      ;;
  esac
}

main "$@"
