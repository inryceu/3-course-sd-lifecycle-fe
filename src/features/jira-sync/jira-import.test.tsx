import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Board, BoardRole, JiraStatusMapping } from '../../api/schema';
import { renderWithProviders } from '../../test-utils';
import { JiraSyncPage } from './JiraSyncPage';

const api = vi.hoisted(() => ({
  boards: { list: vi.fn(), get: vi.fn() },
  jira: {
    connection: vi.fn(),
    importIssues: vi.fn(),
    statusMappings: vi.fn(),
    saveStatusMappings: vi.fn(),
    startOAuth: vi.fn(),
    disconnect: vi.fn(),
  },
}));
vi.mock('../../api/endpoints', () => ({ boardsApi: api.boards, jiraApi: api.jira }));

const board = (myRole: BoardRole, jiraProjectKey: string | null): Board => ({
  id: 'b1',
  title: 'Team board',
  myRole,
  jiraProjectKey,
  createdAt: '',
  updatedAt: '',
});
const mapping = (
  id: string,
  name: string,
  columnId: string,
  isDefault = true
): JiraStatusMapping => ({
  jiraStatusId: id,
  jiraStatusName: name,
  statusCategory: 'new',
  columnId,
  isDefault,
});

beforeEach(() => {
  [...Object.values(api.boards), ...Object.values(api.jira)].forEach((fn) => fn.mockReset());
  api.jira.connection.mockResolvedValue({
    connected: true,
    boardId: 'b1',
    siteUrl: 'https://team.atlassian.net',
    scopes: [],
  });
  api.boards.get.mockResolvedValue({
    ...board('ADMIN', 'KAN'),
    columns: [
      { id: 'c1', boardId: 'b1', title: 'To Do', type: 'TODO', position: 0, cards: [] },
      { id: 'c3', boardId: 'b1', title: 'Done', type: 'DONE', position: 1, cards: [] },
    ],
  });
  api.jira.statusMappings.mockResolvedValue([
    mapping('1', 'To Do', 'c1'),
    mapping('5', 'In Review', 'c1'),
  ]);
});

describe('Jira import panel', () => {
  it('imports a project and shows the counts', async () => {
    api.boards.list.mockResolvedValue([board('ADMIN', null)]);
    api.jira.importIssues.mockResolvedValue({ imported: 3, created: 3, updated: 0, skipped: 1 });
    renderWithProviders(<JiraSyncPage />);

    await userEvent.type(await screen.findByLabelText('Jira project key'), 'kan');
    await userEvent.click(screen.getByRole('button', { name: 'Import open issues' }));

    expect(api.jira.importIssues).toHaveBeenCalledWith('b1', 'KAN');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Imported 3: 3 created, 0 updated, 1 unchanged.'
    );
  });

  it('lets the Admin change and save the status mapping', async () => {
    api.boards.list.mockResolvedValue([board('ADMIN', 'KAN')]);
    api.jira.saveStatusMappings.mockResolvedValue([
      mapping('1', 'To Do', 'c1'),
      mapping('5', 'In Review', 'c3', false),
    ]);
    renderWithProviders(<JiraSyncPage />);

    const select = await screen.findByLabelText('Column for In Review');
    await waitFor(() =>
      expect(within(select).getByRole('option', { name: 'Done' })).toBeInTheDocument()
    );
    await userEvent.selectOptions(select, 'c3');
    await userEvent.click(screen.getByRole('button', { name: 'Save mapping' }));

    expect(api.jira.saveStatusMappings).toHaveBeenCalledWith('b1', [
      { jiraStatusId: '5', columnId: 'c3' },
    ]);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Save mapping' })).not.toBeInTheDocument()
    );
  });

  it('shows a Member the mapping read-only and no import', async () => {
    api.boards.list.mockResolvedValue([board('MEMBER', 'KAN')]);
    renderWithProviders(<JiraSyncPage />);

    expect(await screen.findByLabelText('Column for To Do')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Import open issues' })).not.toBeInTheDocument();
    expect(screen.getByText('Jira project: KAN')).toBeInTheDocument();
  });
});
