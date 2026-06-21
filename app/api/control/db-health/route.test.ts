import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { requireControlPlaneSessionMock, queryTenantLocalDbMock } = vi.hoisted(() => ({
  requireControlPlaneSessionMock: vi.fn(),
  queryTenantLocalDbMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireControlPlaneSession: requireControlPlaneSessionMock,
}));

vi.mock("@/lib/supabase/tenant", () => ({
  queryTenantLocalDb: queryTenantLocalDbMock,
}));

describe("GET /api/control/db-health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks for control plane session and returns DB statistics", async () => {
    requireControlPlaneSessionMock.mockResolvedValue({ canAccessControl: true });
    queryTenantLocalDbMock.mockResolvedValue({
      rows: [
        { count: 3, state: "active" },
        { count: 2, state: "idle" },
      ],
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(requireControlPlaneSessionMock).toHaveBeenCalledWith("/control/db-health");
    expect(queryTenantLocalDbMock).toHaveBeenCalledWith(
      expect.stringContaining("SELECT count(*)::integer as count, state FROM pg_stat_activity")
    );
    expect(body).toEqual({
      ok: true,
      activeConnections: 5,
      states: [
        { count: 3, state: "active" },
        { count: 2, state: "idle" },
      ],
    });
  });
  it("propagates NEXT_REDIRECT errors thrown by requireControlPlaneSession", async () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;...",
    });
    requireControlPlaneSessionMock.mockRejectedValue(redirectError);

    await expect(GET()).rejects.toThrow("NEXT_REDIRECT");
    expect(queryTenantLocalDbMock).not.toHaveBeenCalled();
  });

  it("returns 500 when database query throws an error", async () => {
    requireControlPlaneSessionMock.mockResolvedValue({ canAccessControl: true });
    queryTenantLocalDbMock.mockRejectedValue(new Error("Connection timeout"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "Failed to retrieve database health",
    });
  });
});
