import type { Metadata } from "next";
import { NotificationsClient } from "./notifications-client";

export const metadata: Metadata = { title: "Notificaciones" };
export const dynamic = "force-dynamic";

export default function NotificationsPage() {
  return <NotificationsClient />;
}
