import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Dashboard from '../pages/Dashboard';
import { TenantProvider } from '../context/TenantContext';
import { BrowserRouter } from 'react-router-dom';
import client from '../api/client';

// Mock the custom client
vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}));

const mockedClient = client as any;

// Mock Recharts ResponsiveContainer to avoid issues with width/height in JSDOM
vi.mock('recharts', async () => {
  const OriginalModule = await vi.importActual('recharts');
  return {
    ...(OriginalModule as any),
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  };
});

const renderDashboard = () => {
  return render(
    <TenantProvider>
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    </TenantProvider>
  );
};

describe('Dashboard Component', () => {
  it('renders stats correctly after loading', async () => {
    mockedClient.get.mockImplementation((url: string) => {
      if (url.includes('/admin/tenants')) {
        return Promise.resolve({ data: [{ id: 1, name: 'Test Tenant' }] });
      }
      if (url.includes('/admin/stats')) {
        return Promise.resolve({
          data: {
            total_jobs: 100,
            success_jobs: 80,
            failed_jobs: 15,
            running_jobs: 5,
            active_workflows: 10,
            total_tenants: 1,
            workflow_breakdown: { 'WF1': 50, 'WF2': 50 },
            tenant_breakdown: [{ tenant_name: 'Test Tenant', job_count: 100, tenant_id: 1 }]
          }
        });
      }
      if (url.includes('/stats')) {
          return Promise.resolve({ data: { total_jobs: 0, success_jobs: 0, failed_jobs: 0, running_jobs: 0, active_workflows: 0 } });
      }
      if (url.includes('/jobs')) {
        return Promise.resolve({ data: { data: [], total: 0 } });
      }
      if (url.includes('/settings')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.reject(new Error('Unknown URL: ' + url));
    });

    renderDashboard();

    // Verify metrics appear
    await waitFor(() => {
      expect(screen.getByText('100')).toBeInTheDocument(); // Total Executions
      expect(screen.getByText('80.0%')).toBeInTheDocument(); // Success Rate
    });

    expect(screen.getByText('Aggregate Performance')).toBeInTheDocument();
  });
});
