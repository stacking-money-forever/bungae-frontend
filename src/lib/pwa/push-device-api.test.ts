import { describe, expect, it, vi } from "vitest";

import {
  PushDeviceApiError,
  createPushDeviceApi,
} from "@/lib/pwa/push-device-api";

describe("push device API", () => {
  it("uses the approved owner-scoped PUT contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          deviceId: "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
          platform: "ANDROID",
          lastSeenAt: "2026-09-07T00:00:00.000Z",
          createdAt: "2026-09-07T00:00:00.000Z",
        }),
        { status: 201 },
      ),
    );
    const api = createPushDeviceApi(fetchMock as unknown as typeof fetch);

    await api.putDevice(
      "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
      {
        platform: "ANDROID",
        token: "fcm-token",
        lastSeenAt: "2026-09-07T00:00:00.000Z",
      },
      "jwt",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/v1/me/push-devices/a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
      expect.objectContaining({
        method: "PUT",
        headers: {
          Authorization: "Bearer jwt",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform: "ANDROID",
          token: "fcm-token",
          lastSeenAt: "2026-09-07T00:00:00.000Z",
        }),
      }),
    );
  });

  it("uses the approved owner-scoped DELETE contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const api = createPushDeviceApi(fetchMock as unknown as typeof fetch);

    await api.deleteDevice("a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c", "jwt");

    expect(fetchMock).toHaveBeenCalledWith(
      "/v1/me/push-devices/a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
      {
        method: "DELETE",
        headers: { Authorization: "Bearer jwt" },
      },
    );
  });

  it("parses application/problem+json without surfacing a token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "https://bungae.example/problems/not-owner",
          title: "Not the device owner",
          status: 403,
          detail: "Only the registration owner may remove this device.",
          instance: "/v1/me/push-devices/device",
          code: "PUSH_DEVICE_NOT_OWNER",
          traceId: "trace-123",
        }),
        {
          status: 403,
          headers: { "content-type": "application/problem+json" },
        },
      ),
    );
    const api = createPushDeviceApi(fetchMock as unknown as typeof fetch);

    await expect(api.deleteDevice("device", "jwt")).rejects.toEqual(
      expect.objectContaining({
        name: "PushDeviceApiError",
        status: 403,
        problemType: "https://bungae.example/problems/not-owner",
      } satisfies Partial<PushDeviceApiError>),
    );
  });
});
