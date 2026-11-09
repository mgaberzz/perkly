/** Tabs on a merchant's page in the team portal: Overview | Portal access | Edit */
export function merchantTabs(id: string, editable: boolean, t: (s: string) => string) {
  return [
    { href: `/admin/merchants/${id}`, label: t("Overview") },
    { href: `/admin/merchants/${id}/access`, label: t("Portal access") },
    ...(editable ? [{ href: `/admin/merchants/${id}/edit`, label: t("Edit") }] : []),
  ];
}

/** Tabs on the Merchants list in the team portal: All merchants | Applications (n) | New merchant */
export function merchantListTabs(t: (s: string, v?: Record<string, string | number>) => string, pending: number) {
  return [
    { href: "/admin/merchants", label: t("All merchants") },
    { href: "/admin/merchants/applications", label: pending ? t("Applications ({n})", { n: pending }) : t("Applications") },
    { href: "/admin/merchants/new", label: t("New merchant") },
  ];
}
