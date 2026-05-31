import Link from "next/link";
import type { Complaint } from "@/lib/types";
import StatusBadge from "./StatusBadge";

/* UI placeholder — replace with your design */

interface ComplaintCardProps {
  complaint: Complaint;
}

const categoryLabels: Record<string, string> = {
  road: "Yol",
  utilities: "Kommunal",
  environment: "Ekologiya",
  safety: "Təhlükəsizlik",
  social: "Sosial",
  other: "Digər",
};

export default function ComplaintCard({ complaint }: ComplaintCardProps) {
  const date = new Date(complaint.created_at).toLocaleDateString("az-AZ");
  const categoryLabel = categoryLabels[complaint.category ?? "other"] ?? complaint.category;
  const votes = complaint.votes ?? 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/complaints/${complaint.id}`}
          className="font-medium text-gray-900 hover:text-brand line-clamp-2"
        >
          {complaint.title}
        </Link>
        <StatusBadge status={complaint.status} variant="complaint" />
      </div>

      <div className="flex flex-wrap gap-2 mt-2">
        {complaint.category && (
          <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded">
            {categoryLabel}
          </span>
        )}
        <StatusBadge status={complaint.priority} variant="priority" />
      </div>

      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-gray-500">{date}</p>
        {votes !== 0 && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            votes > 0
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-600"
          }`}>
            {votes > 0 ? "▲" : "▼"} {Math.abs(votes)} səs
          </span>
        )}
      </div>
    </div>
  );
}
