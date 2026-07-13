export type Bair1ClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
};

export type Bair1Reading = {
  deviceId?: string;
  device_id?: string;
  deviceName?: string;
  timestamp?: string;
  created_at?: string;
  aqi?: number;
  pm1?: number | null;
  pm25?: number | null;
  pm4?: number | null;
  pm10?: number | null;
  temperature?: number | null;
  humidity?: number | null;
  airState?: string | null;
  rssi?: number | null;
  firmwareVersion?: string | null;
  transport?: string | null;
  [key: string]: unknown;
};

export type Bair1Device = {
  deviceId: string;
  name?: string;
  status?: string;
  location?: string;
  latestReading?: Bair1Reading | null;
  [key: string]: unknown;
};

export type Bair1ExportOptions = {
  device?: string;
  deviceId?: string;
  from?: string;
  to?: string;
  limit?: number;
  format?: "json" | "csv";
};

export class Bair1ApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, statusText: string, body: string) {
    super(`Bair1 API error ${status}: ${statusText}${body ? ` - ${body}` : ""}`);
    this.name = "Bair1ApiError";
    this.status = status;
    this.body = body;
  }
}

export class Bair1Client {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: Bair1ClientOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://www.bair1.live";
    this.fetchImpl = options.fetch ?? fetch;
  }

  async latest(deviceId?: string): Promise<Bair1Reading> {
    const params = deviceId ? { device: deviceId } : undefined;
    return this.request<Bair1Reading>("/api/readings/latest", params);
  }

  async devices(): Promise<Bair1Device[]> {
    const response = await this.request<unknown>("/api/v1/devices");
    if (Array.isArray(response)) return response as Bair1Device[];
    if (response && typeof response === "object" && "data" in response) {
      return (response as { data?: Bair1Device[] }).data ?? [];
    }
    if (response && typeof response === "object" && "devices" in response) {
      return (response as { devices?: Bair1Device[] }).devices ?? [];
    }
    return [];
  }

  async readings(deviceId: string, limit = 20): Promise<Bair1Reading[]> {
    const response = await this.request<unknown>(
      `/api/v1/devices/${encodeURIComponent(deviceId)}/readings`,
      { limit: String(limit) },
    );
    if (Array.isArray(response)) return response as Bair1Reading[];
    if (response && typeof response === "object" && "data" in response) {
      return (response as { data?: Bair1Reading[] }).data ?? [];
    }
    if (response && typeof response === "object" && "readings" in response) {
      return (response as { readings?: Bair1Reading[] }).readings ?? [];
    }
    return [];
  }

  async export(options: Bair1ExportOptions): Promise<unknown> {
    const params: Record<string, string> = {
      format: options.format ?? "json",
    };
    const device = options.device ?? options.deviceId;
    if (device) params.device = device;
    if (options.from) params.from = options.from;
    if (options.to) params.to = options.to;
    if (options.limit !== undefined) params.limit = String(options.limit);
    return this.request("/api/v1/export", params);
  }

  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== "") url.searchParams.set(key, value);
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (this.apiKey) headers["x-api-key"] = this.apiKey;

    const response = await this.fetchImpl(url.toString(), { headers });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Bair1ApiError(response.status, response.statusText, body);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return response.json() as Promise<T>;
    }
    return response.text() as Promise<T>;
  }
}
