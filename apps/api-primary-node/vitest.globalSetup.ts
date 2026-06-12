import type { TestProject } from "vitest/node";

const getTimestamp = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();
  return `${year}${month}${day}${hour}${minute}${second}`;
};

async function createBranch() {
  const { createApiClient, EndpointType } = await import(
    "@neondatabase/api-client"
  );
  const apiClient = createApiClient({
    apiKey: process.env.NEON_API_KEY!,
  });

  const projectId = "floral-flower-03109848";

  const branchName = `test-branch-${getTimestamp()}`;

  const response = await apiClient.createProjectBranch(projectId, {
    branch: {
      name: branchName,
    },
    endpoints: [
      {
        type: EndpointType.ReadWrite,
      },
    ],
  });

  const branchId = response.data.branch.id;

  if (!response.data.connection_uris || response.data.endpoints.length === 0) {
    throw new Error("No connection URIs found");
  }

  const connectionUri = response.data.connection_uris[0];

  if (!connectionUri) {
    throw new Error("No connection URI found");
  }

  const databaseUrl = response.data.connection_uris[0]?.connection_uri;

  if (!databaseUrl) {
    throw new Error("No database URL found");
  }

  process.env.DATABASE_URL = databaseUrl;

  return {
    projectId,
    branchId,
    databaseUrl,
    apiClient,
  };
}

export default async function setup(_project: TestProject) {
  let projectId: string | undefined = undefined;
  let branchId: string | undefined = undefined;
  let apiClient: Awaited<ReturnType<typeof import("@neondatabase/api-client").createApiClient>> | undefined =
    undefined;

  try {
    if (process.env.VITEST_USE_BRANCH === "true") {
      const branch = await createBranch();
      projectId = branch.projectId;
      branchId = branch.branchId;
      apiClient = branch.apiClient;
    }
  } catch (error) {
    console.error("Error creating branch:", error);
    if (projectId && branchId && apiClient) {
      await apiClient.deleteProjectBranch({ projectId, branchId });
    }
    throw error;
  }

  return async () => {
    try {
      if (projectId && branchId && apiClient) {
        await apiClient.deleteProjectBranch({ projectId, branchId });
      }
    } catch (error) {
      console.error("Error deleting branch:", error);
    }
  };
}
