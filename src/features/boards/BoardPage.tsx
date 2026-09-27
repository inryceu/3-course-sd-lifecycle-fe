import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { columnsApi, cardsApi, boardsApi } from '../../api/endpoints';
import { useWebSocket } from '../../hooks/useWebSocket';
import type { Column, Card, Board } from '../../types';
import { ColumnType } from '../../types';

interface DragItem {
  type: 'card';
  cardId: string;
  sourceColumnId: string;
}

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const { joinBoard, leaveBoard, on } = useWebSocket();

  const { data: board, isLoading: boardLoading } = useQuery({
    queryKey: ['board', boardId],
    queryFn: () => boardsApi.get(boardId!),
    enabled: !!boardId,
  });

  const { data: columns, isLoading: columnsLoading } = useQuery({
    queryKey: ['columns', boardId],
    queryFn: () => columnsApi.listByBoard(boardId!),
    enabled: !!boardId,
  });

  const createColumnMutation = useMutation({
    mutationFn: (data: { title: string; type: string }) => columnsApi.create(boardId!, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['columns', boardId] }),
  });

  const createCardMutation = useMutation({
    mutationFn: (data: { columnId: string; title: string; description?: string }) =>
      cardsApi.create(data.columnId, { title: data.title, description: data.description, columnId: data.columnId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['columns', boardId] }),
  });

  const moveCardMutation = useMutation({
    mutationFn: (data: { cardId: string; columnId: string; position: number }) =>
      cardsApi.move(data.cardId, data.columnId, data.position),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['columns', boardId] }),
  });

  useEffect(() => {
    if (boardId) {
      joinBoard(boardId);
    }
    return () => {
      if (boardId) leaveBoard(boardId);
    };
  }, [boardId, joinBoard, leaveBoard]);

  useEffect(() => {
    const unsubscribe = on('board:update', (data) => {
      if (data.boardId === boardId) {
        queryClient.invalidateQueries({ queryKey: ['columns', boardId] });
      }
    });
    return unsubscribe;
  }, [boardId, on, queryClient]);

  const handleDragStart = (e: React.DragEvent, cardId: string, columnId: string) => {
    setDraggedItem({ type: 'card', cardId, sourceColumnId: columnId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.type !== 'card') return;

    const targetColumn = columns?.find((c) => c.id === targetColumnId);
    if (!targetColumn) return;

    const cardsInTarget = targetColumn.cards || [];
    const newPosition = cardsInTarget.length;

    await moveCardMutation.mutateAsync({
      cardId: draggedItem.cardId,
      columnId: targetColumnId,
      position: newPosition,
    });

    setDraggedItem(null);
  };

  const handleAddCard = (columnId: string) => {
    const title = prompt('Enter card title:');
    if (title?.trim()) {
      createCardMutation.mutate({ columnId, title: title.trim() });
    }
  };

  const handleAddColumn = () => {
    const title = prompt('Enter column title:');
    if (title?.trim()) {
      const type = prompt('Enter column type (TODO, IN_PROGRESS, REVIEW, DONE):') as ColumnType || 'TODO';
      createColumnMutation.mutate({ title: title.trim(), type });
    }
  };

  if (boardLoading || columnsLoading) {
    return <div className="flex items-center justify-center h-64">Loading board...</div>;
  }

  if (!board) {
    return <div className="text-center text-red-600">Board not found</div>;
  }

  const columnOrder: ColumnType[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
  const sortedColumns = [...(columns || [])].sort((a, b) => {
    const aIndex = columnOrder.indexOf(a.type as ColumnType);
    const bIndex = columnOrder.indexOf(b.type as ColumnType);
    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.position - b.position;
  });

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{board.title}</h1>
          {board.jiraProjectKey && (
            <span className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Jira: {board.jiraProjectKey}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={handleAddColumn} className="btn-secondary">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Column
          </button>
          <button onClick={() => navigate('/boards')} className="btn-secondary">
            Back to Boards
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto flex space-x-4 pb-4 scrollbar-thin" role="list" aria-label="Board columns">
        {sortedColumns.map((column) => (
          <div
            key={column.id}
            className="flex-shrink-0 w-80 bg-gray-100 rounded-xl p-3 min-h-full flex flex-col"
            role="listitem"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{column.type}</span>
                <h3 className="font-semibold text-gray-900">{column.title}</h3>
              </div>
              <span className="bg-gray-200 text-gray-700 text-xs font-medium px-2 py-1 rounded-full">
                {column.cards?.length || 0}
              </span>
            </div>

            <div
              className="flex-1 space-y-3 min-h-[200px] overflow-y-auto scrollbar-thin"
              role="list"
              aria-label={`${column.title} cards`}
            >
              {column.cards?.map((card) => (
                <CardItem
                  key={card.id}
                  card={card}
                  onDragStart={handleDragStart}
                />
              )) || (
                <p className="text-gray-400 text-sm text-center py-8">No cards</p>
              )}

              <button
                onClick={() => handleAddCard(column.id)}
                className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Card
              </button>
            </div>
          </div>
        ))}

        <div className="flex-shrink-0 w-80 bg-gray-100 rounded-xl p-3">
          <button
            onClick={handleAddColumn}
            className="w-full px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Column
          </button>
        </div>
      </div>
    </div>
  );
}

function CardItem({ card, onDragStart }: { card: Card; onDragStart: (e: React.DragEvent, cardId: string, columnId: string) => void }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, card.id, '')}
      className="card p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
      role="listitem"
      tabIndex={0}
    >
      <h4 className="font-medium text-gray-900 mb-1">{card.title}</h4>
      {card.description && (
        <p className="text-sm text-gray-500 mb-2 line-clamp-2">{card.description}</p>
      )}
      {card.labels && card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {card.labels.map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: `${label.color}20`, color: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}
      {card.deadline && (
        <div className="text-xs text-gray-500 flex items-center space-x-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{new Date(card.deadline).toLocaleDateString()}</span>
        </div>
      )}
    </div>
  );
}