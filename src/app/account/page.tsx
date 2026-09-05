import type { Metadata } from "next";
import ComingSoon from "@/components/common/ComingSoon";

export const metadata: Metadata = {
  title: "Account — Technature",
  description: "Account settings for Technature.",
};

export default function AccountPage() {
  return <ComingSoon title="ACCOUNT" tagline="Coming soon." accent="210, 180, 220" />;
}
