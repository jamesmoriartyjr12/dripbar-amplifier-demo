import type { Metadata } from "next";
import { OrbPreview } from "@/components/orbs/OrbPreview";

export const metadata: Metadata = {
  title: "Orb options · DRIPBaR demo",
  robots: { index: false },
};

export default function OrbsPage() {
  return <OrbPreview />;
}
