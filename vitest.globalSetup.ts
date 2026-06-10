import { createApiClient, EndpointType, type BranchResponse } from '@neondatabase/api-client';
import type { TestProject } from 'vitest/node';
import { createDatabaseConnection } from '@milestone/data';
const apiClient = createApiClient({
  apiKey: process.env.NEON_API_KEY!,
});
// async function listNeonProjects() {
//   try {
//     // Get the user's organizations
//     const orgsResponse = await apiClient.getCurrentUserOrganizations();
//     const orgId = orgsResponse.data.organizations[0].id;
//     // List projects within the org
//     const response = await apiClient.listProjects({ org_id: orgId });
//     console.log(response.data.projects);
//   } catch (error) {
//     console.error('Error listing projects:', error);
//   }
// }
// listNeonProjects();


const getTimestamp = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();
  return `${year}${month}${day}${hour}${minute}${second}`;
}


async function createBranch() {
  const projectId = "floral-flower-03109848"

  const branchName = `test-branch-${getTimestamp()}`;

  let branchId: string | undefined = undefined;

  const response = await apiClient.createProjectBranch(projectId, {
    branch: {
      name: branchName,
    },
    endpoints: [
      {
        type: EndpointType.ReadWrite,
      }
    ]
  });

  branchId = response.data.branch.id;

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

  // Set the database URL to the environment variable
  process.env.DATABASE_URL = databaseUrl;

  return {
    projectId,
    branchId,
    databaseUrl,
  }
}


export default async function setup(project: TestProject) {

  let projectId: string | undefined = undefined;
  let branchId: string | undefined = undefined;
  let databaseUrl: string | undefined = undefined;

  try {

    if (process.env.VITEST_USE_BRANCH === 'true') {
      const { projectId: newProjectId, branchId: newBranchId, databaseUrl: newDatabaseUrl } = await createBranch();
      projectId = newProjectId;
      branchId = newBranchId;
      databaseUrl = newDatabaseUrl;
    }

  } catch (error) {
    console.error('Error creating branch:', error);
    if (projectId && branchId) {
      await apiClient.deleteProjectBranch(projectId, branchId);
    }
    throw error;
  }

  return async () => {
    try {
      if (projectId && branchId) {
        await apiClient.deleteProjectBranch(projectId, branchId);
      }
    } catch (error) {
      console.error('Error deleting branch:', error);
    }
  }
}

