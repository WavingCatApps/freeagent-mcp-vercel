import { describe, it, expect, vi } from "vitest";
import type { FreeAgentApiClient } from "../services/api-client.js";
import { logTimeBatch } from "./log-time-batch.js";

interface Call {
  method: "get" | "post";
  path: string;
  params?: unknown;
  body?: unknown;
}

function makeClient(handlers: {
  get?: (path: string, params?: unknown) => unknown;
  post?: (path: string, body?: unknown) => unknown | Error;
}): { client: FreeAgentApiClient; calls: Call[] } {
  const calls: Call[] = [];
  const client = {
    get: vi.fn(async (path: string, params?: unknown) => {
      calls.push({ method: "get", path, params });
      const data = handlers.get?.(path, params);
      return { data, headers: {} };
    }),
    post: vi.fn(async (path: string, body?: unknown) => {
      calls.push({ method: "post", path, body });
      const data = handlers.post?.(path, body);
      if (data instanceof Error) throw data;
      return { data, headers: {} };
    }),
  } as unknown as FreeAgentApiClient;
  return { client, calls };
}

const soleUser = {
  url: "https://api.freeagent.com/v2/users/1",
  email: "owner@example.com",
  first_name: "Owner",
  last_name: "User",
  role: "Owner",
  permission_level: 8,
};

const projectA = {
  url: "https://api.freeagent.com/v2/projects/10",
  contact: "https://api.freeagent.com/v2/contacts/1",
  name: "Website Redesign",
  status: "Active",
  is_ir35: false,
  budget: "0",
  budget_units: "Hours",
};

const projectB = {
  url: "https://api.freeagent.com/v2/projects/11",
  contact: "https://api.freeagent.com/v2/contacts/2",
  name: "Mobile App",
  status: "Active",
  is_ir35: false,
  budget: "0",
  budget_units: "Hours",
};

const taskA = {
  url: "https://api.freeagent.com/v2/tasks/100",
  project: projectA.url,
  name: "Discovery",
  status: "Active",
  is_billable: true,
};

const taskB = {
  url: "https://api.freeagent.com/v2/tasks/101",
  project: projectA.url,
  name: "Implementation",
  status: "Active",
  is_billable: true,
};

const taskC = {
  url: "https://api.freeagent.com/v2/tasks/200",
  project: projectB.url,
  name: "iOS",
  status: "Active",
  is_billable: true,
};

