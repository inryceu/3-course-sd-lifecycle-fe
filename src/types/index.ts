export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
}

export interface Board {
  id: string;
  title: string;
  jiraProjectKey: string | null;
  createdAt: string;
  updatedAt: string;
  columns: Column[];
}

export interface Column {
  id: string;
  title: string;
  type: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
  position: number;
  boardId: string;
  cards: Card[];
}

export interface Card {
  id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  jiraIssueKey: string | null;
  position: number;
  columnId: string;
  labels: Label[];
  assignee: User | null;
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface Comment {
  id: string;
  text: string;
  syncedToJira: boolean;
  createdAt: string;
  author: User;
}

export interface BoardMembership {
  id: string;
  boardId: string;
  userId: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  invitedAt: string;
}

export interface JiraIssueMapping {
  id: string;
  jiraIssueKey: string;
  jiraIssueId: string;
  jiraProjectKey: string;
  boardId: string;
  cardId: string | null;
}

export interface SyncLog {
  id: string;
  direction: 'TO_JIRA' | 'FROM_JIRA';
  status: 'SUCCESS' | 'FAILED' | 'CONFLICT';
  payload: Record<string, any> | null;
  errorMessage: string | null;
  mappingId: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  displayName: string;
}