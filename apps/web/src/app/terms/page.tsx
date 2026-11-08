import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Terms of Use" };

export default function TermsPage({ searchParams }: PageProps<"/terms">) {
  return <LegalPage kind="terms" searchParams={searchParams} />;
}
