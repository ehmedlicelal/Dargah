/* UI placeholder — replace with your design */

interface MonitoringCardProps {
  title: string;
  value: string | number;
  unit: string;
  status: "good" | "warning" | "critical" | "unknown";
  subtitle?: string;
}

const statusStyles: Record<string, string> = {
  good: "border-green-400 bg-green-50",
  warning: "border-yellow-400 bg-yellow-50",
  critical: "border-red-400 bg-red-50",
  unknown: "border-gray-300 bg-white",
};

const statusDot: Record<string, string> = {
  good: "bg-green-500",
  warning: "bg-yellow-500",
  critical: "bg-red-500",
  unknown: "bg-gray-400",
};

export default function MonitoringCard({ title, value, unit, status, subtitle }: MonitoringCardProps) {
  return (
    <div className={`rounded-lg border-l-4 p-4 shadow-sm ${statusStyles[status] ?? statusStyles.unknown}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <span className={`w-2.5 h-2.5 rounded-full ${statusDot[status] ?? statusDot.unknown}`} />
      </div>
      <p className="text-2xl font-bold text-gray-900">
        {value}
        <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>
      </p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}
