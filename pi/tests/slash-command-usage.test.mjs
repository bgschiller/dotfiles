import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
const version = readFileSync(new URL("../agent/install/current-version", import.meta.url), "utf8").trim();
const modules = new URL(`../agent/install/releases/${version}/node_modules/`, import.meta.url);
const { createJiti } = await import(new URL("jiti/lib/jiti.mjs", modules));
const { CombinedAutocompleteProvider } = await import(new URL("@earendil-works/pi-tui/dist/autocomplete.js", modules));
const { Editor } = await import(new URL("@earendil-works/pi-tui/dist/components/editor.js", modules));
const { loadExtensions } = await import(new URL("@earendil-works/pi-coding-agent/dist/core/extensions/loader.js", modules));

const jiti = createJiti(import.meta.url, {
  alias: {
    "@earendil-works/pi-coding-agent": fileURLToPath(new URL("@earendil-works/pi-coding-agent/dist/config.js", modules)),
  },
});
const { createUsageAutocompleteProvider, default: extension } = await jiti.import("../agent/extensions/slash-command-usage.ts");
const commands = ["create-verification-skill", "create-mr", "skill:create-verification-skill", "crate", "model", "model-other", "xmodel"];
const options = { signal: new AbortController().signal };

function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), "pi-command-usage-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "usage.jsonl");
  const errors = [];
  const base = new CombinedAutocompleteProvider(commands.map(name => ({ name })), dir);
  const wrap = () => createUsageAutocompleteProvider(base, file, error => errors.push(error));
  return { file, base, errors, wrap, provider: wrap() };
}

async function suggestions(provider, text) {
  return provider.getSuggestions([text], 0, text.length, options);
}

function accept(provider, name, prefix = "/create-") {
  return provider.applyCompletion([prefix], 0, prefix.length, { value: name, label: name }, prefix);
}

test("accepted commands rank by frequency and survive provider recreation", async t => {
  const { provider, wrap, file } = setup(t);
  assert.equal((await suggestions(provider, "/create-")).items[0].value, "create-verification-skill");
  assert.deepEqual(accept(provider, "create-mr"), {
    lines: ["/create-mr "], cursorLine: 0, cursorCol: 11,
  });
  assert.equal((await suggestions(provider, "/create-")).items[0].value, "create-mr");
  assert.equal((await suggestions(wrap(), "/create-")).items[0].value, "create-mr");
  accept(provider, "create-verification-skill");
  accept(provider, "create-verification-skill");
  assert.equal((await suggestions(provider, "/create-")).items[0].value, "create-verification-skill");
  assert.deepEqual(readFileSync(file, "utf8").trim().split("\n").map(JSON.parse), [
    "create-mr", "create-verification-skill", "create-verification-skill",
  ]);
});

test("exact and prefix matches stay ahead of frequently selected fuzzy matches", async t => {
  const { provider } = setup(t);
  for (let i = 0; i < 5; i++) accept(provider, "create-mr");
  assert.equal((await suggestions(provider, "/crate")).items[0].value, "crate");
  accept(provider, "skill:create-verification-skill");
  assert.equal((await suggestions(provider, "/skill:")).items[0].value, "skill:create-verification-skill");
  for (let i = 0; i < 5; i++) accept(provider, "xmodel");
  accept(provider, "model-other");
  assert.equal((await suggestions(provider, "/mod")).items[0].value, "model-other");
  assert.equal((await suggestions(provider, "/model")).items[0].value, "model");
});

test("queries do not count; argument and file completions pass through untouched", async t => {
  const { provider, file } = setup(t);
  await suggestions(provider, "/create-");
  assert.throws(() => readFileSync(file), { code: "ENOENT" });
  const response = { prefix: "arg", items: [{ value: "z", label: "z" }, { value: "a", label: "a" }] };
  const completed = { lines: ["result"], cursorLine: 0, cursorCol: 6 };
  const base = {
    triggerCharacters: ["#"],
    getSuggestions: async () => response,
    applyCompletion: () => completed,
    shouldTriggerFileCompletion: () => false,
  };
  const wrapped = createUsageAutocompleteProvider(base, file, assert.fail);
  assert.deepEqual(wrapped.triggerCharacters, ["#"]);
  for (const text of ["/model arg", "@file", "some /create-"]) {
    assert.equal(await suggestions(wrapped, text), response);
    assert.equal(wrapped.applyCompletion([text], 0, text.length, response.items[0], response.prefix), completed);
  }
  assert.equal(wrapped.shouldTriggerFileCompletion([], 0, 0), false);
  assert.throws(() => readFileSync(file), { code: "ENOENT" });
});

test("independent providers merge selections and ignore malformed records", async t => {
  const { provider, wrap, file } = setup(t);
  writeFileSync(file, 'broken\n123\n{}\n"create-mr"\n');
  const other = wrap();
  accept(provider, "create-mr");
  accept(other, "create-verification-skill");
  assert.equal((await suggestions(other, "/create-")).items[0].value, "create-mr");
});

test("storage failure does not prevent completion", t => {
  const { base, file } = setup(t);
  writeFileSync(file, "not a directory");
  const errors = [];
  const provider = createUsageAutocompleteProvider(base, join(file, "usage.jsonl"), error => errors.push(error));
  assert.equal(accept(provider, "create-mr").lines[0], "/create-mr ");
  assert.equal(errors.length, 1);
});

test("real editor Tab completes the learned command", async t => {
  const { provider } = setup(t);
  accept(provider, "create-mr");
  const identity = text => text;
  const editor = new Editor({ requestRender() {} }, {
    borderColor: identity,
    selectList: { selectedPrefix: identity, selectedText: identity, description: identity, scrollInfo: identity, noMatch: identity },
  });
  editor.setAutocompleteProvider(provider);
  for (const character of "/create-") {
    editor.handleInput(character);
    await new Promise(resolve => setImmediate(resolve));
  }
  editor.handleInput("\t");
  assert.equal(editor.getText(), "/create-mr ");
});

test("Pi's real extension loader accepts the extension", async () => {
  const path = fileURLToPath(new URL("../agent/extensions/slash-command-usage.ts", import.meta.url));
  const result = await loadExtensions([path], process.cwd());
  assert.deepEqual(result.errors, []);
  assert.equal(result.extensions.length, 1);
  assert.equal(result.extensions[0].handlers.get("session_start").length, 1);
});

test("extension registers the wrapper only in TUI mode", async () => {
  const handlers = new Map();
  extension({ on: (name, handler) => handlers.set(name, handler) });
  let registrations = 0;
  const ui = { addAutocompleteProvider: () => registrations++, notify: assert.fail };
  await handlers.get("session_start")({}, { mode: "rpc", ui });
  assert.equal(registrations, 0);
  await handlers.get("session_start")({}, { mode: "tui", ui });
  assert.equal(registrations, 1);
});
