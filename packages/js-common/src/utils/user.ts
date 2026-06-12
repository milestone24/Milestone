export const getEndpointPathWithUserId = (path: string, userId: string) => {
  return path.replace("{userId}", userId);
};
