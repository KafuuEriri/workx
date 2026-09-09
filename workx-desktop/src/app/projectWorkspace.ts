import type { Project } from '@protocol/v2/Project';

export function projectWorkspaceRoots(projects: Project[], projectId: string | null): string[] | undefined {
  const project = projects.find((candidate) => candidate.id === projectId);
  return project ? [...new Set(project.roots.map((root) => root.path))] : undefined;
}
