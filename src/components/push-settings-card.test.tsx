import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_FCM_VAPID_KEY = "test-vapid-key";
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "test-api-key";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "test-project";
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "123456";
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "1:123456:web:test";
});

import { PushSettingsCard } from "@/components/push-settings-card";
import type { FcmClient, PushDependencies } from "@/lib/pwa/push";
import type { PushDeviceApi } from "@/lib/pwa/push-device-api";
import { installLocalStorageStub } from "@/test/pwa-stubs";

function stubBrowser({
  standalone = true,
  permission = "default",
  userAgent = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0",
}: {
  standalone?: boolean;
  permission?: NotificationPermission;
  userAgent?: string;
} = {}) {
  Object.defineProperty(window.navigator, "userAgent", { configurable: true, value: userAgent });
  Object.defineProperty(window.navigator, "serviceWorker", {
    configurable: true,
    value: { getRegistration: vi.fn().mockResolvedValue({ active: {} }) },
  });
  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: { permission, requestPermission: vi.fn().mockResolvedValue("granted") },
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: standalone }),
  });
}

type PushDeviceApiMocks = PushDeviceApi & {
  putDevice: Mock;
  deleteDevice: Mock;
};

function createDependencies(): {
  dependencies: PushDependencies;
  api: PushDeviceApiMocks;
} {
  const fcm: FcmClient = {
    isSupported: vi.fn().mockResolvedValue(true),
    getToken: vi.fn().mockResolvedValue("fcm-token"),
    deleteToken: vi.fn().mockResolvedValue(true),
  };
  const api = {
    putDevice: vi.fn().mockResolvedValue(undefined),
    deleteDevice: vi.fn().mockResolvedValue(undefined),
  } as PushDeviceApiMocks;
  return {
    dependencies: {
      session: { subject: "user-1", getAccessToken: vi.fn().mockResolvedValue("jwt") },
      fcm,
      api,
      createDeviceId: () => "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
    },
    api,
  };
}

describe("PushSettingsCard", () => {
  beforeEach(() => {
    installLocalStorageStub();
  });

  it("honestly disables registration until frontend auth injects a session", async () => {
    stubBrowser();
    render(<PushSettingsCard />);

    expect(await screen.findByText("로그인 정보가 연결되면 알림을 설정할 수 있어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "켜기" })).toBeDisabled();
  });

  it("enables and registers an FCM device after an authenticated dependency is injected", async () => {
    stubBrowser();
    const { dependencies, api } = createDependencies();
    render(<PushSettingsCard dependencies={dependencies} />);

    fireEvent.click(await screen.findByRole("button", { name: "켜기" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "끄기" })).toBeInTheDocument();
    });
    expect(api.putDevice).toHaveBeenCalledTimes(1);
  });

  it("requires iOS installation before it offers notification registration", async () => {
    stubBrowser({
      standalone: false,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    const { dependencies } = createDependencies();
    render(<PushSettingsCard dependencies={dependencies} />);

    expect(await screen.findByText("홈 화면에 추가한 후 알림을 켤 수 있어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "켜기" })).toBeDisabled();
  });

  it("reports denied browser permission without offering a fake retry", async () => {
    stubBrowser({ permission: "denied" });
    const { dependencies } = createDependencies();
    render(<PushSettingsCard dependencies={dependencies} />);

    expect(await screen.findByText("브라우저 설정에서 알림 권한을 허용해 주세요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "켜기" })).toBeDisabled();
  });

  it("keeps the control retryable after an unexpected registration rejection", async () => {
    stubBrowser();
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        permission: "default",
        requestPermission: vi.fn().mockRejectedValue(new Error("browser rejected prompt")),
      },
    });
    const { dependencies } = createDependencies();
    render(<PushSettingsCard dependencies={dependencies} />);

    fireEvent.click(await screen.findByRole("button", { name: "켜기" }));

    expect(
      await screen.findByText("알림 설정을 처리하지 못했어요. 다시 시도해 주세요."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeEnabled();
  });

  it("explains when server registration was rolled back after local persistence failure", async () => {
    stubBrowser();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {
          throw new Error("write blocked");
        },
      },
    });
    const { dependencies } = createDependencies();
    render(<PushSettingsCard dependencies={dependencies} />);

    fireEvent.click(await screen.findByRole("button", { name: "켜기" }));

    expect(
      await screen.findByText(
        "알림 설정을 저장하지 못해 서버 등록을 되돌렸어요. 다시 시도해 주세요.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeEnabled();
  });

  it("retries orphan cleanup before it offers another registration", async () => {
    stubBrowser();
    const { dependencies, api } = createDependencies();
    api.deleteDevice.mockRejectedValueOnce(new Error("rollback unavailable"));
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {
          throw new Error("write blocked");
        },
      },
    });
    render(<PushSettingsCard dependencies={dependencies} />);

    fireEvent.click(await screen.findByRole("button", { name: "켜기" }));

    expect(
      await screen.findByText("이전 알림 등록을 정리한 뒤 새 알림을 등록할 수 있어요."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "정리 다시 시도" })).toBeEnabled();
    expect(api.putDevice).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "정리 다시 시도" }));

    expect(
      await screen.findByText("이전 서버 등록을 정리했어요. 이제 새 알림을 켤 수 있어요."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "켜기" })).toBeEnabled();
    expect(api.putDevice).toHaveBeenCalledTimes(1);
    expect(api.deleteDevice).toHaveBeenCalledTimes(2);
  });
});
