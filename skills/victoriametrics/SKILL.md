---
name: victoriametrics
description: Query Grammarly VictoriaMetrics via the victoriametrics MCP server using mcporter. Use when investigating metrics, PromQL/MetricsQL, Grafana data, or Nx cache metrics such as nx_task_duration_seconds and nx_run_wall_time_seconds.
---

# VictoriaMetrics via mcporter

Use the configured MCP server through `mcporter` for VictoriaMetrics queries.

## Prerequisites

The server is configured in Claude user MCP config as:

```bash
claude mcp add --transport http victoriametrics \
  https://apigw.prod-platform-plane.grammarlyaws.com/vm-mcp-server/mcp \
  -s user
```

`mcporter` is installed globally, so prefer `mcporter` over `npx --yes mcporter`.

## Core commands

Instant query:

```bash
mcporter call victoriametrics.query \
  query='count(nx_task_duration_seconds)'
```

Range query:

```bash
mcporter call victoriametrics.query_range \
  start='2026-07-07T00:00:00Z' \
  end='2026-07-07T12:00:00Z' \
  step='15m' \
  query='sum by (cache_status)(count_over_time(nx_task_duration_seconds[1h]))'
```

List matching metric names:

```bash
mcporter call victoriametrics.metrics \
  match='{__name__=~"nx_.*"}' \
  limit=50
```

List labels for a metric:

```bash
mcporter call victoriametrics.labels \
  match='nx_task_duration_seconds'
```

List values for a label:

```bash
mcporter call victoriametrics.label_values \
  label_name='cache_status' \
  match='nx_task_duration_seconds'
```

If a named server lookup fails, fall back to the URL selector:

```bash
mcporter call 'https://apigw.prod-platform-plane.grammarlyaws.com/vm-mcp-server/mcp.query' \
  query='count(nx_task_duration_seconds)'
```

## Nx cache metrics

Known metrics emitted by `.ci/scripts/report-nx-metrics.mjs`:

- `nx_task_duration_seconds` — per-task duration sample with labels:
  - `target`
  - `project`
  - `cache_status` (`cache-miss`, `local-cache-hit`, `remote-cache-hit`)
  - `cacheable`
  - `task_status`
  - CI labels: `ci_provider`, `ci_job`, `ci_branch`, `ci_pipeline_id`, `env`
- `nx_run_wall_time_seconds` — one sample per Nx invocation
- `nx_run_skip_remote_cache` — 1 when remote cache was intentionally skipped, otherwise 0

Important caveat: `nx_task_duration_seconds` is emitted as raw gauge samples, not Prometheus histogram buckets. Do not use `histogram_quantile(... nx_task_duration_seconds_bucket ...)` unless the reporter has been changed to emit buckets. Use `count_over_time`, `sum_over_time`, averages, ratios, and top-k queries instead.

### Useful Nx queries

7-day task volume by cache status:

```promql
sum by (cache_status)(count_over_time(nx_task_duration_seconds[7d]))
```

7-day cache hit ratio:

```promql
sum(count_over_time(nx_task_duration_seconds{cache_status=~"(local|remote)-cache-hit"}[7d]))
/
sum(count_over_time(nx_task_duration_seconds[7d]))
```

Average task duration by cache status over 7d:

```promql
sum by (cache_status)(sum_over_time(nx_task_duration_seconds[7d]))
/
sum by (cache_status)(count_over_time(nx_task_duration_seconds[7d]))
```

Top targets by cache misses over 7d:

```promql
topk(10, sum by (target)(count_over_time(nx_task_duration_seconds{cache_status="cache-miss"}[7d])))
```

Top targets by time spent in cache misses over 7d:

```promql
topk(10, sum by (target)(sum_over_time(nx_task_duration_seconds{cache_status="cache-miss"}[7d])))
```

Cache hit ratio by CI job over 7d:

```promql
sum by (ci_job)(count_over_time(nx_task_duration_seconds{cache_status=~"(local|remote)-cache-hit"}[7d]))
/
sum by (ci_job)(count_over_time(nx_task_duration_seconds[7d]))
```

Average Nx run wall time by CI job over 7d:

```promql
sum by (ci_job)(sum_over_time(nx_run_wall_time_seconds[7d]))
/
sum by (ci_job)(count_over_time(nx_run_wall_time_seconds[7d]))
```

## Output handling

- Prefer `--json` only for `mcporter list`; `mcporter call` already returns JSON.
- Pipe through `jq` or `python3 -m json.tool` for readability when needed.
- Avoid very broad raw series queries; use aggregations (`sum by`, `topk`, `count_over_time`) to keep output small.
