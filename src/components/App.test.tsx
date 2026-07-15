import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { TripProvider } from '../state/tripStore';

function renderRoute(path: string) { return render(<MemoryRouter initialEntries={[path]}><TripProvider><App /></TripProvider></MemoryRouter>); }

describe('routes and accessibility', () => {
  beforeEach(() => localStorage.clear());
  it('直接打开 planner、journal、about 都恢复正确页面', () => {
    const planner = renderRoute('/planner');
    expect(screen.getByRole('heading', { name: '懂你，也懂湖北' })).toBeInTheDocument();
    expect(screen.getByLabelText('开始日期')).toBeInTheDocument();
    planner.unmount();
    const journal = renderRoute('/journal');
    expect(screen.getByRole('heading', { name: '我的旅行路线手账' })).toBeInTheDocument();
    expect(screen.getByRole('main', { name: '旅行手账地图' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '记下这一刻' })).toBeInTheDocument();
    journal.unmount();
    renderRoute('/about');
    expect(screen.getByRole('heading', { name: '系统架构图' })).toBeInTheDocument();
  });

  it('导航按钮有 aria-pressed，表单控件有明确标签', () => {
    const { container } = renderRoute('/planner');
    expect(screen.getByRole('button', { name: 'AI 行程' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('预算（元）')).toBeInTheDocument();
    expect(screen.getByLabelText('结束日期')).toBeInTheDocument();
    expect(container.querySelector('button a, a button')).not.toBeInTheDocument();
  });
});
