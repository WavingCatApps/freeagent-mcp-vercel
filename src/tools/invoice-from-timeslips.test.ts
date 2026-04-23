import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FreeAgentApiClient } from "../services/api-client.js";
import { invoiceFromTimeslips } from "./invoice-from-timeslips.js";

interface Call {
  method: "get" | "post" | "put";
  path: string;
  params?: unknown;
  body?: unknown;
}

function makeClient(handlers: {
  get?: (path: string, params?: unknown) => unknown;
  post?: (path: string, body?: unknown) => unknown;
  put?: (path: string, body?: unknown) => unknown | Error;
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
      return { data, headers: {} };
    }),
    put: vi.fn(async (path: string, body?: unknown) => {
      calls.push({ method: "put", path, body });
      const data = handlers.put?.(path, body);
      if (data instanceof Error) throw data;
      return { data, headers: {} };
    }),
  } as unknown as FreeAgentApiClient;
  return { client, calls };
}

const contactUrl = "https://api.freeagent.com/v2/contacts/1";
const projectUrl = "https://api.freeagent.com/v2/projects/10";
const taskAUrl = "https://api.freeagent.com/v2/tasks/100";
const taskBUrl = "https://api.freeagent.com/v2/tasks/101";

const contact = {
  url: contactUrl,
  organisation_name: "Acme Ltd",
};

const project = {
  url: projectUrl,
  contact: contactUrl,
  name: "Website Redesign",
  status: "Active",
  normal_billing_rate: "100.00",
  billing_period: "hour",
  is_ir35: false,
  budget: "0",
  budget_units: "Hours",
};

