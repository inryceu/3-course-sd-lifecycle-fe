import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'react-hot-toast';
import type { Member } from '../../api/schema';
import { renderWithProviders } from '../../test-utils';
import { MembersPanel } from './MembersPanel';

vi.mock('../auth', () => ({ useAuth: () => ({ user: { id: 'u-admin' } }) }));

const ALICE: Member = {
  boardId: 'b1',
  userId: 'u-admin',
  displayName: 'alice',
  email: 'alice@example.com',
  role: 'ADMIN',
  invitedAt: '',
};
const BOB: Member = {
  boardId: 'b1',
  userId: 'u-bob',
  displayName: 'bob',
  email: 'bob@example.com',
  role: 'MEMBER',
  invitedAt: '',
};

function respond(status: number, body?: unknown): Promise<Response> {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => (body === undefined ? Promise.reject(new Error('no body')) : Promise.resolve(body)),
  } as Response);
}

function errorBody(status: number, message: string) {
  return {
    statusCode: status,
    error: status === 409 ? 'Conflict' : status === 403 ? 'Forbidden' : 'Bad Request',
    message,
  };
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.endsWith('/boards/b1/members') && method === 'GET') {
        return respond(200, [ALICE, BOB]);
      }
      if (url.endsWith('/boards/b1/members') && method === 'POST') {
        const { email } = JSON.parse(String(init?.body)) as { email: string };
        if (email === 'nobody@example.com') {
          return respond(400, errorBody(400, 'User with this email not found'));
        }
        if (email === 'bob@example.com') {
          return respond(409, errorBody(409, 'User is already a member of this board'));
        }
        return respond(403, errorBody(403, 'Only a board admin can do this'));
      }
      if (url.endsWith('/boards/b1/members/u-admin') && method === 'PATCH') {
        return respond(409, errorBody(409, 'Cannot remove or demote the last admin of the board'));
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderPanel() {
  return renderWithProviders(
    <>
      <MembersPanel boardId="b1" isAdmin />
      <Toaster />
    </>
  );
}

async function invite(email: string) {
  await userEvent.type(await screen.findByLabelText('E-mail of a registered user'), email);
  await userEvent.click(screen.getByRole('button', { name: 'Invite' }));
}

function memberRows() {
  return within(screen.getByRole('region', { name: 'Board members' })).getAllByRole('listitem');
}

describe('Members panel errors', () => {
  it('shows the backend message for an unknown e-mail and keeps the list', async () => {
    renderPanel();
    expect(await screen.findByText('bob')).toBeInTheDocument();

    await invite('nobody@example.com');

    expect(await screen.findByText('User with this email not found')).toBeInTheDocument();
    expect(memberRows()).toHaveLength(2);
  });

  it('shows the backend message for a duplicate invite (409)', async () => {
    renderPanel();
    expect(await screen.findByText('bob')).toBeInTheDocument();

    await invite('bob@example.com');

    expect(await screen.findByText('User is already a member of this board')).toBeInTheDocument();
    expect(memberRows()).toHaveLength(2);
  });

  it('shows the backend message when the role no longer allows the action (403)', async () => {
    renderPanel();
    expect(await screen.findByText('bob')).toBeInTheDocument();

    await invite('carol@example.com');

    expect(await screen.findByText('Only a board admin can do this')).toBeInTheDocument();
  });

  it('keeps the role and shows the backend message when the last Admin demotes themselves', async () => {
    renderPanel();
    const select = await screen.findByLabelText('Role of alice');
    expect(select).toHaveValue('ADMIN');

    await userEvent.selectOptions(select, 'MEMBER');

    expect(
      await screen.findByText('Cannot remove or demote the last admin of the board')
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Role of alice')).toHaveValue('ADMIN'));
  });
});
