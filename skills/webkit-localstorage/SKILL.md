---
name: webkit-localstorage
description: Inspect and modify WebKit localStorage databases on macOS. List apps, read/write/delete keys, dump entire databases for testing and debugging. Safe with dry-run and app-running checks.
allowed-tools:
  - Bash(scripts/webkit-localstorage.sh:*)
  - Read
---

# WebKit localStorage Manipulation

Inspect and modify WebKit-based browser databases on macOS for testing and debugging.

## Quick Start

**List all apps with stored data:**
```bash
bash scripts/webkit-localstorage.sh list-apps
```

**Delete a specific key:**
```bash
bash scripts/webkit-localstorage.sh delete "com.grammarly.web-client" "myStorageKey"
```

**Get a key's value:**
```bash
bash scripts/webkit-localstorage.sh get "com.superhuman.web-client" "some_key"
```

**Dump all keys from an app:**
```bash
bash scripts/webkit-localstorage.sh dump "com.grammarly.web-client"
```

**Check if app is running before touching its data:**
```bash
bash scripts/webkit-localstorage.sh is-running "com.superhuman.web-client" && echo "App is running"
```

## Storage Architecture

### Bundle IDs
WKWebView-based apps on macOS store localStorage under:
```
~/Library/WebKit/<bundle-id>/WebsiteData/
```

Common bundle IDs:
- `com.superhuman.web-client` (Superhuman web app)
- `com.superhuman.Hub` (Superhuman Core Service)
- `com.grammarly.web-client` (Grammarly web app)
- `com.grammarly.inkwell-poc` (Inkwell prototype)
- `com.grammarly.GRLlamaOnboarding` (Grammarly Onboarding)

To find your app's bundle ID:
```bash
# Via App Store (look for CFBundleIdentifier in Info.plist)
mdls -name kMDItemCFBundleIdentifier /Applications/YourApp.app

# Or check what's in ~/Library/WebKit/
ls ~/Library/WebKit/
```

### Database Structure

localStorage lives in SQLite 3 databases under multiple locations per app:

```
~/Library/WebKit/<bundle-id>/WebsiteData/
├── LocalStorage/
│   └── localstorage.sqlite3             # Root domain data (older apps)
└── Default/<origin-hash>/<origin-hash>/LocalStorage/
    └── localstorage.sqlite3             # Per-origin databases (newer apps)
```

When you store data in a web app, the database records it in the `ItemTable` with `(key, value)` pairs.

### WAL (Write-Ahead Logging)

Modern SQLite uses WAL files (`*.sqlite3-wal`, `*.sqlite3-shm`) for crash resilience. Key points:

1. **App must be quit first.** If the app is running when you modify the DB, its in-memory cache will overwrite your changes on exit.
2. **WAL checkpoint after writes.** The script automatically runs `PRAGMA wal_checkpoint(TRUNCATE)` to force the WAL journal into the main DB file.
3. **Check running processes:** The script warns if the target app is still running.

## Examples

### Reset onboarding state (Grammarly/Superhuman)

```bash
# Find the key name first
bash scripts/webkit-localstorage.sh dump "com.grammarly.web-client" | grep onboarding

# Delete it
bash scripts/webkit-localstorage.sh delete "com.grammarly.web-client" "aaa_onboarding_state"
```

### Test a new feature by resetting feature flags

```bash
# Dump current state
bash scripts/webkit-localstorage.sh dump "com.superhuman.web-client"

# Delete a feature flag
bash scripts/webkit-localstorage.sh delete "com.superhuman.web-client" "my_feature_flag"

# Set a new test value
bash scripts/webkit-localstorage.sh set "com.superhuman.web-client" "my_feature_flag" "test_value"
```

### Backup and restore

```bash
# Backup all data from an app
bash scripts/webkit-localstorage.sh dump "com.grammarly.web-client" > backup.json

# (Later) restore manually by editing the data and using 'set'
bash scripts/webkit-localstorage.sh set "com.grammarly.web-client" "key_name" "value"
```

### Dry-run before deletion

```bash
# See what would be deleted without actually deleting
bash scripts/webkit-localstorage.sh get "com.grammarly.web-client" "aaa_onboarding_state"

# Only delete if you're confident
bash scripts/webkit-localstorage.sh delete "com.grammarly.web-client" "aaa_onboarding_state"
```

## Limitations

- **localStorage only** — does not cover Cookies, IndexedDB, Session Storage, or Cache Storage
- **macOS only** — uses ~/Library/WebKit paths specific to macOS
- **SQLite 3 required** — assumes `sqlite3` CLI is in $PATH
- **Tauri/WKWebView only** — works with any WKWebView-based app but not Chromium-based clients
- **Single key per operation** — script handles one key at a time (not bulk ops)

## Troubleshooting

### "database is locked"
App is still running. Quit it fully before retrying.

### "No such table: ItemTable"
Some apps use different table structures or don't use localStorage. Dump the database to see what's actually stored.

### Changes don't persist after restart
You quit the app after modifying, but didn't checkpoint. The script does this automatically, but if you used raw `sqlite3` CLI, run:
```bash
sqlite3 ~/Library/WebKit/<bundle-id>/WebsiteData/Default/*/*/LocalStorage/localstorage.sqlite3 "PRAGMA wal_checkpoint(TRUNCATE);"
```

### Find all LocalStorage databases
```bash
find ~/Library/WebKit -name "localstorage.sqlite3" 2>/dev/null
```

## Related

- **Cookies:** Check `~/Library/WebKit/<bundle-id>/WebsiteData/Cookies/Cookies.sqlite3`
- **IndexedDB:** Look in `~/Library/WebKit/<bundle-id>/WebsiteData/Default/*/IndexedDB/`
- **Cache Storage:** Check `~/Library/WebKit/<bundle-id>/WebsiteData/Default/*/Cache Storage/`
