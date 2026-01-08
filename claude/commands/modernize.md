# Modernize Package Build Configuration

Modernize a library package to use Rollup instead of Vite, simplify TypeScript configuration, and ensure Vitest compatibility.

## Usage

When the user provides a package name (e.g., "modernize array-utils" or just "array-utils"), apply these transformations:

## Transformation Steps

### 1. Update package.json

Replace the entire package.json with modernized structure:

**Changes:**
- Add `"type": "module"`
- Add `"author": "Grammarly, Inc."` and `"license": "UNLICENSED"`
- Change `"main"` from `"./dist/index.js"` to `"./dist/index.cjs"`
- Change `"module"` from `"./dist/index.js"` to `"./dist/index.mjs"`
- In `"exports"`, change:
  - `"require"` paths from `.js` to `.cjs`
  - `"import"` and `"default"` paths from `.js` to `.mjs`
- Add `"sideEffects": false` for better tree-shaking
- Convert all dependencies to use `workspace:^` or `catalog:` protocols
  - **Priority order**:
    1. Use `workspace:^` for all internal `@grammarly/*` packages
    2. Use `catalog:` for external packages already in the catalog
    3. Add external packages to the catalog if not yet present
    4. If switching to the catalog version causes issues, it's acceptable to leave the version string in package.json temporarily
  - Use the version from the original package.json when adding new entries to the catalog
- Add to `devDependencies`:
  ```json
  "@grammarly/shared-config": "workspace:^",
  "@grammarly/tsconfig": "workspace:^",
  "tslib": "catalog:"
  ```
- Remove any `scripts` section (test/lint/prettier scripts - these are handled by Nx)
- Add `nx` field:
  ```json
  "nx": {
    "name": "package-name",
    "tags": ["vitest", "eslint", "release","rollup"]
  }
  ```

### 2. Delete project.json

The standalone `project.json` file is replaced by the `nx` field in `package.json`.

```bash
rm libs/{package-name}/project.json
```

### 3. ~~Create rollup.config.mts~~ No longer necessary

Instead of creating a rollup.config.mts, we're using the pattern from 7c2174bc4a where the config is created while inferring tasks.

### 4. Replace tsconfig.json

Replace the entire tsconfig.json with a minimal version:

```json
{
  "extends": "@grammarly/tsconfig",
  "include": ["src"]
}
```

It's possible you'll need to use the `@grammarly/tsconfig/node` or `@grammarly/tsconfig/browser` variants if the package relies on node or browser types.

### 5. Delete extra TypeScript configs

```bash
rm libs/{package-name}/tsconfig.lib.json
rm libs/{package-name}/tsconfig.spec.json
```

### 6. Delete vite.config.ts

```bash
rm libs/{package-name}/vite.config.ts
```

### 7. Delete jest.config.ts (if present)

If the package uses Jest instead of Vitest:

```bash
rm libs/{package-name}/jest.config.ts
```

### 8. Consider removing .eslintrc.json (if present)

If the eslint configuration is small, it may be worth replacing it with line-specific `// eslint-disable-next-line` comments. However, skip this step if it looks like there's a lot of custom stuff.

### 9. Update source files for ESM compatibility

**Add .js extensions to fp-ts imports:**

Search for fp-ts imports and add `.js` extension:
- `from 'fp-ts/lib/Option'` → `from 'fp-ts/lib/Option.js'`
- `from 'fp-ts/lib/function'` → `from 'fp-ts/lib/function.js'`
- etc.

This is required for ESM builds which don't support directory imports.

### 10. Update test files for Vitest

**IMPORTANT: We use explicit imports for all Vitest globals. Do NOT use vitest globals mode.**

For each `.spec.ts` or `.test.ts` file:

1. **Add Vitest imports at the top of the file:**
   - Analyze what vitest globals are used in the file (describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll, vitest, etc.)
   - Add an import statement with only the globals that are actually used:
   ```typescript
   import { describe, expect, it, vi } from 'vitest'
   ```

2. **Common imports by use case:**
   - Basic tests: `import { describe, expect, it } from 'vitest'`
   - Tests with spies/mocks: Add `vi`
   - Tests with setup/teardown: Add `beforeEach`, `afterEach`, `beforeAll`, `afterAll`
   - Tests using fake timers or other vitest APIs: Add `vitest`

3. **Replace snapshot matchers:**
   - `toMatchSnapshot()` → `toMatchInlineSnapshot()` (with inline snapshot string)

