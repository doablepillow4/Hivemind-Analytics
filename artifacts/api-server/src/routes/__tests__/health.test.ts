import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import app from "../../app";

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  return {
    ...actual,
    pool: {
      query: vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] }),
    },
  };
});

describe("GET /api/healthz", () => {
  it("returns 200 with status ok when DB is reachable", async () => {
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(body.db).toBe("ok");
  });

  it("includes uptime (number) and timestamp (ISO string)", async () => {
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(typeof body.uptime).toBe("number");
    expect(typeof body.timestamp).toBe("string");
    expect(() => new Date(body.timestamp as string)).not.toThrow();
  });

  it("returns JSON content-type", async () => {
    const res = await request(app).get("/api/healthz");
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });
});

describe("unknown routes", () => {
  it("returns 404 for unrecognised paths", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
  });
});
