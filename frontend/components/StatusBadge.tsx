/* UI placeholder — replace with your design */

interface StatusBadgeProps {
  status: string;
  variant?: "complaint" | "priority" | "monitoring";
}

const complaintLabels: Record<string, string> = {
  open: "Açıq",
  in_progress: "İcrada",
  resolved: "Həll edilib",
  closed: "Bağlı",
};

const complaintColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-600",
};

const priorityLabels: Record<string, string> = {
  low: "Aşağı",
  medium: "Orta",
  high: "Yüksək",
  critical: "Kritik",
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

export default function StatusBadge({ status, variant = "complaint" }: StatusBadgeProps) {
  const labels = variant === "priority" ? priorityLabels : complaintLabels;
  const colors = variant === "priority" ? priorityColors : complaintColors;

  const label = labels[status] ?? status;
  const color = colors[status] ?? "bg-gray-100 text-gray-600";

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
