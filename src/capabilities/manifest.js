export const MCP_PREWORK_VERSION = "mcp-prework-1";

export const MCP_AUTH_POLICY = {
  enabledByDefault: false,
  defaultHost: "127.0.0.1",
  localAuthHeader: "X-Second-Brain-Secret",
  bearerAuthHeader: "Authorization",
  tokenEnv: "MCP_TOKEN",
  fallbackTokenEnv: "APP_SECRET",
  notes: [
    "MCP is disabled until explicitly enabled.",
    "Local development may fall back to APP_SECRET.",
    "LAN binding requires an explicit MCP_TOKEN.",
    "GitHub OAuth is browser auth and is not used for MCP clients."
  ]
};

export const CAPABILITY_RISK = {
  read: "read",
  append: "append",
  update: "update",
  destructive: "destructive"
};

export const CAPABILITY_PHASE = {
  first: "first-pass",
  later: "later",
  deferred: "deferred"
};

export const SECOND_BRAIN_CAPABILITIES = [
  {
    name: "capture.append",
    phase: CAPABILITY_PHASE.first,
    risk: CAPABILITY_RISK.append,
    description: "Append one capture entry to the current monthly fleeting note.",
    http: { method: "POST", path: "/api/captures" },
    input: {
      type: "object",
      required: ["category", "text"],
      properties: {
        category: { type: "string", enum: ["log", "thought", "idea", "todo", "reflection"] },
        text: { type: "string" },
        important: { type: "boolean" },
        urgent: { type: "boolean" },
        due: { type: "string", format: "date" },
        effort: { type: "string", enum: ["5m"] }
      }
    },
    output: {
      type: "object",
      properties: {
        capture: { type: "object" },
        monthlyFile: { type: "string" }
      }
    }
  },
  {
    name: "capture.recent",
    phase: CAPABILITY_PHASE.first,
    risk: CAPABILITY_RISK.read,
    description: "Read recent entries from the current monthly fleeting note.",
    http: { method: "GET", path: "/api/captures/recent" },
    input: {
      type: "object",
      properties: {
        limit: { type: "number", minimum: 1, maximum: 50 }
      }
    },
    output: {
      type: "object",
      properties: {
        captures: { type: "array" },
        monthlyFile: { type: "string" }
      }
    }
  },
  {
    name: "tasks.list",
    phase: CAPABILITY_PHASE.first,
    risk: CAPABILITY_RISK.read,
    description: "List indexed tasks using the same operational index as the Tasks tab.",
    http: { method: "GET", path: "/api/tasks" },
    input: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["open", "done", "all"] },
        scope: { type: "string", enum: ["all", "work", "personal"] },
        focus: { type: "string" },
        q: { type: "string" }
      }
    },
    output: {
      type: "object",
      properties: {
        tasks: { type: "array" },
        total: { type: "number" }
      }
    }
  },
  {
    name: "tasks.create",
    phase: CAPABILITY_PHASE.first,
    risk: CAPABILITY_RISK.append,
    description: "Create a todo in the current monthly fleeting note.",
    http: { method: "POST", path: "/api/captures" },
    input: {
      type: "object",
      required: ["text"],
      properties: {
        text: { type: "string" },
        important: { type: "boolean" },
        urgent: { type: "boolean" },
        due: { type: "string", format: "date" },
        effort: { type: "string", enum: ["5m"] }
      }
    },
    output: {
      type: "object",
      properties: {
        capture: { type: "object" },
        monthlyFile: { type: "string" }
      }
    }
  },
  {
    name: "tasks.complete",
    phase: CAPABILITY_PHASE.later,
    risk: CAPABILITY_RISK.update,
    description: "Mark an existing indexed task as complete in its source Markdown file.",
    http: { method: "POST", path: "/api/tasks/toggle" },
    input: {
      type: "object",
      required: ["taskId", "done"],
      properties: {
        taskId: { type: "string" },
        done: { type: "boolean" }
      }
    },
    output: {
      type: "object",
      properties: {
        task: { type: "object" }
      }
    }
  },
  {
    name: "sprint.current",
    phase: CAPABILITY_PHASE.first,
    risk: CAPABILITY_RISK.read,
    description: "Return active personal sprint, daily focus, OKRs, and habit/goal progress.",
    http: { method: "GET", path: "/api/personal-sprint" },
    input: {
      type: "object",
      properties: {
        view: { type: "string", enum: ["last", "current", "next"] }
      }
    },
    output: {
      type: "object"
    }
  },
  {
    name: "sprint.set_daily_focus",
    phase: CAPABILITY_PHASE.first,
    risk: CAPABILITY_RISK.update,
    description: "Set or clear today's focus in the active sprint Markdown note.",
    http: { method: "POST", path: "/api/personal-sprint/daily-focus" },
    input: {
      type: "object",
      required: ["text"],
      properties: {
        text: { type: "string" },
        source: { type: "string" },
        view: { type: "string", enum: ["last", "current", "next"] }
      }
    },
    output: {
      type: "object"
    }
  },
  {
    name: "dashboard.summary",
    phase: CAPABILITY_PHASE.first,
    risk: CAPABILITY_RISK.read,
    description: "Return the Dashboard summary: habits, personal cadence, Deep Work history, and index health.",
    http: { method: "GET", path: "/api/dashboard" },
    input: { type: "object", properties: {} },
    output: { type: "object" }
  },
  {
    name: "workflow.run",
    phase: CAPABILITY_PHASE.later,
    risk: CAPABILITY_RISK.update,
    description: "Start a Hermes-backed vault workflow such as categorization, sprint review, habit review, or vault maintenance.",
    http: { method: "POST", path: "/api/workflows/run/stream" },
    input: {
      type: "object",
      required: ["workflow"],
      properties: {
        workflow: {
          type: "string",
          enum: ["categorize-fleeting", "sprint-review", "plan-next-sprint", "review-habits", "vault-maintenance", "llm-wiki-distill"]
        },
        source: { type: "string" },
        notePath: { type: "string" },
        note: { type: "string" }
      }
    },
    output: {
      type: "object",
      properties: {
        runId: { type: "string" },
        summary: { type: "string" },
        logPath: { type: "string" }
      }
    }
  },
  {
    name: "vault.search",
    phase: CAPABILITY_PHASE.later,
    risk: CAPABILITY_RISK.read,
    description: "Search the operational note index. This should read full-vault notes, not task-ignore-filtered notes.",
    http: { method: "GET", path: "/api/notes/search" },
    input: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
        limit: { type: "number", minimum: 1, maximum: 50 }
      }
    },
    output: {
      type: "object",
      properties: {
        notes: { type: "array" }
      }
    }
  },
  {
    name: "chat.send_message",
    phase: CAPABILITY_PHASE.deferred,
    risk: CAPABILITY_RISK.read,
    description: "Send a message to the Hermes-backed chat runtime. Deferred until operational tools are stable.",
    http: { method: "POST", path: "/api/chat" },
    input: {
      type: "object",
      required: ["message"],
      properties: {
        message: { type: "string" },
        sessionPath: { type: "string" },
        thinking: { type: "boolean" },
        context: { type: "array" }
      }
    },
    output: { type: "object" }
  }
];

export function getMcpReadyCapabilities({ includeDeferred = false } = {}) {
  return SECOND_BRAIN_CAPABILITIES.filter((capability) => (
    includeDeferred || capability.phase !== CAPABILITY_PHASE.deferred
  ));
}
