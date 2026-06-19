import type { ReactNode } from "react";

interface EmptyPagePlaceholderProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export default function EmptyPagePlaceholder({ icon, title, description }: EmptyPagePlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: "60vh" }}>
      <div
        className="rounded-2xl flex items-center justify-center mb-5"
        style={{ width: 64, height: 64, background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
      >
        {icon}
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "0 0 8px", letterSpacing: "-0.01em" }}>
        {title}
      </h2>
      <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 20px", textAlign: "center", maxWidth: 360 }}>
        {description}
      </p>
      <div
        className="inline-flex items-center gap-2 rounded-lg px-4"
        style={{
          height: 36,
          background: "rgba(201,168,76,0.08)",
          border: "1px solid rgba(201,168,76,0.2)",
          fontSize: 13,
          fontWeight: 600,
          color: "#C9A84C",
          letterSpacing: "0.02em",
        }}
      >
        Uskoro
      </div>
    </div>
  );
}
