import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PwaRoot } from "@/components/pwa-root";
import {
  SERVICE_WORKER_PATH,
  SERVICE_WORKER_SCOPE,
} from "@/lib/pwa/config";
import { __setCapturedPrompt } from "@/lib/pwa/install-state";
import { installLocalStorageStub, stubMatchMedia } from "@/test/pwa-stubs";

const serviceWorkerDescriptor = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");

function restoreServiceWorker() {
  if (serviceWorkerDescriptor) {
    Object.defineProperty(navigator, "serviceWorker", serviceWorkerDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "serviceWorker");
  }
}

type Registration = ServiceWorkerRegistration & {
  waiting: ServiceWorker | null;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};

function makeRegistration(waiting: ServiceWorker | null = null): Registration {
  return {
    waiting,
    installing: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as Registration;
}

function installServiceWorkerStub(registration: Registration | null, registerError?: Error) {
  const container = {
    controller: {},
    register: registerError
      ? vi.fn().mockRejectedValue(registerError)
      : vi.fn().mockResolvedValue(registration),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as ServiceWorkerContainer;
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: container,
  });
  return container;
}

async function renderWithUpdateAvailable(waiting = { postMessage: vi.fn() } as unknown as ServiceWorker) {
  const registration = makeRegistration(waiting);
  installServiceWorkerStub(registration);
  render(<PwaRoot />);
  await screen.findByRole("status", { name: "새 버전 안내" });
  return { registration, waiting };
}

describe("PwaRoot", () => {
  beforeEach(() => {
    installLocalStorageStub();
    stubMatchMedia(false);
    __setCapturedPrompt(null);
  });

  afterEach(() => {
    document.body.querySelectorAll("input[data-pwa-dirty-test]").forEach((node) => node.remove());
    restoreServiceWorker();
    vi.restoreAllMocks();
    __setCapturedPrompt(null);
  });

  it("renders nothing until an update is available", () => {
    const registration = makeRegistration();
    installServiceWorkerStub(registration);
    const { container } = render(<PwaRoot />);
    expect(screen.queryByRole("status", { name: "새 버전 안내" })).not.toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "업데이트 확인 실패" })).not.toBeInTheDocument();
    expect(container.querySelector("[role='region'][aria-label='앱 설치']")).not.toBeInTheDocument();
  });

  it("announces an available update and does not apply it without confirmation", async () => {
    const waiting = { postMessage: vi.fn() } as unknown as ServiceWorker;
    await renderWithUpdateAvailable(waiting);

    expect(screen.getByRole("status", { name: "새 버전 안내" })).toHaveTextContent("새 버전이 준비되었어요");
    expect(waiting.postMessage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));
    expect(await screen.findByRole("dialog", { name: "새 버전으로 새로고침할까요?" })).toBeInTheDocument();
    // Not yet applied: the dialog confirm is the gate.
    expect(waiting.postMessage).not.toHaveBeenCalled();
  });

  it("warns before applying when a draft or in-flight form exists, then applies on confirm", async () => {
    const waiting = { postMessage: vi.fn() } as unknown as ServiceWorker;
    await renderWithUpdateAvailable(waiting);

    const input = document.createElement("input");
    input.dataset.pwaDirtyTest = "true";
    input.value = "작성 중인 내용";
    document.body.appendChild(input);

    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));
    expect(await screen.findByRole("dialog", { name: "입력 내용이 있어요" })).toBeInTheDocument();
    expect(screen.getByText(/작성 중인 내용과 진행 중인 요청이 사라질 수 있어요/)).toBeInTheDocument();

    const dialog = screen.getByRole("dialog", { name: "입력 내용이 있어요" });
    fireEvent.click(within(dialog).getByRole("button", { name: "새로고침" }));
    await waitFor(() => expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" }));
  });

  it("applies without a dirty warning when the document has no draft or pending form", async () => {
    const waiting = { postMessage: vi.fn() } as unknown as ServiceWorker;
    await renderWithUpdateAvailable(waiting);

    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));
    const dialog = await screen.findByRole("dialog", { name: "새 버전으로 새로고침할까요?" });
    expect(screen.queryByText(/작성 중인 내용/)).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "새로고침" }));
    await waitFor(() => expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" }));
  });

  it("keeps the update pending when the user chooses to apply later", async () => {
    const waiting = { postMessage: vi.fn() } as unknown as ServiceWorker;
    await renderWithUpdateAvailable(waiting);

    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));
    fireEvent.click(await screen.findByRole("button", { name: "나중에" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(waiting.postMessage).not.toHaveBeenCalled();
    expect(screen.getByRole("status", { name: "새 버전 안내" })).toBeInTheDocument();
  });

  it("offers a retry when registration fails and never claims an update", async () => {
    const container = installServiceWorkerStub(null, new Error("insecure context"));
    render(<PwaRoot />);

    expect(await screen.findByRole("status", { name: "업데이트 확인 실패" })).toHaveTextContent("업데이트 상태를 확인하지 못했어요");
    expect(screen.queryByRole("status", { name: "새 버전 안내" })).not.toBeInTheDocument();

    const registration = makeRegistration();
    vi.mocked(container.register).mockResolvedValue(registration);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    await waitFor(() => {
      expect(screen.queryByRole("status", { name: "업데이트 확인 실패" })).not.toBeInTheDocument();
    });
    expect(vi.mocked(container.register).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(vi.mocked(container.register).mock.calls[1][0]).toBe(SERVICE_WORKER_PATH);
    expect(vi.mocked(container.register).mock.calls[1][1]).toEqual({ scope: SERVICE_WORKER_SCOPE });
  });
});
