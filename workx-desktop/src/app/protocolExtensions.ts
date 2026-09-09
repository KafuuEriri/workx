import type { Project } from '@protocol/v2/Project';
import type { Thread } from '@protocol/v2/Thread';

export interface ProjectListResponse {
  data: Project[];
  nextCursor: string | null;
}

export interface ProjectCreateResponse {
  project: Project;
}

export interface ProjectUpdateResponse {
  project: Project;
}

export interface ProjectDeleteResponse {
  [key: string]: never;
}

export interface ThreadSearchResponse {
  data: Array<{ thread: Thread; snippet: string }>;
  nextCursor: string | null;
}
