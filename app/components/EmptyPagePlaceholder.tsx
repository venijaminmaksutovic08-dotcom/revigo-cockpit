import type { ReactNode } from "react";
import Link from "next/link";

interface EmptyPagePlaceholderProps {
  icon:        ReactNode;
  title:       string;
  description: string;
  actionLabel?: string;
  actionHref?:  string;
}

export default function EmptyPagePlaceholder({ icon, title, description, actionLabel, actionHref }: EmptyPagePlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: "60vh" }}>
      <div
        className="rounded-2xl flex items-center justify-center mb-5"
        style={{
          width: 72, height: 72,
          background: "rgba(201,168,76,0.06)",
          border: "1px solid rgba(201,168,76,0.2)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}
      >
        {icon}
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: "0 0 8px", letterSpacing: "-0.02em" }}>
        {title}
      </h2>
      <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 24px", textAlign: "center", maxWidth: 360, lineHeight: 1.6 }}>
        {description}
      </p>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-2 rounded-full no-underline"
          style={{
            height: 40, paddingLeft: 20, paddingRight: 20,
            background: "linear-gradient(135deg, #C9A84C 0%, #F59E0B 100%)",
            boxShadow: "0 4px 12px rgba(201,168,76,0.3)",
            fontSize: 13, fontWeight: 700, color: "#ffffff",
            letterSpacing: "0.01em",
            textDecoration: "none",
          }}
        >
          {actionLabel}
        </Link>
      ) : (
        <div
          className="inline-flex items-center gap-2 rounded-full px-5"
          style={{
            height: 36,
            background: "rgba(201,168,76,0.08)",
            border: "1px solid rgba(201,168,76,0.2)",
            fontSize: 13, fontWeight: 600, color: "#C9A84C",
          }}
        >
          Uskoro
        </div>
      )}
    </div>
  );
}
