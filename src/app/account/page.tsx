import type { Metadata } from "next";
import AccountContent from "@/components/account/AccountContent";

export const metadata: Metadata = {
  title: "Account — Technature",
  description: "Your profile and progress on Technature.",
};

export default function AccountPage() {
  return <AccountContent />;
}
