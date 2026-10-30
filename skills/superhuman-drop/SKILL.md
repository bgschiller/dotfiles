---
name: superhuman-drop
description: Publish static HTML and supporting files to Superhuman Drop and return a temporary shareable URL. Use when explicitly invoked or when the user asks to make a shareable URL for local content.
---

# Superhuman Drop

## Prepare

- Identify the content the user wants shared. Stage only those files in a clean directory; never upload an entire repository by default. Exclude secrets, credentials, private configuration, and unrelated files. Treat the result as publicly accessible, not access-controlled storage.
- Include `index.html` at the site root: it loads by default. If sharing a document or other non-HTML file, create a small HTML landing page linking to it. Preserve relative paths for CSS, JavaScript, images, and downloads. This hosts static files, not a backend.
- Choose `lifetimeDays`: `1`, `7`, or `30`, matching the UI options. Use the user's requested lifetime if they specify one. Otherwise, choose 30 days.
- Choose `name`: 1–63 lowercase letters, digits, or hyphens, with no leading or trailing hyphen. Use a descriptive name with a short unique suffix for a new site. **Reusing a name replaces that site**; do so only when the user intends an update.
- Obtain the user's email from explicit context or ask. The UI requires a `@grammarly.com` or `@superhuman.com` address; do not invent one. You can likely the right value in a git repo, if there's one nearby.
- UI limits: 100 MB uploaded per site, 250 MB extracted, 2000 files.

## Upload

Use `POST https://apigw.pplane.qagr.io/superhuman-drop/api/sites` with `lifetimeDays`, `name`, and `email` as URL query parameters, not multipart fields. With curl 7.87.0 or newer, `--url-query` handles encoding without moving the form body into the URL.

Adapt this command to the staged files and actual values:

```bash
site_dir='/absolute/path/to/staged-site'
lifetime_days=1
site_name='report-unique-suffix'
requester_email='actual-user@superhuman.com'

curl --silent --show-error --fail-with-body \
  --request POST \
  --url 'https://apigw.pplane.qagr.io/superhuman-drop/api/sites' \
  --url-query "lifetimeDays=$lifetime_days" \
  --url-query "name=$site_name" \
  --url-query "email=$requester_email" \
  --form-string 'path=index.html' \
  --form "file=@\"$site_dir/index.html\";filename=index.html;type=text/html" \
  --form-string 'path=assets/style.css' \
  --form "file=@\"$site_dir/assets/style.css\";filename=style.css;type=text/css" \
  --output /tmp/superhuman-drop-response.json
```

For each file, send an alternating pair: `path` (the relative destination path), then `file` (its bytes). Remove the CSS pair if unused; add pairs for every required asset. Do not include the staging directory name in destination paths. Quote paths, and use `--form-string` for literal destination values. Let curl set the multipart Content-Type and boundary.

Alternatively, the UI accepts a ZIP as one `--form 'archive=@/absolute/path/site.zip'` part instead of the path/file pairs. Keep `index.html` at the archive root and include only intended site files.

## Return the link

- Check curl's exit status and read the JSON response. Success fields used by the UI are `url` and `expiresAt`; API errors use `error.code` and `error.message`. Report errors, not a guessed URL. Do not blindly retry an uncertain POST: it may already have published or replaced the site.
- Fetch the returned `url` and check that the expected landing page is served. Check required assets too. If verification fails, distinguish upload success from a page that is not yet reachable; do not claim it works.
- Return the exact service-provided URL and expiration. Do not infer a hostname from the site name.

## Reference

UI: https://drop.static.qagr.io (currently redirects in JavaScript to https://superhuman-drop.grammarly.workers.dev).

The UI's upload code confirms the query parameters, alternating `path`/`file` multipart fields, ZIP `archive` field, and `url`/`expiresAt` response fields. If the API changes, inspect the current UI JavaScript rather than installing its suggested MCP integration.
