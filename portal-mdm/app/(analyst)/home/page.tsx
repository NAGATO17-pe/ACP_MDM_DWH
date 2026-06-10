import type { Metadata } from "next";
import { HomeClient } from "./home-client";

export const metadata: Metadata = { title: "Mi Workspace" };
export const dynamic = "force-dynamic";

export default function AnalystHomePage() {
  return <HomeClient />;
}
