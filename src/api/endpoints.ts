import { api } from './client';
import type { User, Board, Card, Column, Label, Comment, JiraIssueMapping, SyncLog, AuthTokens, LoginCredentials, RegisterData } from '../types';

export const authApi = {
  login: (credentials: LoginCredentials) =>
    api.post<AuthTokens>('/auth/login', credentials),

  register: (data: RegisterData) =>
    api.post<AuthTokens>('/auth/register', data),

  refresh: (refreshToken: string) =>
    api.post<AuthTokens>('/auth/refresh', { refreshToken }),

  logout: () =>
    api.post<void>('/auth/logout', {}),

  getProfile: () =>
    api.get<User>('/auth/profile'),
};

export const boardsApi = {
  list: () =>
    api.get<Board[]>('/boards'),

  get: (id: string) =>
    api.get<Board>(`/boards/${id}`),

  create: (data: { title: string; jiraProjectKey?: string }) =>
    api.post<Board>('/boards', data),

  update: (id: string, data: { title?: string; jiraProjectKey?: string }) =>
    api.patch<Board>(`/boards/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/boards/${id}`),

  inviteMember: (boardId: string, email: string, role: string) =>
    api.post<void>(`/boards/${boardId}/members`, { email, role }),
};

export const columnsApi = {
  listByBoard: (boardId: string) =>
    api.get<Column[]>(`/boards/${boardId}/columns`),

  create: (boardId: string, data: { title: string; type: string }) =>
    api.post<Column>(`/boards/${boardId}/columns`, data),

  update: (id: string, data: { title?: string; type?: string; position?: number }) =>
    api.patch<Column>(`/columns/${id}`, data),

  reorder: (id: string, position: number) =>
    api.patch<Column>(`/columns/${id}/reorder`, { position }),

  delete: (id: string) =>
    api.delete<void>(`/columns/${id}`),
};

export const cardsApi = {
  listByColumn: (columnId: string) =>
    api.get<Card[]>(`/columns/${columnId}/cards`),

  get: (id: string) =>
    api.get<Card>(`/cards/${id}`),

  create: (columnId: string, data: { title: string; description?: string; labelIds?: string[]; deadline?: string }) =>
    api.post<Card>(`/columns/${columnId}/cards`, data),

  update: (id: string, data: Partial<Card>) =>
    api.patch<Card>(`/cards/${id}`, data),

  move: (id: string, columnId: string, position: number) =>
    api.patch<Card>(`/cards/${id}/move`, { columnId, position }),

  delete: (id: string) =>
    api.delete<void>(`/cards/${id}`),
};

export const labelsApi = {
  list: () =>
    api.get<Label[]>('/labels'),

  create: (data: { name: string; color: string }) =>
    api.post<Label>('/labels', data),

  update: (id: string, data: { name?: string; color?: string }) =>
    api.patch<Label>(`/labels/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/labels/${id}`),
};

export const jiraSyncApi = {
  listMappings: (boardId: string) =>
    api.get<JiraIssueMapping[]>(`/jira-sync/board/${boardId}`),

  getMapping: (cardId: string) =>
    api.get<JiraIssueMapping>(`/jira-sync/card/${cardId}`),

  createMapping: (data: { boardId: string; cardId: string; jiraIssueKey: string; jiraIssueId: string; jiraProjectKey: string }) =>
    api.post<JiraIssueMapping>('/jira-sync/map', data),

  syncCard: (cardId: string) =>
    api.post<void>(`/jira-sync/sync/${cardId}`, {}),

  getSyncLogs: (boardId: string) =>
    api.get<SyncLog[]>(`/jira-sync/board/${boardId}/logs`),
};