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

      <p className="text-xs text-gray-500 mt-2">{date}</p>
    </div>
  );
}
