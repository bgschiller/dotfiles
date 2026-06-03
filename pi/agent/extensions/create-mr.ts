import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type RepoType = "github" | "gitlab";

type PrecomputedContext = {
  originUrl: string;
  repoType: RepoType;
  currentBranch: string;
  remoteBranchExists: boolean;
  targetBranch: string;
  isStacked: boolean;
  compareRange: string;
  templatePath?: string;
  projectPath?: string;
  projectId?: string;
  parentMr?: {
    iid: number;
    id: number;
    title: string;
    webUrl?: string;
  };
  commitLog: string;
  commitMessages: string;
  diffStat: string;
};

async function run(command: string, args: string[], cwd: string) {
  return execFileAsync(command, args, {
    cwd,
    maxBuffer: 10 * 1024 * 1024,
    env: process.env,
  });
}

async function runTrimmed(command: string, args: string[], cwd: string) {
  const { stdout } = await run(command, args, cwd);
  return stdout.trim();
}

async function safeRunTrimmed(command: string, args: string[], cwd: string) {
  try {
    return await runTrimmed(command, args, cwd);
  } catch {
    return "";
  }
}

async function fileExists(path: string) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function detectRepoType(originUrl: string): RepoType | undefined {
  if (originUrl.includes("github.com")) return "github";
  if (originUrl.includes("gitlab")) return "gitlab";
  return undefined;
}

async function findTemplatePath(cwd: string, repoType: RepoType) {
  const candidates = repoType === "gitlab"
    ? [
        ".gitlab/merge_request_templates/Default.md",
        ".gitlab/merge_request_templates/default.md",
      ]
    : [
        ".github/pull_request_template.md",
        ".github/PULL_REQUEST_TEMPLATE.md",
      ];

  for (const candidate of candidates) {
    if (await fileExists(join(cwd, candidate))) return candidate;
  }

  return undefined;
}

async function getParentMr(cwd: string, targetBranch: string, projectId: string) {
  try {
    const { stdout } = await run(
      "glab",
      [
        "api",
        `projects/${projectId}/merge_requests?source_branch=${encodeURIComponent(targetBranch)}&state=opened`,
      ],
      cwd,
    );

    const parsed = JSON.parse(stdout) as Array<{
      iid: number;
      id: number;
      title: string;
      web_url?: string;
    }>;
    const first = parsed[0];
    if (!first) return undefined;
    return {
      iid: first.iid,
      id: first.id,
      title: first.title,
      webUrl: first.web_url,
    };
  } catch {
    return undefined;
  }
}

async function buildContext(cwd: string): Promise<PrecomputedContext> {
  await run("git", ["rev-parse", "--git-dir"], cwd);

  const originUrl = await runTrimmed("git", ["remote", "get-url", "origin"], cwd);
  const repoType = detectRepoType(originUrl);
  if (!repoType) {
    throw new Error(`Unsupported origin remote: ${originUrl}`);
  }

  const currentBranch = await runTrimmed("git", ["rev-parse", "--abbrev-ref", "HEAD"], cwd);

  let remoteBranchExists = true;
  try {
    await run("git", ["rev-parse", "--verify", `origin/${currentBranch}`], cwd);
  } catch {
    remoteBranchExists = false;
  }

  const targetBranch = (await safeRunTrimmed("git", ["merge-target"], cwd)) || "main";
  const isStacked = targetBranch !== "main";
  const compareRange = `${targetBranch}..HEAD`;

  const [templatePath, commitLog, commitMessages, diffStat] = await Promise.all([
    findTemplatePath(cwd, repoType),
    safeRunTrimmed("git", ["log", "--oneline", compareRange], cwd),
    safeRunTrimmed("git", ["log", compareRange], cwd),
    safeRunTrimmed("git", ["diff", "--stat", `${targetBranch}...HEAD`], cwd),
  ]);

  let projectPath: string | undefined;
  let projectId: string | undefined;
  let parentMr: PrecomputedContext["parentMr"];

  if (repoType === "gitlab") {
    try {
      const repoView = await runTrimmed("glab", ["repo", "view", "--output", "json"], cwd);
      const parsed = JSON.parse(repoView) as { path_with_namespace?: string; id?: number | string };
      projectPath = parsed.path_with_namespace;
      projectId = parsed.id != null ? String(parsed.id) : undefined;

      if (isStacked && projectId) {
        parentMr = await getParentMr(cwd, targetBranch, projectId);
      }
    } catch {
      // Ignore glab metadata failures; the agent can still proceed.
    }
  }

  return {
    originUrl,
    repoType,
    currentBranch,
    remoteBranchExists,
    targetBranch,
    isStacked,
    compareRange,
    templatePath,
    projectPath,
    projectId,
    parentMr,
    commitLog,
    commitMessages,
    diffStat,
  };
}

