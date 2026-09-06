"use client";

import React, { useState, createContext, useContext } from "react";

interface CollapsibleContextType {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const CollapsibleContext = createContext<CollapsibleContextType>({
  isOpen: true,
  setIsOpen: () => {},
});

export function Collapsible({
  defaultOpen = true,
  children,
  className = "",
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <CollapsibleContext.Provider value={{ isOpen, setIsOpen }}>
      <div className={className} style={style} {...props}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
}

export function CollapsibleTrigger({
  children,
  className = "",
  style,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { isOpen, setIsOpen } = useContext(CollapsibleContext);

  return (
    <button
      type="button"
      onClick={(e) => {
        setIsOpen((prev) => !prev);
        if (onClick) onClick(e);
      }}
      data-state={isOpen ? "open" : "closed"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: "#64748B",
        fontSize: "0.75rem",
        fontWeight: 600,
        padding: "4px 0",
        marginTop: "6px",
        ...style,
      }}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
}

export function CollapsiblePanel({
  children,
  className = "",
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { isOpen } = useContext(CollapsibleContext);

  if (!isOpen) return null;

  return (
    <div className={className} style={style} {...props}>
      {children}
    </div>
  );
}
