"use client";

import { useState } from "react";
import { ChevronDownIcon, CircleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/incident-status-timeline-utils/badge";
import {
  Card,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/incident-status-timeline-utils/card";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/incident-status-timeline-utils/collapsible";
import { Separator } from "@/components/ui/incident-status-timeline-utils/separator";

const timeline = [
  {
    message:
      "We are investigating reports of elevated API error rates affecting a subset of requests.",
    status: "investigating",
    time: "14:32 UTC",
  },
  {
    message:
      "The issue has been identified as a misconfigured load balancer rule following a routine deployment at 14:15 UTC.",
    status: "identified",
    time: "14:48 UTC",
  },
  {
    message:
      "A fix has been deployed and rolled out to all regions. Error rates are returning to normal. We are monitoring the situation.",
    status: "monitoring",
    time: "15:04 UTC",
  },
];

const statusVariant: Record<
  string,
  "warning" | "info" | "success" | "destructive"
> = {
  identified: "warning",
  investigating: "destructive",
  monitoring: "success",
  resolved: "success",
};

export function Pattern() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div style={{ width: "100%", maxWidth: "420px", colorScheme: "light" }}>
      <Card style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", color: "#0f172a" }}>
        <Collapsible defaultOpen>
          <CardHeader style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "12px", backgroundColor: "#ffffff" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <CircleAlertIcon style={{ marginTop: "2px", width: "16px", height: "16px", flexShrink: 0, color: "#d97706" }} />
                <div>
                  <CardTitle style={{ fontSize: "0.875rem", lineHeight: 1.3, color: "#0f172a" }}>
                    Elevated API error rates
                  </CardTitle>
                  <p style={{ marginTop: "2px", color: "#64748b", fontSize: "0.75rem", margin: 0 }}>
                    Started May 25, 2025 · 14:32 UTC
                  </p>
                </div>
              </div>
              <Badge size="sm" variant="warning">
                Monitoring
              </Badge>
            </div>
            <CollapsibleTrigger
              onClick={() => setIsOpen(!isOpen)}
              style={{
                marginTop: "8px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                color: "#64748b",
                fontSize: "0.75rem",
                cursor: "pointer",
                background: "transparent",
                border: "none",
                padding: 0,
              }}
            >
              View incident timeline
              <ChevronDownIcon
                style={{
                  width: "14px",
                  height: "14px",
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 200ms ease",
                }}
              />
            </CollapsibleTrigger>
          </CardHeader>

          <CollapsiblePanel>
            <CardPanel style={{ padding: "14px 18px", backgroundColor: "#f8fafc" }}>
              <div style={{ position: "relative" }}>
                {/* Vertical timeline line */}
                <div
                  style={{
                    position: "absolute",
                    top: "4px",
                    bottom: "4px",
                    left: "7px",
                    width: "2px",
                    backgroundColor: "#e2e8f0",
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {timeline.map((event, i) => (
                    <div style={{ position: "relative", display: "flex", gap: "12px" }} key={i}>
                      <div
                        style={{
                          position: "relative",
                          zIndex: 10,
                          marginTop: "2px",
                          display: "flex",
                          width: "16px",
                          height: "16px",
                          flexShrink: 0,
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "50%",
                          border: "1px solid #cbd5e1",
                          backgroundColor: "#ffffff",
                        }}
                      >
                        <div
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            backgroundColor:
                              i === timeline.length - 1 ? "#16a34a" : "#94a3b8",
                          }}
                        />
                      </div>
                      <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <Badge
                            size="sm"
                            variant={statusVariant[event.status] ?? "outline"}
                          >
                            {event.status}
                          </Badge>
                          <span style={{ color: "#64748b", fontSize: "0.75rem" }}>
                            {event.time}
                          </span>
                        </div>
                        <p style={{ color: "#475569", fontSize: "0.75rem", lineHeight: 1.5, margin: 0 }}>
                          {event.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Separator style={{ marginTop: "16px", marginBottom: "12px", borderTop: "1px solid #e2e8f0" }} />
              <p style={{ color: "#64748b", fontSize: "0.75rem", margin: 0 }}>
                Next update in{" "}
                <span style={{ fontWeight: 600, color: "#0f172a" }}>12 minutes</span>.
              </p>
            </CardPanel>
          </CollapsiblePanel>
        </Collapsible>
      </Card>
    </div>
  );
}

export default Pattern;
