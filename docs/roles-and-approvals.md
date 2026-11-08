# Roles, Access & Approvals

How the Perkly portals decide who sees what and who approves what. These rules are enforced in the database
(row-level security + server functions), not just hidden in the menu.

## Approvals

Every request lands in **Admin portal → Notifications**, visible only to the roles that can decide it.

| Approval | Requested by | Approved by | Where | What happens when approved | If rejected |
| --- | --- | --- | --- | --- | --- |
| New cashier QR code | Merchant owner / manager / branch manager | Admin, Operations, Account manager (own merchants) | Notifications · Merchant page | QR starts working at that cashier | QR stays unusable; reason shown to merchant |
| Hero perk (above 30% off) | Merchant owner / manager | Admin, Operations, Account manager (own merchants) | Notifications · Campaigns & perks | Perk goes live in the app | Perk marked rejected with the reason |
| Online cashback (tracked-link order) | Online merchant reports the order | Admin, Finance | Notifications | Cashback moves to the student's balance (+20 XP) | Pending cashback removed |
| Settlement payment (full or partial) | Settlement created by Finance (in-app payments netted against commission on cashier sales) | Admin, Finance | Finance & settlements → Record payment | Transactions move from *Not settled yet* to *Partially settled* or *Settled* | Stays *Not settled yet* |
| Merchant goes live | Merchant signs up / is created | Admin, Operations, Account manager (own) | Merchant page → Status | Merchant and perks visible to students | Stays pending / paused |
| Commission % and plan | — | Admin, Operations only | Merchant page | New rate applies to future transactions | — |
| Team roles (operations, finance, account manager) | — | Admin only | Users & roles | Person gets that portal view | — |
| Account manager assignments | — | Admin only | Team & assignments | AM sees and manages only those merchants / campuses | — |
| Payments mode (off / test / live) | — | Admin only | Finance & settlements | Controls whether students can pay in the app | — |

## Perkly team roles (portal: /admin)

| Area | Admin | Operations | Account manager | Finance |
| --- | --- | --- | --- | --- |
| Merchants they see | All | All | Only assigned merchants (+ merchants on assigned campuses) | All (read-only) |
| Overview | All of Perkly | All of Perkly | My merchants & my customers | Money: due, payouts, commission |
| Notifications | Everything | Cashier QR + perk approvals | Cashier QR + perk approvals, own merchants | Cashback + payouts only |
| Merchants | Create + edit | Create + edit | Edit own (not commission / plan) | View only |
| Commission & plan | ✅ | ✅ | ❌ | ❌ |
| Campaigns & perks | ✅ | ✅ | Own merchants | ❌ |
| Transactions | All + reverse | All + reverse | Own merchants, view | All, view + Excel/CSV |
| Finance & settlements | ✅ + payment mode | ❌ | ❌ | ✅ |
| Student data (names, stats) | All | All | Only own merchants' customers | Only customers in transactions |
| Users & roles, Team & assignments | ✅ | ❌ | ❌ | ❌ |
| Campuses | Edit | Edit | View own campuses | ❌ |
| Quests | ✅ | ✅ | ❌ | ❌ |

## Merchant staff roles (portal: /merchant)

| Area | Owner | Manager | Branch manager | Cashier |
| --- | --- | --- | --- | --- |
| Dashboard & insights | All branches | All branches | Own branch only | ❌ |
| Transactions + Excel/CSV | ✅ | ✅ | Own branch | ✅ |
| Online orders (codes, cashback) | ✅ | ✅ | ❌ | ✅ |
| Perks | ✅ | ✅ | ❌ | ❌ |
| Branches & cashier QR codes | ✅ (add / remove) | ✅ (add) | Own branch: request cashier QR | ❌ |
| Payouts & settlements | ✅ + bank details | View | ❌ | ❌ |
| Team | Invite / remove | View | ❌ | ❌ |
| Business profile | ✅ | ✅ | ❌ | ❌ |

## IDs

IDs (numbers only, first digit = type): user `1xxxxxxx` · student `2xxxxxxx` · merchant `3xxxxx` · transaction `9xxxxxxxxx` · brand types: Local, Chain, Mega account.