4. **Update other Jest-specific APIs:**
   - Check for Jest-specific matchers and replace with Vitest equivalents
   - Ensure all test utility functions are imported explicitly

**Why explicit imports?**
- Clearer code - no magic globals
- Better IDE support and type checking
- Easier to understand test dependencies
- Standard modern JavaScript practice

### 11. Fix TypeScript strict mode errors

The new `@grammarly/tsconfig` enables strict mode. Common fixes needed:

**Non-null assertions:** Add "!" for array/object access that can't be undefined:
```typescript
// Add eslint-disable comment when needed
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
arr[index]!
```

**Optional chaining:** Use `?.` for potentially undefined values

**Type guards:** Add proper type checks before accessing properties

### 12. Run pnpm install

After package.json changes:
```bash
pnpm install
```

### 13. Verify the changes

**Build:**
```bash
npx nx build {package-name}
```

**Test:**
```bash
npx nx test {package-name}
```

**Lint:**
```bash
npx nx lint {package-name}
```

All three must pass without errors or warnings.

### 14. Check package integrity

Run the package integrity checks to ensure everything is properly configured:

```bash
npx nx test-package-integrity {package-name}
npx nx check-package-imports {package-name}
```

These checks verify:
- **test-package-integrity**: Ensures dist files exist as declared in package.json (main, module, types, exports) and TypeScript compiles correctly
- **check-package-imports**: Tests that the package can be imported successfully as an ESM module

If a package is expected to fail the import check temporarily, add the tag `"expected-to-fail-package-imports"` to the package.json `nx.tags` array. Remove this tag once the package passes.

### 15. Create changeset

```bash
pnpm changeset --empty
```

Then edit the changeset file to document the changes:
```markdown
---
'@grammarly/{package-name}': patch
---

Modernize build setup: migrate from Vite to Rollup with shared config, simplify TypeScript configuration, and migrate tests to Vitest
```

## Common Issues and Fixes

### TypeScript Errors

**"Object is possibly 'undefined'":**
- Use non-null assertion with eslint-disable comment
- Or add proper undefined checks

**"Cannot find module" errors:**
- Ensure fp-ts imports have `.js` extensions
- Check that all imports are correct

### Test Failures

**"describe is not defined":**
- Add `import { describe, expect, it } from 'vitest'`

**Snapshot mismatches:**
- Convert `toMatchSnapshot()` to `toMatchInlineSnapshot()` with the actual snapshot value

### Lint Warnings

**"Forbidden non-null assertion":**
- Add `// eslint-disable-next-line @typescript-eslint/no-non-null-assertion` above the line

**"'X' is already defined" (namespace redeclaration):**
- Add `no-redeclare` to the existing eslint-disable comment
- Example: `// eslint-disable-next-line @typescript-eslint/no-namespace, no-redeclare`

### Build Errors

**"Cannot find package '@grammarly/shared-config'":**
- Run `pnpm install` to update lockfile
- Ensure the package builds: `npx nx build shared-config`

**"Cannot find '@grammarly/tsconfig'":**
- Run `pnpm install` to link workspace dependencies

**Circular dependency warnings:**
- Rollup will warn about circular dependencies in the build output
- To fix circular dependencies, change type-only imports from:
  ```ts
  import { type Something } from './something'
  ```
  to:
  ```ts
  import type { Something } from './something'
  ```
- This tells TypeScript/Rollup that this is a type-only import and won't create a runtime circular dependency

### Package Integrity Errors

**"Missing file for 'main'":**
- Check that the build output exists in dist/
- Verify entry points are defined in the package.json's "module", "main", and "exports" fields.
- Run build again: `npx nx build {package-name}`

**"TypeScript compilation check failed":**
- Check for broken .d.ts files in dist/
- Ensure all imports in source files have correct extensions (.js for fp-ts)
- Look for circular type dependencies

**"Package now imports successfully. Please remove the 'expected-to-fail-package-imports' tag":**
- This is good news! Remove `"expected-to-fail-package-imports"` from `nx.tags` in package.json
- The package is now properly configured for ESM

## Recommendations

### Before Starting

1. **Check git status** - Ensure working directory is clean
2. **Review the reference commit** - Look at commit `e113533f0d` (Cleanup @grammarly/array-utils) for the exact pattern
3. **Run existing tests** - Verify tests pass before modernization

### During Migration

1. **Make changes incrementally** - Follow the steps in order
2. **Test frequently** - Run build/test/lint after each major change
3. **Track your work** - Use TodoWrite to track progress through the steps

