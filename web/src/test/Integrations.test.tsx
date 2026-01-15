import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Integrations from '../pages/Integrations';
import { TenantProvider } from '../context/TenantContext';
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

describe('Integrations Component', () => {
  it('renders integration cards', async () => {
    mockedClient.get.mockImplementation((url: string) => {
      if (url.includes('/admin/tenants')) {
        return Promise.resolve({ data: [{ id: 1, name: 'Default Tenant' }] });
      }
      if (url.includes('/integrations')) {
        return Promise.resolve({
          data: [
            {
              id: 1,
              name: 'AuthMind API',
              type: 'REST',
              base_url: 'http://mock-am',
              auth_type: 'bearer',
              enabled: true,
              is_available: true,
              consecutive_failures: 0
            }
          ]
        });
      }
      return Promise.reject(new Error('Unknown URL: ' + url));
    });

    render(
      <TenantProvider>
        <Integrations />
      </TenantProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('AuthMind API')).toBeInTheDocument();
      expect(screen.getByText('http://mock-am')).toBeInTheDocument();
    });
  });
});
