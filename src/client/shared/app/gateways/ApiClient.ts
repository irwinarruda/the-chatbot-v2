import { parseApiError } from "~/client/shared/error/ApiError";

export class ApiClient {
  private controller = new AbortController();
  onUnauthorized?: () => void;

  cancelPendingRequests() {
    this.controller.abort();
    this.controller = new AbortController();
  }

  async request(url: string, options?: RequestInit): Promise<Response> {
    const { signal } = this.controller;
    const response = await fetch(url, { ...options, signal });
    signal.throwIfAborted();
    if (response.ok) return response;
    const error = await parseApiError(response);
    signal.throwIfAborted();
    if (response.status === 401) this.onUnauthorized?.();
    throw error;
  }
}

export const apiClient = new ApiClient();
