import React from "react";

export function Separator({
  className = "",
  style,
  ...props
}: React.HTMLAttributes<HTMLHRElement>) {
  return (
    <hr
      style={{
        border: "none",
        borderTop: "1px solid #E2E8F0",
        margin: "12px 0",
        width: "100%",
        ...style,
      }}
      className={className}
      {...props}
    />
  );
}
