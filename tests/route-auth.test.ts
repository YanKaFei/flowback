import { beforeEach, describe, expect, it } from "vitest";
import { setDatabaseForTests } from "@/lib/db";
import { createDevUser, createSession } from "@/lib/auth";
import { createProject, createSource } from "@/lib/repo";
import { GET as listProjectsRoute } from "@/app/api/projects/route";
import {
  DELETE as deleteProjectRoute,
  GET as getProjectRoute,
} from "@/app/api/projects/[id]/route";
import { GET as getSourceImageRoute } from "@/app/api/sources/[id]/image/[index]/route";

function bearer(token: string): Request {
  return new Request("http://127.0.0.1:4317/api/projects", {
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("API auth boundary", () => {
  beforeEach(() => {
    setDatabaseForTests(":memory:");
  });

  it("rejects anonymous project reads", async () => {
    const response = await listProjectsRoute(
      new Request("http://127.0.0.1:4317/api/projects"),
    );
    expect(response.status).toBe(401);
  });

  it("returns only the session owner's projects", async () => {
    const alice = createDevUser("device-route-alice-12345678");
    const bob = createDevUser("device-route-bob-12345678");
    const aliceProject = createProject("Alice API 项目", alice.id);
    createProject("Bob API 项目", bob.id);
    const session = createSession(alice.id);

    const response = await listProjectsRoute(bearer(session.token));
    const body = (await response.json()) as { projects: Array<{ id: string; name: string }> };
    expect(response.status).toBe(200);
    expect(body.projects.map((p) => p.id)).toContain(aliceProject.id);
    expect(body.projects.every((p) => p.name !== "Bob API 项目")).toBe(true);
  });

  it("returns 404 for cross-user project and image reads", async () => {
    const alice = createDevUser("device-route-image-alice-12345678");
    const bob = createDevUser("device-route-image-bob-12345678");
    const project = createProject("Alice 图片项目", alice.id);
    const source = createSource({
      projectId: project.id,
      kind: "image",
      rawText: "",
      images: [],
      fileNames: [],
      mode: "demo",
      model: null,
    });
    const bobSession = createSession(bob.id);
    const bobRequest = bearer(bobSession.token);

    const projectResponse = await getProjectRoute(bobRequest, {
      params: Promise.resolve({ id: project.id }),
    });
    expect(projectResponse.status).toBe(404);

    const imageResponse = await getSourceImageRoute(bobRequest, {
      params: Promise.resolve({ id: source.id, index: "0" }),
    });
    expect(imageResponse.status).toBe(404);
  });

  it("allows only the owner to delete a project", async () => {
    const alice = createDevUser("device-route-delete-alice-12345678");
    const bob = createDevUser("device-route-delete-bob-12345678");
    const project = createProject("Alice 删除项目", alice.id);
    const bobSession = createSession(bob.id);
    const aliceSession = createSession(alice.id);

    const denied = await deleteProjectRoute(bearer(bobSession.token), {
      params: Promise.resolve({ id: project.id }),
    });
    expect(denied.status).toBe(404);

    const allowed = await deleteProjectRoute(bearer(aliceSession.token), {
      params: Promise.resolve({ id: project.id }),
    });
    expect(allowed.status).toBe(200);
    const gone = await getProjectRoute(bearer(aliceSession.token), {
      params: Promise.resolve({ id: project.id }),
    });
    expect(gone.status).toBe(404);
  });
});
