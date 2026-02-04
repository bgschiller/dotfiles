#!/usr/bin/env bash
set -euo pipefail

# Safe wrapper for GitLab MR discussion/thread API calls
# This script is allowlisted for Claude to use since all operations are read-only

usage() {
  cat << 'EOF'
Usage: glab-mr-threads.sh <command> [args...]

Commands:
  project-id                      Get the current project's URL-encoded ID
  unresolved <mr-number>          List unresolved discussion threads
  all <mr-number>                 List all discussion threads
  thread <mr-number> <note-id>    Get a specific thread by note ID

Examples:
  glab-mr-threads.sh unresolved 1562
  glab-mr-threads.sh all 1562
  glab-mr-threads.sh thread 1562 10228905
EOF
}

get_project_id() {
  local project_path
  project_path=$(glab repo view --output json 2>/dev/null | jq -r '.path_with_namespace')
  # URL-encode the path (replace / with %2F)
  echo "${project_path//\//%2F}"
}

cmd_project_id() {
  get_project_id
}

cmd_unresolved() {
  local mr_number="${1:-}"
  if [[ -z "$mr_number" ]]; then
    echo "Error: MR number required" >&2
    echo "Usage: glab-mr-threads.sh unresolved <mr-number>" >&2
    exit 1
  fi

  local project_id
  project_id=$(get_project_id)

  # Fetch all discussions (with pagination) and filter for unresolved resolvable threads
  glab api "projects/${project_id}/merge_requests/${mr_number}/discussions?per_page=100" 2>&1 | \
    jq '[.[] | select(.notes | any(.resolvable == true and .resolved == false)) | {
      discussion_id: .id,
      notes: [.notes[] | select(.resolvable == true and .resolved == false) | {
        note_id: .id,
        author: .author.username,
        body: .body,
        file: .position.new_path,
        line: .position.new_line,
        created_at: .created_at
      }]
    }]'
}

cmd_all() {
  local mr_number="${1:-}"
  if [[ -z "$mr_number" ]]; then
    echo "Error: MR number required" >&2
    echo "Usage: glab-mr-threads.sh all <mr-number>" >&2
    exit 1
  fi

  local project_id
  project_id=$(get_project_id)

  glab api "projects/${project_id}/merge_requests/${mr_number}/discussions?per_page=100" 2>&1 | \
    jq '[.[] | {
      discussion_id: .id,
      resolvable: (.notes[0].resolvable // false),
      resolved: (.notes[0].resolved // false),
      notes: [.notes[] | {
        note_id: .id,
        author: .author.username,
        body: .body[0:200],
        file: .position.new_path,
        line: .position.new_line
      }]
    }]'
}

cmd_thread() {
  local mr_number="${1:-}"
  local note_id="${2:-}"

  if [[ -z "$mr_number" ]]; then
    echo "Error: MR number required" >&2
    echo "Usage: glab-mr-threads.sh thread <mr-number> <note-id>" >&2
    exit 1
  fi

  if [[ -z "$note_id" ]]; then
    echo "Error: Note ID required" >&2
    echo "Usage: glab-mr-threads.sh thread <mr-number> <note-id>" >&2
    exit 1
  fi

  local project_id
  project_id=$(get_project_id)

  glab api "projects/${project_id}/merge_requests/${mr_number}/discussions?per_page=100" 2>&1 | \
    jq --arg note_id "$note_id" '.[] | select(.notes[] | .id == ($note_id | tonumber)) | {
      discussion_id: .id,
      notes: [.notes[] | {
        note_id: .id,
        author: .author.username,
        body: .body,
        file: .position.new_path,
        line: .position.new_line,
        resolvable: .resolvable,
        resolved: .resolved,
        created_at: .created_at
      }]
    }'
}

# Main dispatch
main() {
  local command="${1:-}"
  shift || true

  case "$command" in
    project-id)
      cmd_project_id "$@"
      ;;
    unresolved)
      cmd_unresolved "$@"
      ;;
    all)
      cmd_all "$@"
      ;;
    thread)
      cmd_thread "$@"
      ;;
    help|--help|-h|"")
      usage
      ;;
    *)
      echo "Error: Unknown command '$command'" >&2
      usage >&2
      exit 1
      ;;
  esac
}

main "$@"