### After Completion

1. **Verify all commands pass:**
   - `npx nx build {package-name}` ✓
   - `npx nx test {package-name}` ✓
   - `npx nx lint {package-name}` ✓
   - `npx nx test-package-integrity {package-name}` ✓
   - `npx nx check-package-imports {package-name}` ✓

2. **Review the diff** - Ensure changes match the pattern from the reference commit

3. **Create meaningful changeset** - Document what changed and why

4. **Commit with clean message** - Use format: "Cleanup @grammarly/{package-name}"

### Tags Reference

Add these to `package.json` `nx.tags` array:
- `"skip-package-integrity-check"` - Skip both checks entirely (use for special cases)
- `"expected-to-fail-package-imports"` - Package is expected to fail import (temporary, remove when fixed)

## Key Learnings

### What This Modernization Achieves

1. **Consistent build system** - All packages use the same Rollup-based build
2. **Simplified configuration** - Less boilerplate, centralized TypeScript config
3. **Better ESM support** - Proper `.cjs`/`.mjs` extensions and ESM-compatible imports
4. **Unified testing** - Standardized on Vitest across the monorepo
5. **Improved tree-shaking** - `sideEffects: false` and better module structure
6. **Workspace protocol usage** - Better dependency management with pnpm workspaces

### Why These Changes Matter

- **Rollup over Vite** - More control over output format and better for libraries
- **Shared config** - One place to update build config for all packages
- **Simplified tsconfig** - Extends from shared config, less duplication
- **Catalog protocol** - Centralized version management for external dependencies
- **No separate project.json** - Tasks are defined via the `nx.tags` in package.json, so there's no need for a separate project.json file.
- **Automated integrity checks** - Nx executors automatically verify package integrity for all libraries (can opt-out with `skip-package-integrity-check` tag)

### Patterns to Maintain

1. **Minimal configs** - Keep package-specific configs as simple as possible
2. **Shared tooling** - Use shared-config and tsconfig packages
3. **Consistent structure** - All packages follow the same pattern
4. **Clean exports** - Proper main/module/exports configuration
5. **Type safety** - Don't disable TypeScript strict mode, fix the issues

## Checklist

Use this checklist when modernizing a package:

- [ ] Update package.json (type, exports, dependencies, nx field)
- [ ] Delete project.json
- [ ] Create rollup.config.mts
- [ ] Replace tsconfig.json
- [ ] Delete tsconfig.lib.json and tsconfig.spec.json
- [ ] Delete vite.config.ts
- [ ] Delete jest.config.ts (if present)
- [ ] Delete .eslintrc.json (if present)
- [ ] Add .js extensions to fp-ts imports
- [ ] Add vitest imports to test files
- [ ] Convert snapshot tests to inline snapshots
- [ ] Fix TypeScript strict mode errors
- [ ] Fix lint warnings
- [ ] Run pnpm install
- [ ] Verify build passes
- [ ] Verify tests pass
- [ ] Verify lint passes
- [ ] Run test-package-integrity check
- [ ] Run check-package-imports check
- [ ] Create changeset
- [ ] Commit changes

## Example: Complete Migration

```bash
# Example for modernizing "string-utils" package

# 1. Check current state
git status
npx nx test string-utils  # Baseline - should pass

# 2. Make all file changes (use the steps above)
# ... edit package.json, create rollup.config.mts, etc.

# 3. Install dependencies
pnpm install

# 4. Fix any TypeScript/test issues
# ... add vitest imports, fix strict mode errors, etc.

# 5. Verify everything works
npx nx build string-utils                 # Must pass
npx nx test string-utils                  # Must pass
npx nx lint string-utils                  # Must pass
npx nx test-package-integrity string-utils  # Must pass
npx nx check-package-imports string-utils   # Must pass

# 6. Create changeset
pnpm changeset --empty
# Edit .changeset/*.md file

# 7. Commit
git add .
git commit -m "Cleanup @grammarly/string-utils"
```

## Reference Commit

The canonical example of this modernization is commit `e113533f0d`:
- Branch: cleanup-pkg-2
- Package: @grammarly/array-utils
- Files changed: -170 lines added, +79 lines removed
- note that this predates the removal of rollup.config.mts. It includes a rollup config, but we'll want to skip that step.

Review this commit for exact patterns and formatting.

## Additional Notes

If you learn something new that could be useful next time, please add it to this file: .claude/commands/modernize.md
