// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { watchUrlChanges } from "./watch-url";

/** Run it the way Chrome does: serialized, so outer references would fail. */
const serialized = () => new Function(`return (${watchUrlChanges.toString()})`)() as typeof watchUrlChanges;
const scope = globalThis as unknown as { chrome?: unknown; __jobtrackUrlWatcher?: number };

afterEach(() => {
  vi.useRealTimers();
  window.clearInterval(scope.__jobtrackUrlWatcher);
  delete scope.__jobtrackUrlWatcher;
  delete scope.chrome;
});

describe("watchUrlChanges", () => {
  it("reports pushState URL changes once, and installs only one watcher", async () => {
    vi.useFakeTimers();
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    scope.chrome = { runtime: { sendMessage } };
    serialized()("jobtrack:url-changed", 750);
    serialized()("jobtrack:url-changed", 750);

    history.pushState({}, "", "/jobs/search?currentJobId=123456789");
    await vi.advanceTimersByTimeAsync(750);
    await vi.advanceTimersByTimeAsync(750);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({
      type: "jobtrack:url-changed",
      url: expect.stringContaining("currentJobId=123456789"),
    });
  });

  it("stops when nothing listens, so the panel can install it again later", async () => {
    vi.useFakeTimers();
    scope.chrome = {
      runtime: { sendMessage: vi.fn().mockRejectedValue(new Error("Receiving end does not exist")) },
    };
    serialized()("jobtrack:url-changed", 750);
    history.pushState({}, "", "/jobs/search?currentJobId=987654321");
    await vi.advanceTimersByTimeAsync(750);
    expect(scope.__jobtrackUrlWatcher).toBeUndefined();
  });
});
