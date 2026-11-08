import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage({ searchParams }: PageProps<"/privacy">) {
  return <LegalPage kind="privacy" searchParams={searchParams} />;
}
