import { useState } from 'react';
import type { DragEvent, FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { cardsApi, columnsApi } from '../../api/endpoints';
import type { Card, ColumnType, ColumnWithCards, Member } from '../../api/schema';
import { ConfirmButton } from '../../components/ConfirmButton';

const COLUMN_TYPES: ColumnType[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];

interface ColumnViewProps {
  column: ColumnWithCards;
  index: number;
  columnCount: number;
  canEditStructure: boolean;
  canEditCards: boolean;
  draggingCardId: string | null;
  onDragStart: (cardId: string | null) => void;
  onDrop: (columnId: string, beforeCardId: string | null) => void;
  members: Member[];
  onOpenCard: (card: Card) => void;
  onChanged: () => void;
}

export function ColumnView({
  column,
  index,
  columnCount,
  canEditStructure,
  canEditCards,
  draggingCardId,
  onDragStart,
  onDrop,
  members,
  onOpenCard,
  onChanged,
}: ColumnViewProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(column.title);
  const [type, setType] = useState<ColumnType>(column.type);
  const [newCard, setNewCard] = useState('');
  const [over, setOver] = useState(false);

  const update = useMutation({
    mutationFn: () => columnsApi.update(column.id, { title: title.trim(), type }),
    onSuccess: () => {
      setEditing(false);
      onChanged();
    },
  });
  const reorder = useMutation({
    mutationFn: (position: number) => columnsApi.reorder(column.id, position),
    onSettled: onChanged,
  });
  const remove = useMutation({
    mutationFn: () => columnsApi.delete(column.id),
    onSettled: onChanged,
  });
  const addCard = useMutation({
    mutationFn: (cardTitle: string) => cardsApi.create(column.id, { title: cardTitle }),
    onSuccess: () => {
      setNewCard('');
      onChanged();
    },
  });

  const allowDrop = (event: DragEvent) => {
    if (!draggingCardId) return;
    event.preventDefault();
    setOver(true);
  };
  const drop = (event: DragEvent, beforeCardId: string | null) => {
    event.preventDefault();
    event.stopPropagation();
    setOver(false);
    onDrop(column.id, beforeCardId);
  };

  const onSaveColumn = (event: FormEvent) => {
    event.preventDefault();
    if (title.trim()) update.mutate();
  };
  const onAddCard = (event: FormEvent) => {
    event.preventDefault();
    if (newCard.trim()) addCard.mutate(newCard.trim());
  };

  return (
    <section
      aria-label={`Column ${column.title}`}
      className={`card p-3 w-72 shrink-0 flex flex-col ${over ? 'ring-2 ring-primary-400' : ''}`}
      onDragOver={allowDrop}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => drop(e, null)}
    >
      {editing ? (
        <form
          onSubmit={onSaveColumn}
          className="space-y-2 mb-2"
          aria-label={`Edit column ${column.title}`}
        >
          <input
            aria-label="Column title"
            className="input"
            maxLength={255}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select
            aria-label="Column type"
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value as ColumnType)}
          >
            {COLUMN_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            <button type="submit" className="btn-primary text-sm" disabled={!title.trim()}>
              Save
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{column.title}</h2>
            <span className="text-xs text-gray-500">
              {column.cards.length} · {column.type}
            </span>
          </div>
          {canEditStructure && (
            <div className="flex flex-wrap gap-1 mt-1">
              <button
                type="button"
                className="btn-secondary text-xs px-2 py-1"
                aria-label={`Move column ${column.title} left`}
                disabled={index === 0}
                onClick={() => reorder.mutate(index - 1)}
              >
                ←
              </button>
              <button
                type="button"
                className="btn-secondary text-xs px-2 py-1"
                aria-label={`Move column ${column.title} right`}
                disabled={index === columnCount - 1}
                onClick={() => reorder.mutate(index + 1)}
              >
                →
              </button>
              <button
                type="button"
                className="btn-secondary text-xs px-2 py-1"
                onClick={() => {
                  setTitle(column.title);
                  setType(column.type);
                  setEditing(true);
                }}
              >
                Edit
              </button>
              <ConfirmButton
                label="Delete"
                className="btn-secondary text-xs px-2 py-1"
                onConfirm={() => remove.mutate()}
              />
            </div>
          )}
        </div>
      )}

      <ul className="space-y-2 flex-1 min-h-[2rem]">
        {column.cards.map((card) => (
          <li
            key={card.id}
            draggable={canEditCards}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', card.id);
              e.dataTransfer.effectAllowed = 'move';
              onDragStart(card.id);
            }}
            onDragEnd={() => onDragStart(null)}
            onDragOver={allowDrop}
            onDrop={(e) => drop(e, card.id)}
            className={`rounded border border-gray-200 bg-white p-2 text-sm ${
              canEditCards ? 'cursor-grab' : ''
            } ${draggingCardId === card.id ? 'opacity-50' : ''}`}
          >
            <button type="button" className="text-left w-full" onClick={() => onOpenCard(card)}>
              <span className="block font-medium">{card.title}</span>
              {card.deadline && (
                <span className="block text-xs text-gray-500">
                  Due {new Date(card.deadline).toLocaleDateString()}
                </span>
              )}
              {card.assigneeId && (
                <span className="block text-xs text-gray-600">
                  @{members.find((m) => m.userId === card.assigneeId)?.displayName ?? 'member'}
                </span>
              )}
              {card.jiraIssueKey && (
                <span className="block text-xs text-primary-600">{card.jiraIssueKey}</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {canEditCards && (
        <form onSubmit={onAddCard} className="mt-2 flex gap-1">
          <input
            aria-label={`New card in ${column.title}`}
            className="input text-sm py-1"
            placeholder="Add a card"
            maxLength={255}
            value={newCard}
            onChange={(e) => setNewCard(e.target.value)}
          />
          <button
            type="submit"
            className="btn-primary text-sm px-3 py-1"
            disabled={!newCard.trim() || addCard.isPending}
          >
            Add
          </button>
        </form>
      )}
    </section>
  );
}