describe("logTimeBatch", () => {
  it("resolves a mix of task URL, numeric ID, and name-within-project", async () => {
    let timeslipId = 900;
    const { client, calls } = makeClient({
      get: (path, params) => {
        if (path === "/users") return { users: [soleUser] };
        if (path === "/projects" && (params as { view?: string })?.view === "active") {
          return { projects: [projectA] };
        }
        if (path === taskA.url || path === "/tasks/100") return { task: taskA };
        if (path === "/tasks" && (params as { project?: string })?.project === projectA.url) {
          return { tasks: [taskA, taskB] };
        }
      },
      post: (path, body) => {
        if (path === "/timeslips") {
          timeslipId += 1;
          const ts = (body as { timeslip: Record<string, unknown> }).timeslip;
          return {
            timeslip: {
              url: `https://api.freeagent.com/v2/timeslips/${timeslipId}`,
              user: ts.user,
              project: ts.project,
              task: ts.task,
              dated_on: ts.dated_on,
              hours: ts.hours,
              comment: ts.comment,
            },
          };
        }
      },
    });

    const result = await logTimeBatch(client, {
      project: "Website Redesign",
      entries: [
        { task: taskA.url, dated_on: "2026-04-20", hours: "2.0", comment: "Spike" },
        { task: "100", dated_on: "2026-04-21", hours: "3.0" },
        { task: "Implementation", dated_on: "2026-04-22", hours: "1.5" },
      ],
    });

    expect(result).toContain("Logged 3 timeslip(s)");
    expect(result).toContain("6.50");

    const timeslipPosts = calls.filter((c) => c.method === "post" && c.path === "/timeslips");
    expect(timeslipPosts).toHaveLength(3);
    expect(timeslipPosts[0].body).toMatchObject({
      timeslip: { task: taskA.url, project: projectA.url, user: soleUser.url, dated_on: "2026-04-20", hours: "2.0", comment: "Spike" },
    });
    expect(timeslipPosts[1].body).toMatchObject({
      timeslip: { task: taskA.url, project: projectA.url, dated_on: "2026-04-21", hours: "3.0" },
    });
    expect(timeslipPosts[2].body).toMatchObject({
      timeslip: { task: taskB.url, project: projectA.url, dated_on: "2026-04-22", hours: "1.5" },
    });
  });

  it("supports entry-level project override so one batch can span projects", async () => {
    let timeslipId = 900;
    const { client, calls } = makeClient({
      get: (path, params) => {
        if (path === "/users") return { users: [soleUser] };
        if (path === "/projects" && (params as { view?: string })?.view === "active") {
          const q = params as { view?: string };
          if (q.view === "active") return { projects: [projectA, projectB] };
        }
        if (path === "/tasks" && (params as { project?: string })?.project === projectA.url) {
          return { tasks: [taskA] };
        }
        if (path === "/tasks" && (params as { project?: string })?.project === projectB.url) {
          return { tasks: [taskC] };
        }
      },
      post: () => {
        timeslipId += 1;
        return {
          timeslip: {
            url: `https://api.freeagent.com/v2/timeslips/${timeslipId}`,
            user: soleUser.url,
            project: projectA.url,
            task: taskA.url,
            dated_on: "2026-04-20",
            hours: "1.0",
          },
        };
      },
    });

    await logTimeBatch(client, {
      entries: [
        { task: "Discovery", project: "Website Redesign", dated_on: "2026-04-20", hours: "1.0" },
        { task: "iOS", project: "Mobile App", dated_on: "2026-04-20", hours: "2.0" },
      ],
    });

    const posts = calls.filter((c) => c.method === "post" && c.path === "/timeslips");
    expect(posts).toHaveLength(2);
    expect(posts[0].body).toMatchObject({ timeslip: { task: taskA.url, project: projectA.url } });
    expect(posts[1].body).toMatchObject({ timeslip: { task: taskC.url, project: projectB.url } });
  });

  it("surfaces per-entry failures without aborting the batch", async () => {
    let timeslipId = 900;
    const { client } = makeClient({
      get: (path, params) => {
        if (path === "/users") return { users: [soleUser] };
        if (path === "/projects" && (params as { view?: string })?.view === "active") {
          return { projects: [projectA] };
        }
        if (path === "/tasks" && (params as { project?: string })?.project === projectA.url) {
          return { tasks: [taskA, taskB] };
        }
      },
      post: (_path, body) => {
        timeslipId += 1;
        const ts = (body as { timeslip: Record<string, unknown> }).timeslip;
        if (ts.hours === "-1") return new Error("Validation error: hours must be positive");
        return {
          timeslip: {
            url: `https://api.freeagent.com/v2/timeslips/${timeslipId}`,
            user: soleUser.url,
            project: projectA.url,
            task: ts.task,
            dated_on: ts.dated_on,
            hours: ts.hours,
          },
        };
      },
    });

    const result = await logTimeBatch(client, {
      project: "Website Redesign",
      entries: [
        { task: "Discovery", dated_on: "2026-04-20", hours: "2.0" },
        { task: "Implementation", dated_on: "2026-04-21", hours: "-1" },
      ],
    });

    expect(result).toContain("Logged 1 of 2 timeslip(s); 1 failed");
    expect(result).toContain("hours must be positive");
    expect(result).toContain("2.00");
  });

  it("errors when a task name is given without any project scope", async () => {
    const { client } = makeClient({
      get: (path) => {
        if (path === "/users") return { users: [soleUser] };
      },
    });

    const result = await logTimeBatch(client, {
      entries: [
        { task: "Discovery", dated_on: "2026-04-20", hours: "2.0" },
      ],
    });

    expect(result).toContain("Failed to log all 1 timeslip(s)");
    expect(result).toMatch(/paired with a `project`/);
  });

  it("errors clearly when a task ID belongs to a different project than the hint", async () => {
    const { client } = makeClient({
      get: (path, params) => {
        if (path === "/users") return { users: [soleUser] };
        if (path === "/tasks/100") return { task: taskA };
        if (path === "/projects" && (params as { view?: string })?.view === "active") {
          return { projects: [projectB] };
        }
        if (path === "/projects" && (params as { view?: string })?.view === "all") {
          return { projects: [projectB] };
        }
      },
    });

    const result = await logTimeBatch(client, {
      project: "Mobile App",
      entries: [
        { task: "100", dated_on: "2026-04-20", hours: "2.0" },
      ],
    });

    expect(result).toContain("FAILED");
    expect(result).toMatch(/different project/);
  });
});
