import type { Metadata } from "next";
import AccountContent from "@/components/account/AccountContent";

export const metadata: Metadata = {
  title: "account — zyme",
  description: "your profile and progress on zyme.",
};

export default function AccountPage() {
  return <AccountContent />;
}
