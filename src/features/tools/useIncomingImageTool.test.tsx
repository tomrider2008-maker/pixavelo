import { render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type PropsWithChildren } from 'react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearIntakeSession, getIntakeSession } from '../../services/intakeSession';
import { hasLocalWorkGuard, setLocalWorkGuard } from '../../stores/localWorkGuard';
import { useImageTool } from './useImageTool';
import { useIncomingImageTool } from './useIncomingImageTool';

const imageTool = vi.hoisted(() => ({
  chooseFile: vi.fn<(file: File | undefined) => Promise<unknown>>()
}));

vi.mock('../../services/intakeSession', () => ({
  getIntakeSession: vi.fn(),
  clearIntakeSession: vi.fn()
}));

vi.mock('./useImageTool', () => ({
  useImageTool: vi.fn(() => imageTool)
}));

const mockedGetSession = vi.mocked(getIntakeSession);
const mockedClearSession = vi.mocked(clearIntakeSession);
const mockedUseImageTool = vi.mocked(useImageTool);

function SameRouteHarness() {
  const tool = useIncomingImageTool();
  const navigate = useNavigate();
  const [, setRenderCount] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void navigate('/edit', { state: { sessionId: 'session-2' } });
        }}
      >
        Load second session
      </button>
      <button type="button" onClick={() => setRenderCount((count) => count + 1)}>
        Render again
      </button>
      <button
        type="button"
        onClick={() =>
          void tool.chooseFile(new File(['manual'], 'manual.png', { type: 'image/png' }))
        }
      >
        Choose manually
      </button>
    </>
  );
}

describe('useIncomingImageTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    imageTool.chooseFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    for (const sessionId of ['session-1', 'session-2']) {
      setLocalWorkGuard(`intake-session:${sessionId}`, false);
      setLocalWorkGuard(`intake-consumer:${sessionId}`, false);
    }
  });

  it('keeps a session available until its image has finished loading', async () => {
    const incoming = new File(['image'], 'incoming.png', { type: 'image/png' });
    mockedGetSession.mockReturnValue([incoming]);
    let finishLoading: (() => void) | undefined;
    imageTool.chooseFile.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishLoading = resolve;
        })
    );
    const protectedAfterSessionClear: boolean[] = [];
    setLocalWorkGuard('intake-session:session-1', true);
    mockedClearSession.mockImplementationOnce((sessionId) => {
      setLocalWorkGuard(`intake-session:${sessionId}`, false);
      protectedAfterSessionClear.push(hasLocalWorkGuard());
    });

    const wrapper = ({ children }: PropsWithChildren) => (
      <MemoryRouter initialEntries={[{ pathname: '/edit', state: { sessionId: 'session-1' } }]}>
        {children}
      </MemoryRouter>
    );
    renderHook(() => useIncomingImageTool(), { wrapper });

    await waitFor(() => expect(imageTool.chooseFile).toHaveBeenCalledWith(incoming));
    expect(mockedGetSession).toHaveBeenCalledWith('session-1');
    expect(mockedClearSession).not.toHaveBeenCalled();

    finishLoading?.();
    await waitFor(() => expect(mockedClearSession).toHaveBeenCalledWith('session-1'));
    expect(protectedAfterSessionClear).toEqual([true]);
    await waitFor(() => expect(hasLocalWorkGuard()).toBe(false));
  });

  it('starts empty without route state and leaves the session store untouched', () => {
    const wrapper = ({ children }: PropsWithChildren) => (
      <MemoryRouter initialEntries={['/edit']}>{children}</MemoryRouter>
    );

    renderHook(() => useIncomingImageTool(), { wrapper });

    expect(mockedUseImageTool).toHaveBeenCalledWith();
    expect(mockedGetSession).not.toHaveBeenCalled();
    expect(imageTool.chooseFile).not.toHaveBeenCalled();
    expect(mockedClearSession).not.toHaveBeenCalled();
  });

  it('loads every distinct same-route session once without overwriting a manual replacement', async () => {
    const user = userEvent.setup();
    const first = new File(['first'], 'first.png', { type: 'image/png' });
    const second = new File(['second'], 'second.png', { type: 'image/png' });
    mockedGetSession.mockImplementation((sessionId) =>
      sessionId === 'session-1' ? [first] : [second]
    );

    render(
      <MemoryRouter initialEntries={[{ pathname: '/edit', state: { sessionId: 'session-1' } }]}>
        <SameRouteHarness />
      </MemoryRouter>
    );

    await waitFor(() => expect(imageTool.chooseFile).toHaveBeenNthCalledWith(1, first));
    await waitFor(() => expect(mockedClearSession).toHaveBeenCalledWith('session-1'));

    await user.click(screen.getByRole('button', { name: 'Choose manually' }));
    expect(imageTool.chooseFile.mock.calls[1]?.[0]?.name).toBe('manual.png');

    await user.click(screen.getByRole('button', { name: 'Render again' }));
    expect(imageTool.chooseFile).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole('button', { name: 'Load second session' }));
    await waitFor(() => expect(imageTool.chooseFile).toHaveBeenNthCalledWith(3, second));
    await waitFor(() => expect(mockedClearSession).toHaveBeenCalledWith('session-2'));
  });
});
