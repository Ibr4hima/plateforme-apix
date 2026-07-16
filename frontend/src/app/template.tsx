"use client";

// Remonté par Next à chaque navigation : fondu doux entre les pages.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
