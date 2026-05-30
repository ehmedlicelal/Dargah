import { redirect } from "next/navigation";

// /admin now lives at /dashboard
export default function AdminRedirect() {
  redirect("/dashboard");
}
