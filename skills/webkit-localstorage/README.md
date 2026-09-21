# WebKit localStorage Skill

This skill provides tools to inspect and modify WebKit-based app localStorage on macOS for testing and debugging.

## Files

- **SKILL.md** — Complete documentation with examples
- **scripts/webkit-localstorage.sh** — Main command-line tool

## Quick Setup

The script is already in place and executable. Use it by calling it relative to your working directory or via the skill's managed tool:

```bash
bash scripts/webkit-localstorage.sh list-apps
bash scripts/webkit-localstorage.sh dump "com.grammarly.web-client"
bash scripts/webkit-localstorage.sh delete "com.grammarly.web-client" "aaa_onboarding_state"
```

## Integration with pi Agent

When using this skill via the pi agent system, reference the tool as:

```
Bash(scripts/webkit-localstorage.sh:*)
```

Example usage in an agent session:

```
User: Help me reset the onboarding state for Grammarly's web client
Agent: I'll use the webkit-localstorage skill to do that.
bash scripts/webkit-localstorage.sh delete "com.grammarly.web-client" "aaa_onboarding_state"
```

See **SKILL.md** for complete documentation.
