import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import { commentsApi } from '../../api/endpoints';
import { useAuth } from '../auth';
import type { Member, CommentPage, Comment } from '../../api/schema';
import { errorMessage } from './card-utils';

/** The mirror to Jira has a 5 s budget on the server; after this grace an unsynced comment failed. */
const JIRA_SYNC_GRACE_MS = 10_000;

const isPastGrace = (comment: Comment, now: number) =>
  now - new Date(comment.createdAt).getTime() >= JIRA_SYNC_GRACE_MS;

export function CardComments({
  cardId,
  canEdit,
  isAdmin,
  members,
  onDraftChange,
  jiraIssueKey,
}: {
  cardId: string;
  canEdit: boolean;
  isAdmin: boolean;
  members: Member[];
  onDraftChange?: (hasDraft: boolean) => void;
  jiraIssueKey?: string | null;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [text, setText] = useState('');
  // Comments created in this session. Shown after the loaded pages so a new comment stays
  // visible while older pages are still unloaded; deduplicated once a page contains it.
  const [added, setAdded] = useState<Comment[]>([]);

  const queryKey = ['comments', cardId];

  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey,
      queryFn: ({ pageParam }) => commentsApi.list(cardId, pageParam),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (page: CommentPage) => page.nextCursor ?? undefined,
    });

  const loaded = data?.pages.flatMap((p) => p.items) ?? [];
  const loadedIds = new Set(loaded.map((c) => c.id));
  const comments = [...loaded, ...added.filter((c) => !loadedIds.has(c.id))];

  // A pending comment is re-checked once its grace is over: refetch (it may have synced) and
  // re-render (otherwise it is shown as failed).
  const [now, setNow] = useState(() => Date.now());
  const pendingUntil = jiraIssueKey
    ? Math.max(
        0,
        ...comments
          .filter((c) => !c.syncedToJira)
          .map((c) => new Date(c.createdAt).getTime() + JIRA_SYNC_GRACE_MS)
      )
    : 0;
  useEffect(() => {
    if (pendingUntil <= Date.now()) return;
    const timer = setTimeout(
      () => {
        setNow(Date.now());
        void queryClient.invalidateQueries({ queryKey });
      },
      pendingUntil - Date.now() + 50
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingUntil, cardId]);

  const create = useMutation({
    mutationFn: (newText: string) => commentsApi.create(cardId, newText),
    onMutate: (newText) => {
      const temp: Comment = {
        id: `temp-${Date.now()}`,
        cardId,
        authorId: user?.id ?? '',
        text: newText,
        syncedToJira: false,
        createdAt: new Date().toISOString(),
      };
      setAdded((a) => [...a, temp]);
      return { tempId: temp.id };
    },
    onSuccess: (created, _text, context) => {
      setAdded((a) => a.map((c) => (c.id === context?.tempId ? created : c)));
      setText('');
      onDraftChange?.(false);
    },
    onError: (_err, _text, context) => {
      setAdded((a) => a.filter((c) => c.id !== context?.tempId));
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (commentId: string) => commentsApi.delete(cardId, commentId),
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<InfiniteData<CommentPage>>(queryKey);
      const previousAdded = added;
      if (previous) {
        queryClient.setQueryData<InfiniteData<CommentPage>>(queryKey, {
          ...previous,
          pages: previous.pages.map((p) => ({
            ...p,
            items: p.items.filter((c) => c.id !== commentId),
          })),
        });
      }
      setAdded((a) => a.filter((c) => c.id !== commentId));
      return { previous, previousAdded };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      if (context) setAdded(context.previousAdded);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey }),
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
      ) : isError ? (
        <p role="alert" className="text-xs text-red-600 mb-4">
          Could not load comments.
        </p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-gray-500 mb-4">No comments yet.</p>
      ) : (
        <ul className="space-y-3 mb-4 max-h-60 overflow-y-auto scrollbar-thin pr-2">
          {comments.map((comment) => {
            const name = getAuthorName(comment.authorId);
            const canDelete =
              !comment.id.startsWith('temp-') && (isAdmin || comment.authorId === user?.id);
            return (
              <li key={comment.id} className="bg-gray-50 p-2 rounded text-sm">
                <div className="flex justify-between items-start gap-2 mb-1">
                  <span className="font-medium text-xs text-gray-700">{name}</span>
                  <span className="text-[10px] text-gray-500">
                    {new Date(comment.createdAt).toLocaleString()}
                    {jiraIssueKey && comment.syncedToJira && ' • Synced to Jira'}
                    {jiraIssueKey &&
                      !comment.syncedToJira &&
                      !isPastGrace(comment, now) &&
                      ' • Jira sync pending'}
                    {jiraIssueKey && !comment.syncedToJira && isPastGrace(comment, now) && (
                      <span className="text-red-600"> • Not synced to Jira</span>
                    )}
                  </span>
                </div>
                <p className="text-gray-800 whitespace-pre-wrap">{comment.text}</p>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => remove.mutate(comment.id)}
                    className="mt-1 text-red-600 text-xs underline"
                    aria-label={`Delete comment by ${name}`}
                  >
                    Delete
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {hasNextPage && (
        <button
          type="button"
          className="btn-secondary text-xs mb-4"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          Load more comments
        </button>
      )}

      {(create.isError || remove.isError) && (
        <p role="alert" className="text-xs text-red-600 mb-2">
          {errorMessage(create.error ?? remove.error)}
        </p>
      )}

      {canEdit && (
        <form onSubmit={onSubmit} className="space-y-2">
          <textarea
            className="input text-sm min-h-[4rem]"
            placeholder="Write a comment..."
            aria-label="New comment"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onDraftChange?.(e.target.value.trim() !== '');
            }}
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
