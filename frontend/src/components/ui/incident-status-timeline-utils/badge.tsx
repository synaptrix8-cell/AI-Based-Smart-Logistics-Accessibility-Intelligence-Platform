import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "sm" | "md";
  variant?: "warning" | "info" | "success" | "destructive" | "outline";
}

export function Badge({
  size = "sm",
  variant = "outline",
  children,
  className = "",
  style,
  ...props
}: BadgeProps) {
  const variantStyles: Record<string, React.CSSProperties> = {
    warning: {
      backgroundColor: "#FEF3C7",
      color: "#92400E",
      border: "1px solid #FCD34D",
    },
    destructive: {
      backgroundColor: "#FEE2E2",
      color: "#991B1B",
      border: "1px solid #FCA5A5",
    },
    success: {
      backgroundColor: "#DCFCE7",
      color: "#166534",
      border: "1px solid #86EFAC",
    },
    info: {
      backgroundColor: "#DBEAFE",
      color: "#1E40AF",
      border: "1px solid #93C5FD",
    },
    outline: {
      backgroundColor: "#F8FAFC",
      color: "#475569",
      border: "1px solid #E2E8F0",
    },
  };

  const isSmall = size === "sm";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 600,
        textTransform: "capitalize",
        borderRadius: "9999px",
        fontSize: isSmall ? "0.72rem" : "0.8rem",
        padding: isSmall ? "2px 8px" : "3px 10px",
        lineHeight: 1.2,
        ...variantStyles[variant],
        ...style,
      }}
      className={className}
      {...props}
    >
      {children}
    </span>
  );
}
