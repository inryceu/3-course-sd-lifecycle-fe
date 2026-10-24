import { useQuery } from '@tanstack/react-query';
import { membersApi } from '../../api/endpoints';

/** Query key shared by the members panel and the card dialog's assignee select. */
export const membersKey = (boardId: string) => ['members', boardId];

export function useMembers(boardId: string) {
  return useQuery({ queryKey: membersKey(boardId), queryFn: () => membersApi.list(boardId) });
}
