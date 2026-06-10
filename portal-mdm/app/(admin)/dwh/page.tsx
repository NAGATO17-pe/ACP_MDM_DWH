import type { Metadata } from "next";
import { DwhExplorerClient } from "./dwh-client";

export const metadata: Metadata = { title: "DWH Explorer" };

export default function DwhPage() {
  return <DwhExplorerClient />;
}
