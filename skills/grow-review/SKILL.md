---
name: grow-review
description: Summarize the past half-year of work into a project-based GROW review doc, mapping evidence to the IC guide (ic_guide.csv).
disable-model-invocation: true
argument-hint: "[name] [current_level] [start_date?] [end_date?]"
allowed-tools:
  # File output
  - Write
  # Glean - search internal docs
  - mcp__glean__search
  - mcp__glean__chat
  - mcp__glean__read_document
  # Coda - read-only document access
  - mcp__coda__coda_list_documents
  - mcp__coda__coda_list_pages
  - mcp__coda__coda_get_page_content
  - mcp__coda__coda_peek_page
  - mcp__coda__coda_resolve_link
  # PagerDuty - read-only incident/oncall data
  - mcp__pagerduty__get_escalation_policies
  - mcp__pagerduty__get_incidents
  - mcp__pagerduty__get_oncalls
  - mcp__pagerduty__get_schedules
  - mcp__pagerduty__list_users_oncall
  - mcp__pagerduty__get_services
  - mcp__pagerduty__get_teams
  - mcp__pagerduty__get_users
  - mcp__pagerduty__build_user_context
  # GitLab - via glab CLI
  - Bash
  # Workflow agents - read-only queries
  - mcp__workflows__ask_cortex
  - mcp__workflows__ask_github
  - mcp__workflows__ask_gitlab
  - mcp__workflows__ask_glean
  - mcp__workflows__ask_grafana
  - mcp__workflows__ask_pagerduty
  - mcp__workflows__ask_release_atlas
  - mcp__workflows__ask_sourcegraph
  - mcp__workflows__ask_sumologic
  - mcp__workflows__ask_victoriametrics
---

ultrathink

You are preparing a work summary document for the coming semi-annual GROW review.

## Inputs (arguments)
- Name: $0
- Current level: SDE $1
- Start date: $2 (optional, defaults to 6 months ago from today)
- End date: $3 (optional, defaults to today)

If name or current_level is missing, STOP and ask the user to re-run: `/grow-review <name> <current_level> [start_date] [end_date]`.

## Review window
- The review window is defined by start_date and end_date.
- If not provided: start_date = 6 months ago, end_date = today.
- Use ISO 8601 date format (YYYY-MM-DD) when querying MCPs.
- All MCP queries MUST filter results to only include items within [start_date, end_date].

## IC guide (authoritative reference)
- The IC guide is the CSV file in this skill directory: [ic_guide.csv](ic_guide.csv)
- Read and use it as the sole rubric for:
  1) identifying aspects/competencies
  2) determining the demonstrated SDE level for each aspect based on evidence

## Required tooling (MCP prerequisites)
This workflow requires these MCP integrations to be configured and working. If any non-optional MCPs are not available, STOP and output a short "Prerequisites missing" message telling the user to set them up via:
- [MCP Setup](https://coda.io/d/Coding-with-AI_dIs9Y03OBBQ/MCP-Setup_sua-hpfb#_luUtEtH2) - Internal guide for configuring MCPs
- [Awesome Claude Code](https://awesome-claude-code-70464e.gpages.io/best-practices/collections/mcp-servers/#available-mcp-servers) - Available MCP servers reference
- Or use Claude Code's `/mcp` menu or `claude mcp list` to check current configuration

Then exit without generating the summary.

Use these MCPs as follows (explicitly):
1) **Glean MCP**
   - Search across internal information sources to discover projects:
     - Slack conversations (threads, announcements, decisions)
     - Google Docs (RFCs / design docs authored or commented on)
     - Jira / Coda docs (project plans, tickets, decisions)
     - Miro diagrams created or updated

   **Glean MCP Usage Guidelines:**
   - **Use `mcp__glean__chat`** for complex questions requiring analysis, synthesis, or reasoning across multiple sources. This uses Glean's AI-powered RAG to provide contextual understanding.
   - **Use `mcp__glean__search`** for document discovery, finding files/docs/policies by keywords, and getting structured search results with snippets and metadata. Supports filters like `owner:`, `from:`, `updated:`, date ranges, and app-specific filters.
   - **Use `mcp__glean__read_document`** to retrieve full content of specific documents by URL. Use URLs from search results to get complete document text for deeper analysis.
2) **GitLab (via `glab` CLI)**
   - Discover code + infra work and review contributions using the `glab` CLI (authenticated against `gitlab.grammarly.io`).
   - Use Bash to run `glab` commands. Key commands:
     - **MRs authored:** `glab mr list --author=<username> --created-after=<start_date> --repo=<group/project>`
     - **MR details:** `glab mr view <mr_number> --repo=<group/project>`
     - **MR comments/reviews:** `glab mr view <mr_number> --comments --repo=<group/project>`
     - **API queries (reviews on others' MRs):** `glab api "projects/<project_id>/merge_requests?reviewer_username=<username>&created_after=<start_date>"`
     - **Search across projects:** `glab api "projects?search=<query>&membership=true"`
   - Evidence to gather:
     - Merge Requests authored
     - Code changes and commits
     - Review comments on others' MRs
     - Terraform changes for deploying/modifying services
     - YAML/config changes (pipelines, workflows, job configs including Databricks-related configs if present)
3) **Coda MCP** (optional)
   - Find Coda documents created/edited by the user (project docs, runbooks, plans)
