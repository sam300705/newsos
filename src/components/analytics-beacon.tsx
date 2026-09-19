"use client";

import { useEffect } from "react";

export function AnalyticsBeacon({
  eventType,
  articleId,
  metadata,
}: {
  eventType: string;
  articleId?: string;
  metadata?: Record<string, unknown>;
}) {
  useEffect(() => {
    let id = sessionStorage.getItem("newsos_session_id");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("newsos_session_id", id);
    }
    void fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventType, articleId, anonymousId: id, metadata }),
      keepalive: true,
    }).catch(() => undefined);
  }, [eventType, articleId, metadata]);
  return null;
}
