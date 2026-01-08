# Identify Packages Ready to Modernize

This command identifies which packages in the monorepo are ready to be modernized based on their dependency status.

## Concept

A package is ready to modernize when **all of its workspace dependencies have already been modernized**. This ensures we work from the "bottom" of the dependency tree "up", avoiding situations where a modernized package depends on a non-modernized one.

## How to Identify Ready Packages

### Quick Command

Run this Node.js script to identify all packages ready to modernize:

```javascript
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get modernized packages
const modernizedRaw = execSync('pnpm nx show projects --projects tag:rollup 2>/dev/null', { encoding: 'utf-8' });
const modernized = new Set(
  modernizedRaw
    .split('\n')
    .filter(line => line && !line.includes('WARN'))
    .map(line => line.trim())
);

console.log('Modernized packages:', Array.from(modernized).sort().join(', '));
console.log(`\nTotal: ${modernized.size} modernized packages\n`);

// Get all project names
const allProjectsRaw = execSync('pnpm nx show projects 2>/dev/null', { encoding: 'utf-8' });
const allProjects = allProjectsRaw
  .split('\n')
  .filter(line => line && !line.includes('WARN'))
  .map(line => line.trim());

// Read all package.json files in libs/ directory
const libsDir = path.join(process.cwd(), 'libs');
const packageDirs = fs.readdirSync(libsDir, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name);

const candidates = [];

for (const dir of packageDirs) {
  const packageJsonPath = path.join(libsDir, dir, 'package.json');

  if (!fs.existsSync(packageJsonPath)) continue;

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const packageName = packageJson.name?.replace('@grammarly/', '') || dir;

    // Skip if already modernized
    if (modernized.has(packageName)) continue;

    // Get all dependencies
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies
    };

    // Find workspace dependencies
    const workspaceDeps = [];
    for (const [depName, version] of Object.entries(allDeps)) {
      if (version && (version.startsWith('workspace:') || version === '*')) {
        const shortName = depName.replace('@grammarly/', '');
        // Only count if it's an actual project in the workspace
        if (allProjects.includes(shortName)) {
          workspaceDeps.push(shortName);
        }
      }
    }

    // Check if all workspace dependencies are modernized
    const nonModernizedDeps = workspaceDeps.filter(dep => !modernized.has(dep));

    if (nonModernizedDeps.length === 0) {
      candidates.push({
        name: packageName,
        workspaceDeps: workspaceDeps,
        totalDeps: Object.keys(allDeps).length
      });
    }
  } catch (err) {
    console.error(`Error processing ${dir}:`, err.message);
  }
}

console.log('PACKAGES READY TO MODERNIZE (all workspace deps are modernized):\n');

// Sort by number of workspace dependencies (fewest first)
candidates.sort((a, b) => a.workspaceDeps.length - b.workspaceDeps.length);

candidates.forEach(pkg => {
  if (pkg.workspaceDeps.length === 0) {
    console.log(`✓ ${pkg.name} (no workspace dependencies)`);
  } else {
    console.log(`✓ ${pkg.name} (workspace deps: ${pkg.workspaceDeps.join(', ')})`);
  }
});

console.log(`\nTotal: ${candidates.length} packages ready`);
```

### Step-by-Step Explanation

1. **Get list of modernized packages:**
   ```bash
   pnpm nx show projects --projects tag:rollup
   ```
   This returns all packages that have the `rollup` tag in their `package.json` `nx.tags` array.

2. **Get list of all projects:**
   ```bash
   pnpm nx show projects
   ```

3. **For each non-modernized package:**
   - Read its `package.json`
   - Extract all workspace dependencies (dependencies with `workspace:` or `*` version)
   - Check if ALL workspace dependencies are in the modernized set
   - If yes, it's ready to modernize

4. **Sort results:**
   - Packages with no workspace dependencies first (simplest)
   - Then packages with few workspace dependencies
   - Then packages with more workspace dependencies

## Understanding the Output

The script groups packages into two categories:

### 1. Packages with No Workspace Dependencies (Simplest)
These packages don't depend on any other workspace packages, only external npm packages. They're the easiest to modernize because there are no internal dependencies to worry about.

Example output:
```
✓ backend-managed-storage (no workspace dependencies)
✓ test-utils (no workspace dependencies)
✓ util-package-json (no workspace dependencies)
```

### 2. Packages with Only Modernized Workspace Dependencies
These packages depend on other workspace packages, but ALL of those dependencies have already been modernized.

Example output:
```
✓ telemetry (workspace deps: core-utils)
✓ delta-utils (workspace deps: function-utils, util-fp-ts)
```

## How Modernization is Tracked

A package is considered "modernized" when it has the `"rollup"` tag in its `package.json`:

```json
{
  "nx": {
    "name": "package-name",
    "tags": ["vitest", "eslint", "release", "rollup"]
  }
}
```

The `rollup` tag indicates the package has been migrated to use:
- Rollup for building (instead of Vite)
- Shared TypeScript config (`@grammarly/tsconfig`)
- Simplified configuration (no separate `project.json`)
- Inferred Nx tasks (instead of explicit task definitions)

## Recommendation: Which Package to Modernize Next

1. **Start with packages that have no workspace dependencies** - They're the simplest and have the fewest potential issues
2. **Prioritize packages that are widely used** - Modernizing `test-utils` or commonly-used utilities unlocks more packages faster
3. **Work systematically** - Don't skip around; complete one package fully before moving to the next

## Common Pitfalls

1. **Circular dependencies** - If packages A and B depend on each other, neither can be fully modernized until one breaks the cycle
2. **Missing tags** - If a package was modernized but forgot to add the `rollup` tag, it won't show up as modernized
3. **devDependencies matter** - The script checks ALL dependency types (dependencies, devDependencies, peerDependencies)

## Integration with Modernize Workflow

Once you've identified a target package, use the `/modernize` command or refer to `~/.claude/commands/modernize.md` for the step-by-step modernization process.

## Saving the Script for Reuse

You can save the script above to a file and run it whenever needed:

```bash
# Save to a file
cat > /tmp/find-modernize-candidates.js << 'EOF'
[paste the script above]
EOF

# Run it
node /tmp/find-modernize-candidates.js
```

Or create it as a helper command in your monorepo's tools directory.
