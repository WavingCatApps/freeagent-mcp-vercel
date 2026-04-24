import { describe, it, expect, vi } from "vitest";
import type { FreeAgentApiClient } from "../services/api-client.js";
import { createTaskAndLogTime } from "./create-task-and-log-time.js";

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

const project = {
  url: "https://api.freeagent.com/v2/projects/10",
  contact: "https://api.freeagent.com/v2/contacts/1",
  name: "Website Redesign",
  status: "Active",
  normal_billing_rate: "100.00",
  billing_period: "hour",
  is_ir35: false,
  budget: "0",
  budget_units: "Hours",
};

const createdTask = {
  url: "https://api.freeagent.com/v2/tasks/500",
  project: project.url,
  name: "Discovery",
  status: "Active",
  is_billable: true,
  billing_rate: "120.00",
  billing_period: "hour",
};

describe("createTaskAndLogTime", () => {
  it("resolves project by name, creates a task, and posts a timeslip per entry", async () => {
    let timeslipId = 900;
    const { client, calls } = makeClient({
      get: (path) => {
        if (path === "/users") return { users: [soleUser] };
        if (path === "/projects") return { projects: [project] };
      },
      post: (path, body) => {
        if (path === "/tasks") return { task: createdTask };
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

    const result = await createTaskAndLogTime(client, {
      project: "Website Redesign",
      task_name: "Discovery",
      is_billable: true,
      billing_rate: "120.00",
      billing_period: "hour",
      status: "Active",
      entries: [
        { dated_on: "2026-04-20", hours: "3.0", comment: "Kickoff call" },
        { dated_on: "2026-04-21", hours: "4.5" },
      ],
    });

    expect(result).toContain("Created task 500 and logged 2 timeslip(s)");
    expect(result).toContain("7.50");
    expect(result).toContain("2026-04-20: 3.0h");
    expect(result).toContain("2026-04-21: 4.5h");

    const taskPost = calls.find((c) => c.method === "post" && c.path === "/tasks");
    expect(taskPost?.body).toMatchObject({
      task: {
        project: project.url,
        name: "Discovery",
        is_billable: true,
        status: "Active",
        billing_rate: "120.00",
        billing_period: "hour",
      },
    });

    const timeslipPosts = calls.filter((c) => c.method === "post" && c.path === "/timeslips");
    expect(timeslipPosts).toHaveLength(2);
    expect(timeslipPosts[0].body).toMatchObject({
      timeslip: {
        task: createdTask.url,
        user: soleUser.url,
        project: project.url,
        dated_on: "2026-04-20",
        hours: "3.0",
        comment: "Kickoff call",
      },
    });
    expect(timeslipPosts[1].body).toMatchObject({
      timeslip: {
        task: createdTask.url,
        dated_on: "2026-04-21",
        hours: "4.5",
      },
    });
    expect((timeslipPosts[1].body as { timeslip: Record<string, unknown> }).timeslip).not.toHaveProperty("comment");
  });

  it("passes a project URL through without a list call", async () => {
    const { client, calls } = makeClient({
      get: (path) => {
        if (path === "/users") return { users: [soleUser] };
      },
      post: (path) => {
        if (path === "/tasks") return { task: createdTask };
        if (path === "/timeslips") {
          return {
            timeslip: {
              url: "https://api.freeagent.com/v2/timeslips/901",
              user: soleUser.url,
              project: project.url,
              task: createdTask.url,
              dated_on: "2026-04-20",
              hours: "1.0",
            },
          };
        }
      },
    });

    await createTaskAndLogTime(client, {
      project: project.url,
      task_name: "Discovery",
      is_billable: true,
      status: "Active",
      entries: [{ dated_on: "2026-04-20", hours: "1.0" }],
    });

    expect(calls.some((c) => c.path === "/projects")).toBe(false);
  });

  it("reports per-entry timeslip failures without rolling back the task", async () => {
    let timeslipCallCount = 0;
    const { client } = makeClient({
      get: (path) => {
        if (path === "/users") return { users: [soleUser] };
        if (path === "/projects") return { projects: [project] };
      },
      post: (path) => {
        if (path === "/tasks") return { task: createdTask };
        if (path === "/timeslips") {
          timeslipCallCount += 1;
          if (timeslipCallCount === 2) {
            return new Error("Validation error: hours must be positive");
          }
          return {
            timeslip: {
              url: `https://api.freeagent.com/v2/timeslips/90${timeslipCallCount}`,
              user: soleUser.url,
              project: project.url,
              task: createdTask.url,
              dated_on: "2026-04-20",
              hours: "3.0",
            },
          };
        }
      },
    });

    const result = await createTaskAndLogTime(client, {
      project: "Website Redesign",
      task_name: "Discovery",
      is_billable: true,
      status: "Active",
      entries: [
        { dated_on: "2026-04-20", hours: "3.0" },
        { dated_on: "2026-04-21", hours: "-1.0" },
      ],
    });

    expect(result).toContain("Created task 500; logged 1 of 2 timeslip(s)");
    expect(result).toContain("hours must be positive");
    expect(result).toContain("3.00");
  });

  it("errors when there are multiple users and none specified", async () => {
    const { client } = makeClient({
      get: (path) => {
        if (path === "/users") {
          return {
            users: [
              soleUser,
              { ...soleUser, url: "https://api.freeagent.com/v2/users/2", email: "b@example.com" },
            ],
          };
        }
        if (path === "/projects") return { projects: [project] };
      },
    });

    await expect(
      createTaskAndLogTime(client, {
        project: "Website Redesign",
        task_name: "Discovery",
        is_billable: true,
        status: "Active",
        entries: [{ dated_on: "2026-04-20", hours: "1.0" }],
      })
    ).rejects.toThrow(/pass the `user` parameter/);
  });

  it("errors helpfully when the project name doesn't match", async () => {
    const { client } = makeClient({
      get: (path) => {
        if (path === "/users") return { users: [soleUser] };
        if (path === "/projects") return { projects: [] };
      },
    });

    await expect(
      createTaskAndLogTime(client, {
        project: "Nonexistent",
        task_name: "Discovery",
        is_billable: true,
        status: "Active",
        entries: [{ dated_on: "2026-04-20", hours: "1.0" }],
      })
    ).rejects.toThrow(/No project matches "Nonexistent"/);
  });
});