describe("invoiceFromTimeslips", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("groups timeslips by task, applies task or project rates, and drafts an invoice", async () => {
    const { client, calls } = makeClient({
      get: (path, params) => {
        if (path === "/contacts" && params) {
          return { contacts: [contact] };
        }
        if (path === "/projects" && params) {
          return { projects: [project] };
        }
        if (path === "/timeslips") {
          return {
            timeslips: [
              { url: "/timeslips/1", user: "u/1", project: projectUrl, task: taskAUrl, dated_on: "2026-04-01", hours: "3.0", comment: "Sprint planning" },
              { url: "/timeslips/2", user: "u/1", project: projectUrl, task: taskAUrl, dated_on: "2026-04-02", hours: "2.5", comment: "Backlog refinement" },
              { url: "/timeslips/3", user: "u/1", project: projectUrl, task: taskBUrl, dated_on: "2026-04-03", hours: "4.0" },
              { url: "/timeslips/4", user: "u/1", project: projectUrl, task: taskBUrl, dated_on: "2026-04-04", hours: "1.5" },
            ],
          };
        }
        if (path === taskAUrl) {
          return { task: { url: taskAUrl, project: projectUrl, name: "Discovery", is_billable: true, billing_rate: "120.00", status: "Active" } };
        }
        if (path === taskBUrl) {
          return { task: { url: taskBUrl, project: projectUrl, name: "Implementation", is_billable: true, status: "Active" } };
        }
      },
      post: () => ({
        invoice: {
          url: "https://api.freeagent.com/v2/invoices/999",
          contact: contactUrl,
          dated_on: "2026-04-23",
          currency: "GBP",
          total_value: "1210.00",
          net_value: "1210.00",
          sales_tax_value: "0.00",
          status: "Draft",
        },
      }),
    });

    const result = await invoiceFromTimeslips(client, { contact: "Acme Ltd", link_timeslips: false });

    expect(result).toContain("Drafted invoice 999");
    expect(result).toContain("11.00");

    const post = calls.find((c) => c.method === "post");
    const body = post?.body as { invoice: { invoice_items: unknown[] } };
    expect(body.invoice.invoice_items).toEqual([
      {
        item_type: "Hours",
        description: expect.stringContaining("Discovery"),
        price: "120.00",
        quantity: "5.50",
      },
      {
        item_type: "Hours",
        description: "Implementation",
        price: "100.00",
        quantity: "5.50",
      },
    ]);
  });

  it("uses sensible default date range when none provided", async () => {
    const { client, calls } = makeClient({
      get: (path) => {
        if (path === "/contacts") return { contacts: [contact] };
        if (path === "/projects") return { projects: [project] };
        if (path === "/timeslips") return { timeslips: [] };
      },
    });

    await expect(
      invoiceFromTimeslips(client, { contact: "Acme Ltd", link_timeslips: false })
    ).rejects.toThrow(/No unbilled timeslips/);

    const timeslipCall = calls.find((c) => c.path === "/timeslips");
    expect(timeslipCall?.params).toMatchObject({
      from_date: "2026-03-01",
      to_date: "2026-04-23",
      view: "unbilled",
    });
  });

  it("errors when all timeslips are on non-billable tasks", async () => {
    const { client } = makeClient({
      get: (path) => {
        if (path === "/contacts") return { contacts: [contact] };
        if (path === "/projects") return { projects: [project] };
        if (path === "/timeslips") {
          return {
            timeslips: [
              { url: "/timeslips/1", user: "u/1", project: projectUrl, task: taskAUrl, dated_on: "2026-04-01", hours: "3.0" },
            ],
          };
        }
        if (path === taskAUrl) {
          return { task: { url: taskAUrl, project: projectUrl, name: "Internal", is_billable: false, status: "Active" } };
        }
      },
    });

    await expect(
      invoiceFromTimeslips(client, { contact: "Acme Ltd", link_timeslips: false })
    ).rejects.toThrow(/non-billable/);
  });

  it("rejects a project that belongs to a different contact", async () => {
    const { client } = makeClient({
      get: (path) => {
        if (path === "/contacts") return { contacts: [contact] };
        if (path === "/projects/10") {
          return {
            project: { ...project, contact: "https://api.freeagent.com/v2/contacts/999" },
          };
        }
      },
    });

    await expect(
      invoiceFromTimeslips(client, { contact: "Acme Ltd", project: "10", link_timeslips: false })
    ).rejects.toThrow(/different contact/);
  });

  it("links timeslips to the invoice when link_timeslips=true", async () => {
    const { client, calls } = makeClient({
      get: (path) => {
        if (path === "/contacts") return { contacts: [contact] };
        if (path === "/projects") return { projects: [project] };
        if (path === "/timeslips") {
          return {
            timeslips: [
              { url: "https://api.freeagent.com/v2/timeslips/1", user: "u/1", project: projectUrl, task: taskAUrl, dated_on: "2026-04-01", hours: "3.0" },
              { url: "https://api.freeagent.com/v2/timeslips/2", user: "u/1", project: projectUrl, task: taskAUrl, dated_on: "2026-04-02", hours: "2.0" },
            ],
          };
        }
        if (path === taskAUrl) {
          return { task: { url: taskAUrl, project: projectUrl, name: "Discovery", is_billable: true, billing_rate: "100.00", status: "Active" } };
        }
      },
      post: () => ({
        invoice: {
          url: "https://api.freeagent.com/v2/invoices/777",
          contact: contactUrl,
          dated_on: "2026-04-23",
          currency: "GBP",
          total_value: "500.00",
          net_value: "500.00",
          sales_tax_value: "0.00",
          status: "Draft",
        },
      }),
      put: () => ({ timeslip: { billed_on_invoice: "https://api.freeagent.com/v2/invoices/777" } }),
    });

    const result = await invoiceFromTimeslips(client, {
      contact: "Acme Ltd",
      link_timeslips: true,
    });

    const puts = calls.filter((c) => c.method === "put");
    expect(puts).toHaveLength(2);
    expect(puts[0].path).toBe("https://api.freeagent.com/v2/timeslips/1");
    expect(puts[0].body).toMatchObject({
      timeslip: { billed_on_invoice: "https://api.freeagent.com/v2/invoices/777" },
    });
    expect(result).toContain("Linked 2 timeslip(s)");
  });

  it("surfaces timeslip link failures without failing the whole tool", async () => {
    let putCount = 0;
    const { client } = makeClient({
      get: (path) => {
        if (path === "/contacts") return { contacts: [contact] };
        if (path === "/projects") return { projects: [project] };
        if (path === "/timeslips") {
          return {
            timeslips: [
              { url: "https://api.freeagent.com/v2/timeslips/1", user: "u/1", project: projectUrl, task: taskAUrl, dated_on: "2026-04-01", hours: "3.0" },
              { url: "https://api.freeagent.com/v2/timeslips/2", user: "u/1", project: projectUrl, task: taskAUrl, dated_on: "2026-04-02", hours: "2.0" },
            ],
          };
        }
        if (path === taskAUrl) {
          return { task: { url: taskAUrl, project: projectUrl, name: "Discovery", is_billable: true, billing_rate: "100.00", status: "Active" } };
        }
      },
      post: () => ({
        invoice: {
          url: "https://api.freeagent.com/v2/invoices/777",
          contact: contactUrl,
          dated_on: "2026-04-23",
          currency: "GBP",
          total_value: "500.00",
          net_value: "500.00",
          sales_tax_value: "0.00",
          status: "Draft",
        },
      }),
      put: () => {
        putCount++;
        return putCount === 1
          ? { timeslip: { billed_on_invoice: "https://api.freeagent.com/v2/invoices/777" } }
          : new Error("Validation error: billed_on_invoice: field is read-only");
      },
    });

    const result = await invoiceFromTimeslips(client, {
      contact: "Acme Ltd",
      link_timeslips: true,
    });

    expect(result).toContain("Linked 1 of 2 timeslip(s)");
    expect(result).toContain("read-only");
  });

  it("passes discount_percent through to the invoice payload", async () => {
    const { client, calls } = makeClient({
      get: (path) => {
        if (path === "/contacts") return { contacts: [contact] };
        if (path === "/projects") return { projects: [project] };
        if (path === "/timeslips") {
          return {
            timeslips: [
              { url: "/timeslips/1", user: "u/1", project: projectUrl, task: taskAUrl, dated_on: "2026-04-01", hours: "3.0" },
            ],
          };
        }
        if (path === taskAUrl) {
          return { task: { url: taskAUrl, project: projectUrl, name: "Discovery", is_billable: true, billing_rate: "100.00", status: "Active" } };
        }
      },
      post: () => ({
        invoice: {
          url: "https://api.freeagent.com/v2/invoices/888",
          contact: contactUrl,
          dated_on: "2026-04-23",
          currency: "GBP",
          total_value: "240.00",
          net_value: "240.00",
          sales_tax_value: "0.00",
          status: "Draft",
          discount_percent: "20",
        },
      }),
    });

    await invoiceFromTimeslips(client, {
      contact: "Acme Ltd",
      link_timeslips: false,
      discount_percent: "20",
    });

    const post = calls.find((c) => c.method === "post");
    expect(post?.body).toMatchObject({
      invoice: { discount_percent: "20" },
    });
  });

  it("errors if a task has no rate and project has no normal_billing_rate", async () => {
    const { client } = makeClient({
      get: (path) => {
        if (path === "/contacts") return { contacts: [contact] };
        if (path === "/projects") {
          return { projects: [{ ...project, normal_billing_rate: undefined }] };
        }
        if (path === "/timeslips") {
          return {
            timeslips: [
              { url: "/timeslips/1", user: "u/1", project: projectUrl, task: taskAUrl, dated_on: "2026-04-01", hours: "3.0" },
            ],
          };
        }
        if (path === taskAUrl) {
          return { task: { url: taskAUrl, project: projectUrl, name: "Discovery", is_billable: true, status: "Active" } };
        }
      },
    });

    await expect(
      invoiceFromTimeslips(client, { contact: "Acme Ltd", link_timeslips: false })
    ).rejects.toThrow(/no billing rate/);
  });
});
