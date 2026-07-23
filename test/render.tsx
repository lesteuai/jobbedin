import { type ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppStoreProvider } from '@/app/lib/app-store';

export function renderWithStore(ui: ReactElement, options?: RenderOptions) {
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: AppStoreProvider, ...options }),
  };
}

export * from '@testing-library/react';
export { userEvent };