4) **PagerDuty MCP** (optional)
   - Find incidents handled during oncall:
     - incidents where the user was primary/secondary/participant
     - timelines, actions taken, and outcomes
5) **Databricks MCP** (optional)
   - Find workflows/jobs created or modified:
     - job definitions, workflow graphs, schedules
     - deployments/updates, ownership, operational changes

## Evidence rule (strict)
- Only include a project if you can attach at least one concrete piece of evidence with a link/title
  (examples: MR/PR, RFC/design doc, Jira ticket, Coda doc, incident, Databricks job/workflow).
- If a “project” seems plausible but you cannot find evidence, IGNORE it (do not include it).

## What to produce
Generate a work summary document organized by PROJECTS for the review window.

Your goal:
1) List all projects the user worked on within the review window (that have evidence).
2) For each project:
   - Summarize what the user did and the impact.
   - Map the work to relevant IC guide aspects.
   - For each aspect: state the demonstrated SDE level and justify it with evidence + rubric match.

## Process
1) Collect an exhaustive evidence set from MCPs within the review window.
2) Cluster evidence into PROJECTS:
   - Merge small related items into one project when clearly the same initiative.
   - Keep major initiatives separate.
3) For each project, extract:
   - Scope/goal
   - The user’s role (owner/driver/contributor/oncall responder)
   - Concrete deliverables
   - Impact (metrics if present; otherwise observable outcomes)
4) Map each project to IC guide aspects:
   - Use the IC guide CSV to select relevant aspects.
   - For each aspect, pick the best demonstrated level supported by evidence.

## Output format (Markdown)
# GROW Work Summary (Semi-Annual)
- Name: <from $0>
- Current level: SDE <from $1>
- Review window: <start_date> to <end_date>

## Projects

For each project:

### <Project Name>
**Context / Goal**
- …

**My role**
- …

**What I did (with evidence inline)**
- <action/result> — Evidence: [Title 1](link), [Title 2](link)
- <action/result> — Evidence: [Title](link)

**Impact / Outcomes**
- …

**IC guide mapping (aspect → demonstrated level → evidence-based justification)**
- **Aspect:** <aspect name from ic_guide.csv>
  - **Demonstrated level:** SDE <N>
  - **Why this matches (rubric + evidence):**
    - Rubric signal (paraphrase from CSV): …
    - Evidence: [Title](link) — explanation of how it demonstrates the rubric
- **Aspect:** …
  - **Demonstrated level:** …
  - **Why this matches:** …

(Repeat for all projects.)

## Output delivery (REQUIRED)
After generating the complete GROW work summary:

1. **Print to terminal**: Display the full summary in the terminal for immediate review.

2. **Write to file**: Save the summary to a markdown file in the current working directory:
   - Filename format: `grow-review-<name>-<YYYY-MM-DD>.md` (use the user's name from $0, sanitized for filenames, and today's date)
   - Example: `grow-review-jane-doe-2025-01-29.md`

3. **Confirm file location**: After writing the file, output a clear message to the user:
   ```
   ✅ GROW review saved to: <absolute_file_path>
   ```

This ensures the user has both immediate visibility of the results AND a persistent file they can share, edit, or reference later.