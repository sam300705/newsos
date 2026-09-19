export interface HealthPayload {
  status: "ok";
  service: "newsos";
  version: string;
}

export function buildHealthPayload(version: string): HealthPayload {
  return {
    status: "ok",
    service: "newsos",
    version,
  };
}
