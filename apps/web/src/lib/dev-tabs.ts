/** Tabs on the merchant Developers pages: API keys | Webhooks | Documentation */
export const devTabs = (t: (s: string) => string) => [
  { href: "/merchant/developers", label: t("API keys") },
  { href: "/merchant/developers/webhooks", label: t("Webhooks") },
  { href: "/merchant/developers/docs", label: t("Documentation") },
];
