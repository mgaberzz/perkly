"use client";
import { useState } from "react";
import { Field, Input, Select } from "./ui";

export type ChannelLabels = {
  sells: string; inStore: string; online: string; both: string;
  branches: string; branchesHint: string; address: string; addressHint: string;
  website: string; social: string; onlineHint: string; optional: string;
};

/** The "Sells" choice decides which fields are required: branches and address for in-store, website and social for online. */
export function ApplyChannelFields({ labels, options, defaultChannel = "in_store" }: {
  labels: ChannelLabels; options: { value: string; label: string }[]; defaultChannel?: string;
}) {
  const [channel, setChannel] = useState(defaultChannel);
  const inStore = channel !== "online";
  const online = channel !== "in_store";
  return (
    <>
      <Field label={labels.sells} className="sm:col-span-2">
        <Select name="channel" value={channel} onChange={(e) => setChannel(e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </Field>
      {inStore && (
        <>
          <Field label={labels.branches} hint={labels.branchesHint}>
            <Input name="branches" type="number" min={1} max={500} defaultValue={1} required />
          </Field>
          <Field label={labels.address} hint={labels.addressHint} className="sm:col-span-2">
            <Input name="address" maxLength={300} required />
          </Field>
        </>
      )}
      {online && (
        <>
          <Field label={labels.website} hint={labels.onlineHint}>
            <Input name="website_url" maxLength={300} placeholder="https://" required />
          </Field>
          <Field label={labels.social} hint={labels.onlineHint}>
            <Input name="social_url" maxLength={300} placeholder="instagram.com/…" required />
          </Field>
        </>
      )}
      {!online && (
        <>
          <Field label={`${labels.website} (${labels.optional})`}>
            <Input name="website_url" maxLength={300} placeholder="https://" />
          </Field>
          <Field label={`${labels.social} (${labels.optional})`}>
            <Input name="social_url" maxLength={300} placeholder="instagram.com/…" />
          </Field>
        </>
      )}
    </>
  );
}