async function readTemplate(cwd: string, templatePath?: string) {
  if (!templatePath) return undefined;
  try {
    return await readFile(join(cwd, templatePath), "utf8");
  } catch {
    return undefined;
  }
}

function buildPrompt(context: PrecomputedContext, templateContents?: string) {
  const requestNoun = context.repoType === "gitlab" ? "MR" : "PR";
  const createCommand = context.repoType === "gitlab"
    ? `glab mr create --title \"<title>\" --description \"<description>\" --target-branch \"${context.targetBranch}\" --remove-source-branch --squash-before-merge --yes`
    : `gh pr create --title \"<title>\" --body \"<description>\" --base \"${context.targetBranch}\"`;

  let stackedSection: string;
  if (!context.isStacked) {
    stackedSection = `- Target branch is \`${context.targetBranch}\`; treat this as a normal change against main.
`;
  } else if (context.repoType === "gitlab") {
    const parentLine = context.parentMr
      ? `Parent MR already found: !${context.parentMr.iid} — ${context.parentMr.title}${context.parentMr.webUrl ? ` (${context.parentMr.webUrl})` : ""}. After creating the new MR, create the blocking relationship with glab api so the parent MR blocks this one.`
      : `No parent MR was precomputed for source branch \`${context.targetBranch}\`. After creating the MR, try to find one and create a blocking relationship if possible.`;
    stackedSection = `- This is a stacked MR because the target branch is \`${context.targetBranch}\`.
- ${parentLine}
`;
  } else {
    stackedSection = `- This is a stacked PR because the target branch is \`${context.targetBranch}\`.
- GitHub has no blocking-PR API, so just target \`${context.targetBranch}\` and mention the stack clearly in the description if helpful.
`;
  }

  return `/create-mr

Please create a ${requestNoun} for the current branch using the existing conversation context plus the precomputed repository facts below.

Precomputed facts:
- Repository type: ${context.repoType}
- Origin remote: ${context.originUrl}
- Current branch: ${context.currentBranch}
- Branch pushed to origin: ${context.remoteBranchExists ? "yes" : "no"}
- Target branch: ${context.targetBranch}
- Compare range: ${context.compareRange}
- Template path: ${context.templatePath ?? "none found"}
${context.projectPath ? `- GitLab project path: ${context.projectPath}
` : ""}${context.projectId ? `- GitLab project id: ${context.projectId}
` : ""}${stackedSection}
Commit summary:
\`\`\`
${context.commitLog || "(no commits found in range)"}
\`\`\`

Full commit messages:
\`\`\`
${context.commitMessages || "(no commit messages found in range)"}
\`\`\`

Diff stat:
\`\`\`
${context.diffStat || "(no diff stat available)"}
\`\`\`

${templateContents ? `Template contents:
\`\`\`markdown
${templateContents}
\`\`\`

` : ""}Instructions:
1. If the branch is not pushed, push it first with \'git push -u origin ${context.currentBranch}\'.
2. Review the relevant commits and diff as needed before writing the final title and description.
3. Draft a concise title and a description that reflects Brian's preferences:
   - context first
   - approach and rationale
   - testing
   - relevant conversation context when useful
4. Write the draft to a local file named \`mr-${context.currentBranch.replace(/[^a-zA-Z0-9._-]+/g, "-")}.md\` in the current directory, using this format:
   - first line: markdown heading with the title
   - blank line
   - description body
5. Ask Brian to review/edit that file using the shared \`human-review\` skill.
6. After Brian approves the file contents, parse the title from the first line and create the ${requestNoun.toLowerCase()} with:
   \`${createCommand}\`
7. ${context.repoType === "gitlab"
      ? "If this is stacked, create the blocking dependency after MR creation."
      : "If this is stacked, there is no dependency API to call; just create the PR."}
8. Finish by printing a Slack review request in the form: \`Please review my ${requestNoun} to [title](url)\`.

Do not re-run the already precomputed repository-discovery commands unless something looks stale.`;
}

export default function createMrExtension(pi: ExtensionAPI) {
  pi.registerCommand("create-mr", {
    description: "Create a GitHub PR or GitLab MR using precomputed git context",
    handler: async (_args, ctx) => {
      if (!ctx.isIdle()) {
        ctx.ui.notify("Wait for the current turn to finish before running /create-mr.", "warning");
        return;
      }

      try {
        ctx.ui.notify("Precomputing MR context…", "info");
        const context = await buildContext(ctx.cwd);
        const templateContents = await readTemplate(ctx.cwd, context.templatePath);
        const prompt = buildPrompt(context, templateContents);

        pi.sendUserMessage(prompt);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`Failed to prepare /create-mr: ${message}`, "error");
      }
    },
  });
}
