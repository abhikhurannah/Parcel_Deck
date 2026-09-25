import { test, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ParcelForm } from '../../client/src/Forms';
import { ImportForm } from '../../client/src/views/ImportForm';
import { PolicyTester } from '../../client/src/policy/PolicyTester';
import { RuleEditor } from '../../client/src/policy/RuleEditor';
import { DEFAULT_POLICY, modernPolicy, validatePolicy } from '../../server/domain';
import type { Api } from '../../client/src/api';
test('parcel submission retains retry key after network failure', async () => {
  const api = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network interrupted'))
      .mockResolvedValueOnce({ first_id: 1, counts: { pending_insurance: 0 } }),
    close = vi.fn();
  render(<ParcelForm api={api as Api} onClose={close} onSuccess={vi.fn()} />);
  await userEvent.type(screen.getByLabelText('Weight (kg)'), '1');
  await userEvent.type(screen.getByLabelText('Declared value (€)'), '0');
  await userEvent.type(screen.getByLabelText('Destination country'), 'NL');
  await userEvent.click(screen.getByText('Check & route parcel →'));
  expect(await screen.findByText('Network interrupted')).toBeVisible();
  await userEvent.click(screen.getByText('Check & route parcel →'));
  await waitFor(() => expect(close).toHaveBeenCalled());
  expect(api.mock.calls[0][1].headers['Idempotency-Key']).toBe(
    api.mock.calls[1][1].headers['Idempotency-Key'],
  );
});
test('import requires preview and blocks atomic commit for invalid rows', async () => {
  const api = vi.fn().mockResolvedValue({
    valid: 1,
    invalid: 1,
    policy_version: 1,
    token: 'token',
    counts: { routed: 1, pending_insurance: 0 },
    departments: { Mail: 1 },
    errors: [{ row: 2, message: 'Invalid weight' }],
  });
  render(<ImportForm api={api as Api} onClose={vi.fn()} onSuccess={vi.fn()} />);
  expect(screen.queryByText('2. Confirm import')).not.toBeInTheDocument();
  await userEvent.upload(
    screen.getByLabelText('Batch file'),
    new File(['[]'], 'sample.json', { type: 'application/json' }),
  );
  await userEvent.click(screen.getByText('1. Preview import'));
  expect(await screen.findByText('2. Confirm import')).toBeDisabled();
  await userEvent.click(screen.getByLabelText('Import valid rows even if some rows fail'));
  expect(screen.queryByText('2. Confirm import')).not.toBeInTheDocument();
  await userEvent.click(screen.getByText('1. Preview import'));
  expect(await screen.findByText('2. Confirm import')).toBeEnabled();
});
test('test parcel does not create a parcel and can save an activation case', async () => {
  const api = vi.fn().mockResolvedValue({
      department: 'Heavy',
      status: 'pending_insurance',
      reason: 'Insurance required',
    }),
    change = vi.fn();
  render(<PolicyTester api={api as Api} policy={modernPolicy(DEFAULT_POLICY)} onChange={change} />);
  await userEvent.click(screen.getByText('Test without saving'));
  expect(await screen.findByText('Insurance required')).toBeVisible();
  expect(api.mock.calls[0][0]).toBe('/policy/test');
  await userEvent.click(screen.getByText('Keep as activation test'));
  expect(change.mock.calls[0][0].tests[0].department).toBe('Heavy');
});
test('visual editor creates a configurable fragile condition', () => {
  const change = vi.fn();
  render(<RuleEditor policy={modernPolicy(DEFAULT_POLICY)} onChange={change} disabled={false} />);
  fireEvent.click(screen.getByText('Add rule'));
  const draft = change.mock.calls[0][0];
  expect(() => validatePolicy(draft)).not.toThrow();
  const added = draft.rules.at(-1);
  expect(added.priority).toBe(0);
  expect(added.when).toEqual([{ field: 'attributes.fragile', op: 'eq', value: true }]);
});
