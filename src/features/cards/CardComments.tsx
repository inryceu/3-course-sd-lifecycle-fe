import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commentsApi } from '../../api/endpoints';
import { useAuth } from '../auth';
import type { Member, CommentPage, Comment } from '../../api/schema';

export function CardComments({
  cardId,
  canEdit,
  members,
}: {
  cardId: string;
  canEdit: boolean;
  members: Member[];
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [text, setText] = useState('');

  const queryKey = ['comments', cardId];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => commentsApi.list(cardId),
  });

  const comments = data?.items ?? [];

  const create = useMutation({
    mutationFn: (newText: string) => commentsApi.create(cardId, newText),
    onMutate: async (newText) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CommentPage>(queryKey);

      const optimisticComment: Comment = {
        id: `temp-${Date.now()}`,
        cardId,
        authorId: user?.id ?? '',
        text: newText,
        syncedToJira: false,
        createdAt: new Date().toISOString(),
      };

      if (previous) {
        queryClient.setQueryData<CommentPage>(queryKey, {
          ...previous,
          items: [...previous.items, optimisticComment],
        });
      }
      return { previous };
    },
    onError: (_err, _var, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      setText('');
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const remove = useMutation({
    mutationFn: (commentId: string) => commentsApi.delete(cardId, commentId),
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CommentPage>(queryKey);
      if (previous) {
        queryClient.setQueryData<CommentPage>(queryKey, {
          ...previous,
          items: previous.items.filter((c) => c.id !== commentId),
        });
      }
      return { previous };
    },
    onError: (_err, _var, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) create.mutate(text.trim());
  };

  const getAuthorName = (authorId: string) => {
    if (authorId === user?.id) return 'You';
    const member = members.find((m) => m.userId === authorId);
    return member ? member.displayName : `User ${authorId.slice(0, 4)}`;
  };

  return (
    <div className="mt-6 border-t pt-4">
      <h3 className="text-sm font-semibold mb-3">Comments</h3>

      {isLoading ? (
        <p className="text-xs text-gray-500">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-gray-500 mb-4">No comments yet.</p>
      ) : (
        <ul className="space-y-3 mb-4 max-h-60 overflow-y-auto scrollbar-thin pr-2">
          {comments.map((comment) => (
            <li key={comment.id} className="bg-gray-50 p-2 rounded text-sm relative group">
              <div className="flex justify-between items-start mb-1">
                <span className="font-medium text-xs text-gray-700">
                  {getAuthorName(comment.authorId)}
                </span>
                <span className="text-[10px] text-gray-400">
                  {new Date(comment.createdAt).toLocaleString()}
                  {comment.syncedToJira && ' • Jira'}
                </span>
              </div>
              <p className="text-gray-800 whitespace-pre-wrap">{comment.text}</p>

              {(canEdit || comment.authorId === user?.id) && (
                <button
                  type="button"
                  onClick={() => remove.mutate(comment.id)}
                  className="absolute top-2 right-2 text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete comment"
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={onSubmit} className="space-y-2">
          <textarea
            className="input text-sm min-h-[4rem]"
            placeholder="Write a comment..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={5000}
          />
          <button
            type="submit"
            className="btn-primary text-xs"
            disabled={!text.trim() || create.isPending}
          >
            Add comment
          </button>
        </form>
      )}
    </div>
  );
}
