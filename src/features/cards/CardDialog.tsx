import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cardsApi, jiraApi } from '../../api/endpoints';
import type { Card, ColumnWithCards, Member, BoardDetail } from '../../api/schema';
import { ConfirmButton } from '../../components/ConfirmButton';
import { CardLabels } from './CardLabels';
import { CardComments } from './CardComments';

interface CardDialogProps {
  card: Card;
  columns: ColumnWithCards[];
  members: Member[];
  canEdit: boolean;
  onMove: (cardId: string, columnId: string) => void;
  onClose: () => void;
  onChanged: () => void;
}

function toDateInput(iso?: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

export function CardDialog({
  card,
  columns,
  members,
  canEdit,
  onMove,
  onClose,
  onChanged,
}: CardDialogProps) {
  const queryClient = useQueryClient();
  const boardQueryKey = ['board', card.boardId];

  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? '');
  const [deadline, setDeadline] = useState(toDateInput(card.deadline));

  const { data: jiraConn } = useQuery({
    queryKey: ['jira-connection', card.boardId],
    queryFn: () => jiraApi.connection(card.boardId),
    enabled: !!card.jiraIssueKey,
  });

  const updateCardInCache = (updater: (c: Card) => Card) => {
    const previous = queryClient.getQueryData<BoardDetail>(boardQueryKey);
    if (previous) {
      queryClient.setQueryData<BoardDetail>(boardQueryKey, {
        ...previous,
        columns: previous.columns.map((col) =>
          col.id === card.columnId
            ? { ...col, cards: col.cards.map((c) => (c.id === card.id ? updater(c) : c)) }
            : col
        ),
      });
    }
    return previous;
  };

  const save = useMutation({
    mutationFn: () =>
      cardsApi.update(card.id, {
        title: title.trim(),
        description: description.trim() || null,
        deadline: deadline ? new Date(`${deadline}T00:00:00`).toISOString() : null,
      }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: boardQueryKey });
      const previous = updateCardInCache((c) => ({
        ...c,
        title: title.trim(),
        description: description.trim() || null,
        deadline: deadline ? new Date(`${deadline}T00:00:00`).toISOString() : null,
      }));
      return { previous };
    },
    onError: (_err, _var, context) => {
      if (context?.previous) queryClient.setQueryData(boardQueryKey, context.previous);
    },
    onSettled: () => {
      onChanged();
      onClose();
    },
  });

  const assign = useMutation({
    mutationFn: (assigneeId: string | null) => cardsApi.assign(card.id, assigneeId),
    onMutate: async (assigneeId) => {
      await queryClient.cancelQueries({ queryKey: boardQueryKey });
      const previous = updateCardInCache((c) => ({ ...c, assigneeId }));
      return { previous };
    },
    onError: (_err, _var, context) => {
      if (context?.previous) queryClient.setQueryData(boardQueryKey, context.previous);
    },
    onSettled: onChanged,
  });

  const remove = useMutation({
    mutationFn: () => cardsApi.delete(card.id),
    onSuccess: () => {
      onChanged();
      onClose();
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (title.trim()) save.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Card ${card.title}`}
        className="card w-full max-w-2xl p-6 flex flex-col max-h-[90vh] overflow-y-auto scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <div className="flex gap-6 flex-col md:flex-row">
          <div className="flex-1 space-y-4">
            {card.jiraIssueKey && (
              <div className="mb-2">
                {jiraConn?.siteUrl ? (
                  <a
                    href={`${jiraConn.siteUrl}/browse/${card.jiraIssueKey}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded"
                  >
                    🔗 {card.jiraIssueKey}
                  </a>
                ) : (
                  <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    Jira: {card.jiraIssueKey}
                  </span>
                )}
              </div>
            )}

            <form id="card-form" onSubmit={onSubmit} className="space-y-3">
              <div>
                <label className="label" htmlFor="card-title">
                  Title
                </label>
                <input
                  id="card-title"
                  className="input font-semibold text-lg"
                  maxLength={255}
                  disabled={!canEdit}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="card-description">
                  Description
                </label>
                <textarea
                  id="card-description"
                  className="input min-h-[8rem]"
                  maxLength={10000}
                  disabled={!canEdit}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </form>

            <CardLabels card={card} canEdit={canEdit} />

            <CardComments cardId={card.id} canEdit={canEdit} members={members} />
          </div>

          <div className="w-full md:w-64 space-y-4 shrink-0 bg-gray-50 p-4 rounded-lg h-fit">
            <div>
              <label className="label text-xs" htmlFor="card-column">
                Column
              </label>
              <select
                id="card-column"
                className="input text-sm"
                disabled={!canEdit}
                value={card.columnId}
                onChange={(e) => {
                  onMove(card.id, e.target.value);
                  onClose();
                }}
              >
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-xs" htmlFor="card-assignee">
                Assignee
              </label>
              <select
                id="card-assignee"
                className="input text-sm"
                disabled={!canEdit || assign.isPending}
                value={card.assigneeId ?? ''}
                onChange={(e) => assign.mutate(e.target.value || null)}
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-xs" htmlFor="card-deadline">
                Deadline
              </label>
              <input
                id="card-deadline"
                type="date"
                className="input text-sm"
                disabled={!canEdit}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 mt-4 border-t shrink-0">
          <div>
            {canEdit && <ConfirmButton label="Delete card" onConfirm={() => remove.mutate()} />}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={onClose}>
              Close
            </button>
            {canEdit && (
              <button
                type="submit"
                form="card-form"
                className="btn-primary text-sm"
                disabled={!title.trim() || save.isPending}
              >
                Save
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
