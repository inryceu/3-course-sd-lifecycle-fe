import { api } from './client';
import type { RequestOptions } from './client';
import type { components } from './api.generated';
import type {
  AuthResponse,
  Board,
  BoardDetail,
  Card,
  Column,
  JiraConnectionStatus,
  JiraMapping,
  JiraOAuthCallbackResponse,
  JiraOAuthStartResponse,
  LoginRequest,
  RegisterRequest,
  User,
} from './schema';

type Schemas = components['schemas'];

/** Routes and shapes follow docs/api/openapi.yaml (synced from the backend). */

export const authApi = {
  login: (data: LoginRequest) => api.post<AuthResponse>('/auth/login', data, { silent: true }),

  register: (data: RegisterRequest) =>
    api.post<AuthResponse>('/auth/register', data, { silent: true }),

  me: (options?: RequestOptions) => api.get<User>('/auth/me', options),
};

export const boardsApi = {
  list: () => api.get<Board[]>('/boards'),

  get: (boardId: string) => api.get<BoardDetail>(`/boards/${boardId}`),

  create: (data: Schemas['CreateBoardRequest']) => api.post<BoardDetail>('/boards', data),

  update: (boardId: string, data: Schemas['UpdateBoardRequest']) =>
    api.patch<Board>(`/boards/${boardId}`, data),

  delete: (boardId: string) => api.delete<void>(`/boards/${boardId}`),
};

export const columnsApi = {
  listByBoard: (boardId: string) => api.get<Column[]>(`/boards/${boardId}/columns`),

  create: (boardId: string, data: Schemas['CreateColumnRequest']) =>
    api.post<Column>(`/boards/${boardId}/columns`, data),

  update: (columnId: string, data: Schemas['UpdateColumnRequest']) =>
    api.patch<Column>(`/columns/${columnId}`, data),

  reorder: (columnId: string, position: number) =>
    api.patch<Column[]>(`/columns/${columnId}/reorder`, { position }),

  delete: (columnId: string) => api.delete<void>(`/columns/${columnId}`),
};

export const cardsApi = {
  listByColumn: (columnId: string) => api.get<Card[]>(`/columns/${columnId}/cards`),

  get: (cardId: string) => api.get<Card>(`/cards/${cardId}`),

  create: (columnId: string, data: Schemas['CreateCardRequest']) =>
    api.post<Card>(`/columns/${columnId}/cards`, data),

  update: (cardId: string, data: Schemas['UpdateCardRequest']) =>
    api.patch<Card>(`/cards/${cardId}`, data),

  move: (cardId: string, data: Schemas['MoveCardRequest']) =>
    api.patch<Card>(`/cards/${cardId}/move`, data),

  delete: (cardId: string) => api.delete<void>(`/cards/${cardId}`),
};

export const jiraApi = {
  startOAuth: (boardId: string) =>
    api.get<JiraOAuthStartResponse>(`/jira/oauth/start?boardId=${encodeURIComponent(boardId)}`),

  completeOAuth: (params: { code?: string; state: string; error?: string }) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) query.set(key, value);
    });
    return api.get<JiraOAuthCallbackResponse>(`/jira/oauth/callback?${query.toString()}`);
  },

  connection: (boardId: string) =>
    api.get<JiraConnectionStatus>(`/jira/connection?boardId=${encodeURIComponent(boardId)}`),

  disconnect: (boardId: string) =>
    api.delete<void>(`/jira/connection?boardId=${encodeURIComponent(boardId)}`),

  listMappings: (boardId: string) =>
    api.get<JiraMapping[]>(`/jira/mappings?boardId=${encodeURIComponent(boardId)}`),
};
