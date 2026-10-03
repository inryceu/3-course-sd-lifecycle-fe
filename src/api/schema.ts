import type { components } from './api.generated';

type Schemas = components['schemas'];

export type User = Schemas['User'];
export type AuthResponse = Schemas['AuthResponse'];
export type RegisterRequest = Schemas['RegisterRequest'];
export type LoginRequest = Schemas['LoginRequest'];
export type Board = Schemas['Board'];
export type BoardDetail = Schemas['BoardDetail'];
export type BoardRole = Schemas['BoardRole'];
export type Column = Schemas['Column'];
export type ColumnWithCards = Schemas['ColumnWithCards'];
export type ColumnType = Schemas['ColumnType'];
export type Card = Schemas['Card'];
export type Label = Schemas['Label'];
export type Comment = Schemas['Comment'];
export type Member = Schemas['Member'];
export type JiraConnectionStatus = Schemas['JiraConnectionStatus'];
export type JiraOAuthStartResponse = Schemas['JiraOAuthStartResponse'];
export type JiraOAuthCallbackResponse = Schemas['JiraOAuthCallbackResponse'];
export type JiraMapping = Schemas['JiraMapping'];
export type Notification = Schemas['Notification'];
