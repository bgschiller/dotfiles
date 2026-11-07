import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import os from "node:os";

// Hostnames that may run the work-only MCP servers. The short form
// (before the first dot) is compared too, so a hostname like
// "AMMDL95QH32TN.corp.example.com" still matches.
const WORK_HOSTS = ["AMMDL95QH32TN"];

// Work-only MCP servers. Keep these in sync with the user-level mcp.json
// entries they replace; they live here so home/homelab never load them.
const WORK_SERVERS: Array<{ name: string; url: string; description: string }> = [
  {
    name: "glean",
    url: "https://grammarly-be.glean.com/mcp/default",
    description: "Search and read Grammarly internal knowledge and documents with Glean.",
  },
  {
    name: "atlassian",
    url: "https://mcp.atlassian.com/v1/mcp/authv2",
    description: "Search and manage Jira issues and Confluence pages.",
  },
  {
    name: "coda",
    url: "https://coda.io/apis/mcp",
    description: "Search and work with Coda documents and tables.",
  },
  {
    name: "sourcegraph",
    url: "https://sourcegraph.grammarly.io/.api/mcp",
    description: "Search and navigate Grammarly source code with Sourcegraph.",
  },
  {
    name: "sumologic",
    url: "https://apigw.prod-platform-plane.grammarlyaws.com/sumologic-mcp-server/mcp",
    description: "Search and investigate Grammarly logs in Sumo Logic.",
  },
  {
    name: "victoriametrics",
    url: "https://apigw.prod-platform-plane.grammarlyaws.com/vm-mcp-server/mcp",
    description: "Query Grammarly metrics using PromQL and MetricsQL.",
  },
  {
    name: "linear",
    url: "https://mcp.linear.app/mcp",
    description: "Search and manage Linear issues, projects, and teams.",
  },
];

export default function (pi: ExtensionAPI) {
  const host = os.hostname();
  const short = host.split(".")[0];
  const isWork = WORK_HOSTS.some((h) => h === host || h === short);
  if (!isWork) return;

  for (const server of WORK_SERVERS) {
    pi.registerMcpServer(server.name, {
      url: server.url,
      description: server.description,
    });
  }
}
