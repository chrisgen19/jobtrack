import { afterEach, describe, expect, it, vi } from "vitest";
import { browser } from "wxt/browser";
import { registerBadge } from "./background/badge";
import { registerPanelTriggers } from "./background/panel-triggers";
import { OPEN_PANEL_COMMAND, PANEL_REFRESH } from "./messages";
import { pendingSelectionItem } from "./storage";
import { showsNewJob } from "./use-panel-tab";

/** Captures the listener an API event gets, since the fake browser doesn't implement these events. */
function capture<T extends (...args: never[]) => unknown>(event: { addListener: (listener: T) => void }) {
  const box: { listener?: T } = {};
  vi.spyOn(event, "addListener").mockImplementation((listener) => {
    box.listener = listener;
  });
  return box;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("showsNewJob", () => {
  it("reloads for another tab or job, not for the same job", () => {
    const job = { tabId: 1, key: "https://www.linkedin.com/jobs/view/1/" };
    expect(showsNewJob(job, job)).toBe(false);
    expect(showsNewJob(job, { ...job, key: "https://www.linkedin.com/jobs/view/2/" })).toBe(true);
    expect(showsNewJob(job, { ...job, tabId: 2 })).toBe(true);
    expect(showsNewJob(job, { ...job, key: null })).toBe(true);
  });
});

describe("panel triggers", () => {
  function setup() {
    const open = vi.spyOn(browser.sidePanel, "open").mockResolvedValue(undefined);
    const send = vi.spyOn(browser.runtime, "sendMessage").mockRejectedValue(new Error("no receiver"));
    vi.spyOn(browser.runtime.onInstalled, "addListener").mockImplementation(() => undefined);
    const menu = capture(browser.contextMenus.onClicked);
    const command = capture(browser.commands.onCommand);
    registerPanelTriggers();
    return { open, send, menu: menu.listener!, command: command.listener! };
  }
  const tab = { id: 7 } as Parameters<ReturnType<typeof setup>["menu"]>[1];

  it("opens the panel within the click and keeps the selected text for it", async () => {
    const { open, send, menu } = setup();
    menu(
      { menuItemId: "use-selection", selectionText: "Own the billing service", editable: false, pageUrl: "" },
      tab,
    );
    // Synchronously, while the click still counts as a user gesture.
    expect(open).toHaveBeenCalledWith({ tabId: 7 });
    expect(send).toHaveBeenCalledWith({ type: PANEL_REFRESH, tabId: 7 });
    await vi.waitFor(async () =>
      expect(await pendingSelectionItem.getValue()).toMatchObject({
        tabId: 7,
        text: "Own the billing service",
      }),
    );
  });

  it("opens the panel from the shortcut only", () => {
    const { open, command } = setup();
    command("something-else", tab);
    expect(open).not.toHaveBeenCalled();
    command(OPEN_PANEL_COMMAND, tab);
    expect(open).toHaveBeenCalledWith({ tabId: 7 });
  });
});

describe("badge", () => {
  it("marks job pages it can see the URL of", async () => {
    vi.spyOn(browser.action, "setBadgeBackgroundColor").mockResolvedValue(undefined);
    const setText = vi.spyOn(browser.action, "setBadgeText").mockResolvedValue(undefined);
    for (const event of [browser.permissions.onAdded, browser.permissions.onRemoved]) {
      vi.spyOn(event, "addListener").mockImplementation(() => undefined);
    }
    const updated = capture(browser.tabs.onUpdated);
    registerBadge();
    const changed = updated.listener! as unknown as (
      tabId: number,
      info: { url?: string; status?: string },
    ) => void;

    changed(3, { url: "https://ph.jobstreet.com/developer-jobs?jobId=95314885" });
    changed(4, { url: "https://ph.jobstreet.com/developer-jobs" });
    changed(5, { status: "complete" }); // no URL: no host access, badge untouched
    await vi.waitFor(() => expect(setText).toHaveBeenCalledTimes(2));
    expect(setText).toHaveBeenCalledWith({ tabId: 3, text: "JOB" });
    expect(setText).toHaveBeenCalledWith({ tabId: 4, text: "" });
  });
});
