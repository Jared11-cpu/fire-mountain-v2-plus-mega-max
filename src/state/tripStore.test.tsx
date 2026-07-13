import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TripProvider, STORAGE_KEY, useTrip } from './tripStore';

function Harness() {
  const { request, plan, journalEntries, updateRequest, generate, updateBudgetItems, setJournalEntries } = useTrip();
  return <div>
    <output data-testid="request">{request.destinationCity}|{request.days}|{request.budget}</output>
    <output data-testid="budget">{plan?.budgetItems.reduce((sum, item) => sum + item.amount, 0) ?? 0}</output>
    <output data-testid="journal">{journalEntries.length}</output>
    <button onClick={() => updateRequest({ destinationCity: '恩施', days: 3, budget: 1000 })}>同步</button>
    <button onClick={generate}>生成</button>
    <button onClick={() => updateBudgetItems([{ id: 'x', item: '交通', amount: 88, note: '' }])}>预算</button>
    <button onClick={() => setJournalEntries([{ id: 'j', pointId: 'p', pointName: '真实点', city: '武汉', day: 1, note: '真实', visitedAt: '2026-07-13', photoIds: [] }])}>手账</button>
  </div>;
}

describe('TripProvider persistence', () => {
  beforeEach(() => { localStorage.clear(); vi.useRealTimers(); });

  it('城市、天数和预算使用同一状态并保存恢复', async () => {
    const user = userEvent.setup();
    const view = render(<TripProvider><Harness /></TripProvider>);
    await user.click(screen.getByText('同步'));
    expect(screen.getByTestId('request')).toHaveTextContent('恩施|3|1000');
    await act(() => new Promise((resolve) => setTimeout(resolve, 450)));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').request.destinationCity).toBe('恩施');
    view.unmount();
    render(<TripProvider><Harness /></TripProvider>);
    expect(screen.getByTestId('request')).toHaveTextContent('恩施|3|1000');
  });

  it('预算编辑和真实手账独立保存，示例路线不计入手账', async () => {
    const user = userEvent.setup();
    render(<TripProvider><Harness /></TripProvider>);
    await user.click(screen.getByText('生成'));
    await user.click(screen.getByText('预算'));
    await user.click(screen.getByText('手账'));
    expect(screen.getByTestId('budget')).toHaveTextContent('88');
    expect(screen.getByTestId('journal')).toHaveTextContent('1');
    await act(() => new Promise((resolve) => setTimeout(resolve, 450)));
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(saved.plan.budgetItems).toHaveLength(1);
    expect(saved.journalEntries).toHaveLength(1);
  });
});
