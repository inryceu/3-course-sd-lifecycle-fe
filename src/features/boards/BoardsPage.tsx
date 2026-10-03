import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { boardsApi } from '../../api/endpoints';

// Minimal list; the full boards UI is a later ticket.
export function BoardsPage() {
  const { data: boards, isLoading, isError } = useQuery({
    queryKey: ['boards'],
    queryFn: () => boardsApi.list(),
  });

  if (isLoading) return <p>Loading boards...</p>;
  if (isError) return <p role="alert">Could not load boards.</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Boards</h1>
      {boards && boards.length === 0 && <p className="text-gray-600">No boards yet.</p>}
      <ul className="space-y-2">
        {boards?.map((board) => (
          <li key={board.id} className="card p-4">
            <Link to={`/boards/${board.id}`} className="font-medium text-primary-600">
              {board.title}
            </Link>
            <span className="ml-2 text-xs text-gray-500">{board.myRole}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
