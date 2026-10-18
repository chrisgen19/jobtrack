/**
 * Injected (isolated world) when the side panel reads a page: reports URL
 * changes that don't load a new page, like clicking another job in a
 * LinkedIn or JobStreet split view, which tabs.onUpdated only reports when
 * the extension may see the tab's URL. Chrome serializes it, so it must stay
 * self-contained. It stops (and can be injected again) once nothing listens,
 * for example after the panel closed.
 */
export function watchUrlChanges(messageType: string, intervalMs: number): void {
  const scope = window as unknown as { __jobtrackUrlWatcher?: number };
  if (scope.__jobtrackUrlWatcher !== undefined) return;
  const runtime = (
    globalThis as unknown as { chrome?: { runtime?: { sendMessage: (m: unknown) => Promise<unknown> } } }
  ).chrome?.runtime;
  if (!runtime) return;

  let last = location.href;
  const stop = () => {
    window.clearInterval(scope.__jobtrackUrlWatcher);
    delete scope.__jobtrackUrlWatcher;
  };
  scope.__jobtrackUrlWatcher = window.setInterval(() => {
    if (location.href === last) return;
    last = location.href;
    try {
      runtime.sendMessage({ type: messageType, url: last }).catch(stop);
    } catch {
      stop(); // The extension was reloaded or removed.
    }
  }, intervalMs);
}
