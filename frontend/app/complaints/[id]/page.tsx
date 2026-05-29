import { fetchComplaint } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import Link from "next/link";

/* UI placeholder — replace with your design */
export default async function ComplaintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let complaint;
  try {
    complaint = await fetchComplaint(id);
  } catch {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">Şikayət tapılmadı</p>
        <Link href="/complaints" className="text-brand hover:underline text-sm mt-2 inline-block">← Geri qayıt</Link>
      </div>
    );
  }

  const date = new Date(complaint.created_at).toLocaleDateString("az-AZ", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/complaints" className="text-brand hover:underline text-sm mb-4 inline-block">← Şikayətlərə qayıt</Link>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-xl font-bold text-gray-900">{complaint.title}</h1>
          <StatusBadge status={complaint.status} variant="complaint" />
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {complaint.category && (
            <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded">
              {complaint.category}
            </span>
          )}
          <StatusBadge status={complaint.priority} variant="priority" />
          <span className="text-xs text-gray-500 py-1">{date}</span>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Açıqlama</h2>
          <p className="text-gray-800 text-sm leading-relaxed">{complaint.description}</p>
        </div>

        {complaint.ai_summary && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-blue-700 mb-1">AI Xülasəsi</p>
            <p className="text-sm text-blue-900">{complaint.ai_summary}</p>
          </div>
        )}

        {/* UI placeholder — replace with your design */}
        <div className="mt-6 border-t border-gray-100 pt-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Status Xətti</h2>
          <div className="text-sm text-gray-500">
            {/* TODO: implement timeline UI */}
            <p>Status xətti placeholder — buraya icra addımları gələcək</p>
          </div>
        </div>

        {complaint.attachments && complaint.attachments.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Əlavə Fayllar</h2>
            {/* TODO: render attachments from Supabase Storage */}
            <p className="text-sm text-gray-500">{complaint.attachments.length} fayl əlavə olunub</p>
          </div>
        )}
      </div>
    </div>
  );
}
