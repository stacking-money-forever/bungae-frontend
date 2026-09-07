import { ApiProblemError, createBungaeApi } from "@/lib/api/client";
import type {
  PushDevicePlatform,
  PushDeviceRegistration,
} from "@/lib/api/types";
import { API_BASE_URL } from "@/lib/pwa/config";

export type { PushDevicePlatform, PushDeviceRegistration };

export class PushDeviceApiError extends Error {
  constructor(
    readonly status: number,
    readonly problemType: string | null,
  ) {
    super(`Push device request failed with ${status}`);
    this.name = "PushDeviceApiError";
  }
}

export type PushDeviceApi = {
  putDevice(
    deviceId: string,
    registration: PushDeviceRegistration,
    accessToken: string,
  ): Promise<void>;
  deleteDevice(deviceId: string, accessToken: string): Promise<void>;
};

export function createPushDeviceApi(
  fetchImpl: typeof fetch = fetch,
  baseUrl = API_BASE_URL,
): PushDeviceApi {
  const api = createBungaeApi({ fetchImpl, baseUrl });

  async function mapProblem(operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
    } catch (error) {
      if (error instanceof ApiProblemError) {
        throw new PushDeviceApiError(error.status, error.problem?.type ?? null);
      }
      throw error;
    }
  }

  return {
    putDevice(deviceId, registration, accessToken) {
      return mapProblem(async () => {
        await api.putPushDevice(deviceId, registration, accessToken);
      });
    },
    deleteDevice(deviceId, accessToken) {
      return mapProblem(() => api.deletePushDevice(deviceId, accessToken));
    },
  };
}
