/** Tabs on a merchant's page in the team portal: Overview | Portal access | Edit */
export function merchantTabs(id: string, editable: boolean, t: (s: string) => string) {
  return [
    { href: `/admin/merchants/${id}`, label: t("Overview") },
    { href: `/admin/merchants/${id}/access`, label: t("Portal access") },
    ...(editable ? [{ href: `/admin/merchants/${id}/edit`, label: t("Edit") }] : []),
  ];
}
