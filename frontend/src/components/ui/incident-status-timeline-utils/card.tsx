import React from "react";

export function Card({
  children,
  className = "",
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        color: "#0F172A",
        border: "1px solid #E2E8F0",
        borderRadius: "12px",
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.05)",
        overflow: "hidden",
        fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
        ...style,
      }}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={{
        padding: "16px 18px",
        borderBottom: "1px solid #F1F5F9",
        backgroundColor: "#FFFFFF",
        ...style,
      }}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className = "",
  style,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      style={{
        margin: 0,
        fontSize: "0.95rem",
        fontWeight: 700,
        color: "#0F172A",
        lineHeight: 1.3,
        ...style,
      }}
      className={className}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardPanel({
  children,
  className = "",
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={{
        padding: "16px 18px",
        backgroundColor: "#FAFAFA",
        ...style,
      }}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
}
