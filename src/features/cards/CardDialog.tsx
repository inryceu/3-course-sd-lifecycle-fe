import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { cardsApi } from '../../api/endpoints';
import type { Card, ColumnWithCards } from '../../api/schema';
import { ConfirmButton } from '../../components/ConfirmButton';

interface CardDialogProps {
  card: Card;
  columns: ColumnWithCards[];
  canEdit: boolean;
  onMove: (cardId: string, columnId: string) => void;
  onClose: () => void;
  onChanged: () => void;
}

/** `YYYY-MM-DD` for a date input, from an ISO timestamp. */
function toDateInput(iso?: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

export function CardDialog({
  card,
  columns,
  canEdit,
  onMove,
  onClose,
  onChanged,
}: CardDialogProps) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? '');
  const [deadline, setDeadline] = useState(toDateInput(card.deadline));

  const save = useMutation({
    mutationFn: () =>
      cardsApi.update(card.id, {
        title: title.trim(),
        description: description.trim() || null,
        deadline: deadline ? new Date(`${deadline}T00:00:00`).toISOString() : null,
      }),
    onSuccess: () => {
      onChanged();
      onClose();
    },
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
        className="card w-full max-w-lg p-5"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="label" htmlFor="card-title">
              Title
            </label>
            <input
              id="card-title"
              className="input"
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
              className="input min-h-[6rem]"
              maxLength={10000}
              disabled={!canEdit}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="card-deadline">
              Deadline
            </label>
            <input
              id="card-deadline"
              type="date"
              className="input"
              disabled={!canEdit}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="card-column">
              Column
            </label>
            <select
              id="card-column"
              className="input"
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
          {card.jiraIssueKey && (
            <p className="text-sm text-gray-600">Jira issue: {card.jiraIssueKey}</p>
          )}

          <div className="flex items-center justify-between pt-2">
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
                  className="btn-primary text-sm"
                  disabled={!title.trim() || save.isPending}
                >
                  Save
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
