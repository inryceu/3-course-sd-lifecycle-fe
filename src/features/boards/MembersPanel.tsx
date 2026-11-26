import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { membersApi } from '../../api/endpoints';
import type { BoardRole, Member } from '../../api/schema';
import { ConfirmButton } from '../../components/ConfirmButton';
import { useAuth } from '../auth';
import { membersKey, useMembers } from './use-members';

const ROLES: BoardRole[] = ['ADMIN', 'MEMBER', 'VIEWER'];
type InviteRole = 'MEMBER' | 'VIEWER';

/** Members and roles of a board; the Admin can invite, change roles and remove. */
export function MembersPanel({ boardId, isAdmin }: { boardId: string; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('MEMBER');
  const { data: members, isLoading, isError } = useMembers(boardId);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: membersKey(boardId) });
  // `isAdmin` comes from the cached board (myRole); refetch it so a changed role, or a 403 from a
  // stale one, takes the Admin controls away at once.
  const refreshBoard = () => void queryClient.invalidateQueries({ queryKey: ['board', boardId] });
  const soleAdminId =
    members?.filter((m) => m.role === 'ADMIN').length === 1
      ? members.find((m) => m.role === 'ADMIN')?.userId
      : undefined;
  const soleAdminReason = 'Cannot change or remove the only Admin of the board';

  // Errors (unknown e-mail, last Admin, ...) are shown by the API client's toast.
  const invite = useMutation({
    mutationFn: () => membersApi.invite(boardId, { email: email.trim(), role }),
    onSuccess: () => {
      setEmail('');
      refresh();
    },
    onError: refreshBoard,
  });
  const changeRole = useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: BoardRole }) =>
      membersApi.changeRole(boardId, userId, newRole),
    onSettled: () => {
      refresh();
      refreshBoard();
    },
  });
  const remove = useMutation({
    mutationFn: (userId: string) => membersApi.remove(boardId, userId),
    onSettled: refresh,
  });

  const onInvite = (event: FormEvent) => {
    event.preventDefault();
    if (email.trim()) invite.mutate();
  };

  return (
    <section aria-label="Board members" className="card p-4 mb-4">
      <h2 className="font-semibold mb-2">Members</h2>
      {isLoading && <p role="status" className="text-sm text-gray-500">
          Loading members...
        </p>}
      {isError && (
        <p role="alert" className="text-sm text-red-600">
          Could not load members.{' '}
          <button type="button" className="underline" onClick={refresh}>
            Retry
          </button>
        </p>
      )}
      <ul className="divide-y divide-gray-100">
        {members?.map((member: Member) => (
          <li key={member.userId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span>
              <span className="font-medium">{member.displayName}</span>{' '}
              <span className="text-gray-500">{member.email}</span>
              {member.userId === user?.id && <span className="text-gray-400"> (you)</span>}
            </span>
            {isAdmin ? (
              <span className="flex items-center gap-2">
                <select
                  aria-label={`Role of ${member.displayName}`}
                  className="input py-1 text-sm w-32"
                  value={member.role}
                  disabled={member.userId === soleAdminId}
                  title={member.userId === soleAdminId ? soleAdminReason : undefined}
                  onChange={(e) =>
                    changeRole.mutate({
                      userId: member.userId,
                      newRole: e.target.value as BoardRole,
                    })
                  }
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <ConfirmButton
                  label="Remove"
                  ariaLabel={`Remove ${member.displayName}`}
                  disabled={member.userId === soleAdminId}
                  title={member.userId === soleAdminId ? soleAdminReason : undefined}
                  className="btn-secondary text-xs px-2 py-1"
                  onConfirm={() => remove.mutate(member.userId)}
                />
              </span>
            ) : (
              <span className="text-xs text-gray-500">{member.role}</span>
            )}
          </li>
        ))}
      </ul>
      {!isLoading && !isError && members?.length === 0 && (
        <p className="text-sm text-gray-500">No members.</p>
      )}
      {isAdmin && (
        <form onSubmit={onInvite} className="flex flex-wrap gap-2 mt-3" aria-label="Invite member">
          <input
            aria-label="E-mail of a registered user"
            type="email"
            className="input text-sm flex-1 min-w-[12rem]"
            placeholder="E-mail of a registered user"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select
            aria-label="Invite as"
            className="input text-sm w-32"
            value={role}
            onChange={(e) => setRole(e.target.value as InviteRole)}
          >
            <option value="MEMBER">MEMBER</option>
            <option value="VIEWER">VIEWER</option>
          </select>
          <button
            type="submit"
            className="btn-primary text-sm"
            disabled={!email.trim() || invite.isPending}
          >
            Invite
          </button>
        </form>
      )}
    </section>
  );
}
