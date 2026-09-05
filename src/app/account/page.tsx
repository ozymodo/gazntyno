import type { Metadata } from "next";
import AccountContent from "@/components/account/AccountContent";

export const metadata: Metadata = {
  title: "Account — gazntyno",
  description: "Your profile and progress on gazntyno.",
};

export default function AccountPage() {
  return <AccountContent />;
}
