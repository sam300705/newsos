"use client";

import { useEffect, useRef } from "react";
import { shouldEmitReadComplete } from "@/core/read-completion";

function sessionId() {
  let id = sessionStorage.getItem("newsos_session_id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("newsos_session_id", id);
  }
  return id;
}

export function ReadCompleteBeacon({ articleId }: { articleId: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const started = Date.now();
    let visible = false;
    let sent = sessionStorage.getItem(`newsos_read_complete:${articleId}`) === "1";
    let dwellTimer: ReturnType<typeof setTimeout> | undefined;

    const send = () => {
      if (!shouldEmitReadComplete({ alreadySent: sent, visible, dwellMs: Date.now() - started })) return;
      sent = true;
      sessionStorage.setItem(`newsos_read_complete:${articleId}`, "1");
      const body = JSON.stringify({ eventType: "READ_COMPLETE", articleId, anonymousId: sessionId() });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
      } else {
        void fetch("/api/events", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => undefined);
      }
    };

    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (dwellTimer) clearTimeout(dwellTimer);
      if (visible) dwellTimer = setTimeout(send, 15_000);
    }, { threshold: 0.5 });

    if (ref.current) observer.observe(ref.current);
    const timer = setInterval(send, 5_000);
    return () => {
      clearInterval(timer);
      if (dwellTimer) clearTimeout(dwellTimer);
      observer.disconnect();
    };
  }, [articleId]);

  return <div ref={ref} aria-hidden="true" style={{ height: 1 }} />;
}
