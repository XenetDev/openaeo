// affectUI Pro – licensed under https://www.affectui.com/license, not under this project's open-source license. Don't copy it out of this project.
"use client";

/*
 * CRM – a company list with pipelines, open views as tabs and an editable table, in a single file.
 * A path with a favorite star on top, then the open views as tabs – companies, deals, contacts and renewals,
 * each a Data Table from the library filling the rest of the panel. Sits in the affectUI App Shell; icons from the Hugeicons free set,
 * company logos from Simple Icons (CC0).
 */

import { useState, type KeyboardEvent } from "react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  Analytics01Icon,
  ArrowDown01Icon,
  Building03Icon,
  Calendar03Icon,
  Dollar01Icon,
  FileAddIcon,
  Folder01Icon,
  GridViewIcon,
  Home01Icon,
  KanbanIcon,
  Link01Icon,
  RefreshIcon,
  StarIcon,
  Table01Icon,
  Tag01Icon,
  Target02Icon,
  TextAlignLeftIcon,
  UserIcon,
  UserMultipleIcon,
  ChartLineData01Icon,
  Briefcase01Icon,
  UserGroupIcon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button-clean";
import { DataTable, type DataColumn, type DataRow, type TagTone } from "@/components/ui/data-table-clean";
import { AppShell, Dropdown, EmptyState, Icon, Loading, Skeleton, useToast, type AppShellProps, type ShellGroup, type ShellNavItem } from "@/components/app-shell";

/** Sample content – replace with your own data */
const nav: ShellNavItem[] = [
  { label: "Home", icon: Home01Icon },
  { label: "Companies", icon: Building03Icon, count: 284 },
  { label: "Contacts", icon: UserMultipleIcon },
  { label: "Deals", icon: Dollar01Icon },
  { label: "Reports", icon: Analytics01Icon },
];
const groups: ShellGroup[] = [
  {
    label: "Pipelines",
    items: [
      { label: "New business", icon: Target02Icon },
      { label: "Renewals", icon: RefreshIcon },
      { label: "Partnerships", icon: UserMultipleIcon },
    ],
  },
];

/** Company marks (Simple Icons, CC0): [color, path] on a 24 × 24 grid */
const LOGOS: Record<string, [string, string]> = {
  notion: ["#171717", "M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"],
  linear: ["#5E6AD2", "M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z"],
  figma: ["#F24E1E", "M15.852 8.981h-4.588V0h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491zM12.735 7.51h3.117c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-3.117V7.51zm0 1.471H8.148c-2.476 0-4.49-2.014-4.49-4.49S5.672 0 8.148 0h4.588v8.981zm-4.587-7.51c-1.665 0-3.019 1.355-3.019 3.019s1.354 3.02 3.019 3.02h3.117V1.471H8.148zm4.587 15.019H8.148c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h4.588v8.98zM8.148 8.981c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h3.117V8.981H8.148zM8.172 24c-2.489 0-4.515-2.014-4.515-4.49s2.014-4.49 4.49-4.49h4.588v4.441c0 2.503-2.047 4.539-4.563 4.539zm-.024-7.51a3.023 3.023 0 0 0-3.019 3.019c0 1.665 1.365 3.019 3.044 3.019 1.705 0 3.093-1.376 3.093-3.068v-2.97H8.148zm7.704 0h-.098c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h.098c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.49-4.49 4.49zm-.097-7.509c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h.098c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-.098z"],
  stripe: ["#635BFF", "M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"],
  shopify: ["#5fc88a", "M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.057-.121-.074l-.914 21.104h.023zM11.71 11.305s-.81-.424-1.774-.424c-1.447 0-1.504.906-1.504 1.141 0 1.232 3.24 1.715 3.24 4.629 0 2.295-1.44 3.76-3.406 3.76-2.354 0-3.54-1.465-3.54-1.465l.646-2.086s1.245 1.066 2.28 1.066c.675 0 .975-.545.975-.932 0-1.619-2.654-1.694-2.654-4.359-.034-2.237 1.571-4.416 4.827-4.416 1.257 0 1.875.361 1.875.361l-.945 2.715-.02.01zM11.17.83c.136 0 .271.038.405.135-.984.465-2.064 1.639-2.508 3.992-.656.213-1.293.405-1.889.578C7.697 3.75 8.951.84 11.17.84V.83zm1.235 2.949v.135c-.754.232-1.583.484-2.394.736.466-1.777 1.333-2.645 2.085-2.971.193.501.309 1.176.309 2.1zm.539-2.234c.694.074 1.141.867 1.429 1.755-.349.114-.735.231-1.158.366v-.252c0-.752-.096-1.371-.271-1.871v.002zm2.992 1.289c-.02 0-.06.021-.078.021s-.289.075-.714.21c-.423-1.233-1.176-2.37-2.508-2.37h-.115C12.135.209 11.669 0 11.265 0 8.159 0 6.675 3.877 6.21 5.846c-1.194.365-2.063.636-2.16.674-.675.213-.694.232-.772.87-.075.462-1.83 14.063-1.83 14.063L15.009 24l.927-21.166z"],
  airtable: ["#18BFFF", "M11.992 1.966c-.434 0-.87.086-1.28.257L1.779 5.917c-.503.208-.49.908.012 1.116l8.982 3.558a3.266 3.266 0 0 0 2.454 0l8.982-3.558c.503-.196.503-.908.012-1.116l-8.957-3.694a3.255 3.255 0 0 0-1.272-.257zM23.4 8.056a.589.589 0 0 0-.222.045l-10.012 3.877a.612.612 0 0 0-.38.564v8.896a.6.6 0 0 0 .821.552L23.62 18.1a.583.583 0 0 0 .38-.551V8.653a.6.6 0 0 0-.6-.596zM.676 8.095a.644.644 0 0 0-.48.19C.086 8.396 0 8.53 0 8.69v8.355c0 .442.515.737.908.54l6.27-3.006.307-.147 2.969-1.436c.466-.22.43-.908-.061-1.092L.883 8.138a.57.57 0 0 0-.207-.044z"],
  hubspot: ["#FF7A59", "M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z"],
  webflow: ["#0190fe", "m24 4.515-7.658 14.97H9.149l3.205-6.204h-.144C9.566 16.713 5.621 18.973 0 19.485v-6.118s3.596-.213 5.71-2.435H0V4.515h6.417v5.278l.144-.001 2.622-5.277h4.854v5.244h.144l2.72-5.244H24Z"],
  vercel: ["#171717", "m12 1.608 12 20.784H0Z"],
  clickup: ["#a651f0", "M2 18.439l3.69-2.828c1.961 2.56 4.044 3.739 6.363 3.739 2.307 0 4.33-1.166 6.203-3.704L22 18.405C19.298 22.065 15.941 24 12.053 24 8.178 24 4.788 22.078 2 18.439zM12.04 6.15l-6.568 5.66-3.036-3.52L12.055 0l9.543 8.296-3.05 3.509z"],
};

/** First character of a name as a whole grapheme – an emoji or accented letter stays in one piece */
const firstChar = (s: string) => {
  const t = s.trim();
  if (!t) return "";
  const Segmenter = (Intl as unknown as { Segmenter?: new () => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Segmenter) for (const part of new Segmenter().segment(t)) return part.segment;
  return Array.from(t)[0];
};

/** The company's mark, or its first letter when there is no mark for it */
const Logo = ({ id, name }: { id: string; name: string }) => (
  <span className="ui-as-crm__logo">
    {LOGOS[id] ? (
      <svg viewBox="0 0 24 24" fill={LOGOS[id][0]} aria-hidden="true">
        <path d={LOGOS[id][1]} />
      </svg>
    ) : (
      <b aria-hidden="true">{firstChar(name).toUpperCase()}</b>
    )}
  </span>
);

/** Coloured tiles for the view tabs – never white: brand colour with a white mark, or the full-colour mark on black */
const FigmaMark = () => (
  <svg viewBox="0 0 38 57" aria-hidden="true">
    <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0Z" fill="#1ABCFE" />
    <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0Z" fill="#0ACF83" />
    <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19Z" fill="#FF7262" />
    <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5Z" fill="#F24E1E" />
    <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5Z" fill="#A259FF" />
  </svg>
);
const TabMark = ({ id }: { id: string }) =>
  id === "figma" ? (
    <span className="ui-as-crm__tab-logo" style={{ background: "#1e1e1e" }}>
      <FigmaMark />
    </span>
  ) : (
    <span className="ui-as-crm__tab-logo" style={{ background: id === "notion" ? "#171717" : LOGOS[id][0] }}>
      <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
        <path d={LOGOS[id][1]} />
      </svg>
    </span>
  );

export type CrmCompany = {
  id: string;
  name: string;
  category: string;
  domain: string;
  owner: string;
  value: number;
  stage: string;
  contact: string;
};

const companies: CrmCompany[] = [
  { id: "notion", name: "Notion", category: "Productivity", domain: "notion.so", owner: "Mara Klein", value: 48000, stage: "Negotiation", contact: "Today" },
  { id: "linear", name: "Linear", category: "Planning", domain: "linear.app", owner: "Jonas Weber", value: 12500, stage: "Proposal", contact: "Yesterday" },
  { id: "figma", name: "Figma", category: "Design", domain: "figma.com", owner: "Mara Klein", value: 86000, stage: "Won", contact: "Mar 6" },
  { id: "stripe", name: "Stripe", category: "Payments", domain: "stripe.com", owner: "Lea Braun", value: 124000, stage: "Qualified", contact: "Mar 5" },
  { id: "shopify", name: "Shopify", category: "E-commerce", domain: "shopify.com", owner: "Jonas Weber", value: 9800, stage: "New", contact: "Mar 4" },
  { id: "vercel", name: "Vercel", category: "Developer Tools", domain: "vercel.com", owner: "Lea Braun", value: 62000, stage: "Proposal", contact: "Mar 3" },
  { id: "airtable", name: "Airtable", category: "Productivity", domain: "airtable.com", owner: "Mara Klein", value: 37500, stage: "Qualified", contact: "Mar 1" },
  { id: "hubspot", name: "HubSpot", category: "CRM", domain: "hubspot.com", owner: "Tom Fischer", value: 21000, stage: "New", contact: "Feb 27" },
  { id: "clickup", name: "ClickUp", category: "Planning", domain: "clickup.com", owner: "Tom Fischer", value: 6400, stage: "Lost", contact: "Feb 25" },
  { id: "webflow", name: "Webflow", category: "Design", domain: "webflow.com", owner: "Lea Braun", value: 18900, stage: "Negotiation", contact: "Feb 24" },
];

const columns: DataColumn[] = [
  { key: "company", label: "Company", icon: <Icon icon={TextAlignLeftIcon} size={15} />, type: "title", width: "16%" },
  { key: "category", label: "Category", icon: <Icon icon={Tag01Icon} size={15} />, type: "tag", width: "14%" },
  { key: "domain", label: "Domain", icon: <Icon icon={Link01Icon} size={15} />, type: "link", width: "14%" },
  { key: "owner", label: "Owner", icon: <Icon icon={UserIcon} size={15} />, type: "text", width: "12%" },
  { key: "value", label: "Value", icon: <Icon icon={Dollar01Icon} size={15} />, type: "number", width: "12%" },
  { key: "stage", label: "Stage", icon: <Icon icon={KanbanIcon} size={15} />, type: "tag", width: "12%" },
  { key: "contact", label: "Last contact", icon: <Icon icon={Calendar03Icon} size={15} />, type: "text" },
];

const toRows = (companies: CrmCompany[]): DataRow[] => companies.map((c) => ({
  id: c.id,
  company: c.name,
  logo: <Logo id={c.id} name={c.name} />,
  category: c.category,
  // No domain, no link
  domain: !c.domain ? "" : /^https?:\/\//.test(c.domain) ? c.domain : `https://${c.domain}`,
  owner: c.owner,
  value: Number.isFinite(c.value) ? c.value : "",
  stage: c.stage,
  contact: c.contact,
}));

const tones: Record<string, TagTone> = {
  Productivity: "gray",
  Planning: "blue",
  Design: "pink",
  Payments: "violet",
  "E-commerce": "amber",
  "Developer Tools": "gray",
  CRM: "blue",
  New: "gray",
  Qualified: "blue",
  Proposal: "violet",
  Negotiation: "amber",
  Won: "green",
  Lost: "pink",
  Founder: "violet",
  "Head of Ops": "gray",
  "VP Sales": "blue",
  Procurement: "amber",
  "Head of Design": "pink",
  Team: "gray",
  Business: "blue",
  Enterprise: "violet",
  Healthy: "green",
  Watch: "amber",
  "At risk": "pink",
};

/** Open views, each a table, marked with the tool it lives in */
const tabs = [
  { label: "Company CRM", logo: "hubspot" },
  { label: "Deals", logo: "stripe" },
  { label: "Contacts", logo: "airtable" },
  { label: "Renewals", logo: "notion" },
];

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const money = (n: number) => usd.format(n);

/** Deals: one per company, with how likely it closes */
const dealColumns: DataColumn[] = [
  { key: "deal", label: "Deal", icon: <Icon icon={TextAlignLeftIcon} size={15} />, type: "title", width: "22%" },
  { key: "stage", label: "Stage", icon: <Icon icon={KanbanIcon} size={15} />, type: "tag", width: "13%" },
  { key: "amount", label: "Amount", icon: <Icon icon={Dollar01Icon} size={15} />, type: "number", width: "13%", format: money },
  { key: "chance", label: "Probability", icon: <Icon icon={Target02Icon} size={15} />, type: "number", width: "12%", format: (n) => `${n}%` },
  { key: "close", label: "Close date", icon: <Icon icon={Calendar03Icon} size={15} />, type: "text", width: "13%" },
  { key: "owner", label: "Owner", icon: <Icon icon={UserIcon} size={15} />, type: "text" },
];
const chance: Record<string, number> = { New: 10, Qualified: 30, Proposal: 50, Negotiation: 70, Won: 100, Lost: 0 };
const closes = ["Apr 12", "Apr 30", "Mar 2", "May 15", "Jun 1", "Apr 18", "May 3", "Jun 20", "Feb 28", "Apr 25"];
const toDeals = (list: CrmCompany[]): DataRow[] =>
  list.map((c, i) => ({
    id: `deal-${c.id}`,
    deal: `${c.name} – ${c.value >= 50000 ? "Enterprise" : "Team"} plan`,
    logo: <Logo id={c.id} name={c.name} />,
    stage: c.stage,
    amount: Number.isFinite(c.value) ? c.value : "",
    chance: chance[c.stage] ?? "",
    close: closes[i % closes.length],
    owner: c.owner,
  }));

/** Contacts: the people at each company */
const contactColumns: DataColumn[] = [
  { key: "name", label: "Name", icon: <Icon icon={UserIcon} size={15} />, type: "title", width: "18%" },
  { key: "company", label: "Company", icon: <Icon icon={Building03Icon} size={15} />, type: "text", width: "14%" },
  { key: "role", label: "Role", icon: <Icon icon={Tag01Icon} size={15} />, type: "tag", width: "16%" },
  { key: "email", label: "Email", icon: <Icon icon={Link01Icon} size={15} />, type: "text", width: "22%" },
  { key: "owner", label: "Owner", icon: <Icon icon={UserMultipleIcon} size={15} />, type: "text", width: "13%" },
  { key: "contact", label: "Last contact", icon: <Icon icon={Calendar03Icon} size={15} />, type: "text" },
];
const people = ["Nina Hartmann", "Omar Haddad", "Sofia Lind", "Daniel Okafor", "Clara Wenzel", "Ravi Mehta", "Elena Rossi", "Jakob Berg", "Mei Tanaka", "Lucas Moreau"];
const roles = ["Founder", "Head of Ops", "VP Sales", "Procurement", "Head of Design"];
const toContacts = (list: CrmCompany[]): DataRow[] =>
  list.map((c, i) => {
    const name = people[i % people.length];
    return {
      id: `contact-${c.id}`,
      name,
      logo: <span className="ui-as-crm__avatar" aria-hidden="true">{name.split(" ").map((w) => firstChar(w)).join("").slice(0, 2).toUpperCase()}</span>,
      company: c.name,
      role: roles[i % roles.length],
      email: c.domain ? `${name.split(" ")[0].toLowerCase()}@${c.domain.replace(/^https?:\/\//, "")}` : "",
      owner: c.owner,
      contact: c.contact,
    };
  });

/** Renewals: the won and running accounts, when they renew and how healthy they look */
const renewalColumns: DataColumn[] = [
  { key: "account", label: "Account", icon: <Icon icon={TextAlignLeftIcon} size={15} />, type: "title", width: "18%" },
  { key: "plan", label: "Plan", icon: <Icon icon={Tag01Icon} size={15} />, type: "tag", width: "13%" },
  { key: "seats", label: "Seats", icon: <Icon icon={UserMultipleIcon} size={15} />, type: "number", width: "10%" },
  { key: "arr", label: "ARR", icon: <Icon icon={Dollar01Icon} size={15} />, type: "number", width: "14%", format: money },
  { key: "renews", label: "Renews", icon: <Icon icon={Calendar03Icon} size={15} />, type: "text", width: "14%" },
  { key: "health", label: "Health", icon: <Icon icon={Analytics01Icon} size={15} />, type: "tag", width: "13%" },
  { key: "owner", label: "Owner", icon: <Icon icon={UserIcon} size={15} />, type: "text" },
];
const renewDates = ["May 1", "Jun 14", "Jul 3", "Aug 22", "Sep 9", "Oct 1", "Nov 18", "Dec 5", "Jan 12", "Feb 2"];
const health = ["Healthy", "Healthy", "At risk", "Healthy", "Watch"];
const toRenewals = (list: CrmCompany[]): DataRow[] =>
  list.map((c, i) => ({
    id: `renewal-${c.id}`,
    account: c.name,
    logo: <Logo id={c.id} name={c.name} />,
    plan: c.value >= 50000 ? "Enterprise" : c.value >= 15000 ? "Business" : "Team",
    seats: Number.isFinite(c.value) ? Math.max(5, Math.round(c.value / 900)) : "",
    arr: Number.isFinite(c.value) ? c.value : "",
    renews: renewDates[i % renewDates.length],
    health: health[i % health.length],
    owner: c.owner,
  }));

/** Arrow keys, Home and End move between the view tabs and open the one they land on */
const arrowTabs = (e: KeyboardEvent<HTMLElement>) => {
  const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
  if (!keys.includes(e.key)) return;
  const list = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const at = list.indexOf(document.activeElement as HTMLButtonElement);
  const next = e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : (at + (e.key === "ArrowLeft" ? -1 : 1) + list.length) % list.length;
  e.preventDefault();
  list[next]?.focus();
  list[next]?.click();
};

export type CrmScreenProps = Pick<AppShellProps, "onNavigate" | "workspace" | "user" | "className"> & {
  /** Companies behind every table – id picks the logo */
  companies?: CrmCompany[];
  /** While your data loads: the open view shows gray rows in the shape of the real ones, under the real column heads */
  loading?: boolean;
  /** No companies yet: path and view tabs stay, the open view's table gives way to an empty state with an Add company (or contact) button */
  empty?: boolean;
  /** Called by the empty state's button with the open view */
  onAdd?: (view: string) => void;
};

/** What each view says when there's nothing in it yet, and its first step */
const emptyCopy: Record<string, { title: string; text: string; action: string; icon: IconSvgElement }> = {
  "Company CRM": { title: "No companies yet", text: "Companies you add or import show up here with owner, stage and value.", action: "Add company", icon: Building03Icon },
  Deals: { title: "No deals yet", text: "Deals show up here with their stage and value once you add your first company.", action: "Add company", icon: Dollar01Icon },
  Contacts: { title: "No contacts yet", text: "The people you talk to at each company show up here.", action: "Add contact", icon: UserMultipleIcon },
  Renewals: { title: "No renewals coming up", text: "Contracts up for renewal show up here with their date and health.", action: "Add company", icon: RefreshIcon },
};

const noCompanies: CrmCompany[] = [];

/** Each view's columns – the loading table draws the same ones */
const viewColumns: Record<string, DataColumn[]> = { "Company CRM": columns, Deals: dealColumns, Contacts: contactColumns, Renewals: renewalColumns };
/** Bar widths for the loading rows – fixed, so it renders the same every time */
const skelWidths = [0.82, 0.64, 0.74, 0.56, 0.9, 0.68, 0.78, 0.6, 0.86, 0.7];
const skelBase: Record<NonNullable<DataColumn["type"]>, number> = { title: 96, tag: 76, link: 104, number: 64, text: 84 };

/** The view's table while the data loads: the real column heads, then a gray row per company – the Data Table's sizes, so nothing moves when it lands */
function SkelTable({ columns: cols, rows, label, round }: { columns: DataColumn[]; rows: number; label: string; round?: boolean }) {
  return (
    <section className="ui-as-crm__skel" aria-label={label}>
      <Loading label={`Loading ${label}`} className="ui-as-crm__skel-scroll">
        <table className="ui-as-crm__skel-table" role="presentation">
          <colgroup>
            <col style={{ width: 40 }} />
            {cols.map((c) => (
              <col key={c.key} style={c.width ? { width: c.width } : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="ui-as-crm__skel-select" />
              {cols.map((col) => (
                <th key={col.key}>
                  <span className="ui-as-crm__skel-th">
                    {col.icon && <span className="ui-as-crm__skel-icon">{col.icon}</span>}
                    <span className="ui-as-crm__skel-label">{col.label}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r} data-skel="">
                <td className="ui-as-crm__skel-select" />
                {cols.map((col, c) => {
                  const w = Math.round(skelBase[col.type ?? "text"] * skelWidths[(r + c * 3) % skelWidths.length]);
                  return (
                    <td key={col.key}>
                      {col.type === "title" ? (
                        <span className="ui-as-crm__skel-line ui-as-crm__skel-name">
                          <Skeleton width={16} height={16} radius={round ? "50%" : 5} />
                          <Skeleton width={w} height={10} />
                        </span>
                      ) : col.type === "tag" ? (
                        <Skeleton width={w} height={20} radius={5} />
                      ) : (
                        <span className="ui-as-crm__skel-line">
                          <Skeleton width={w} height={10} />
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Loading>
      {/* The table's last row, empty until the data lands */}
      <div className="ui-as-crm__skel-foot" />
    </section>
  );
}

export function CrmScreen({ companies: companyProp = companies, loading, empty: emptyProp, onAdd, ...props }: CrmScreenProps) {
  // Loading wins over empty
  const empty = !!emptyProp && !loading;
  const companyList = empty ? noCompanies : companyProp;
  const [tab, setTab] = useState(tabs[0].label);
  const [starred, setStarred] = useState(false);
  const [view, setView] = useState("Head of Sales");
  const [toast, showToast] = useToast();

  return (
    <AppShell active="Companies" nav={nav} groups={groups} {...props}>
      <style href="ui-screen-crm" precedence="default">
        {css}
      </style>
      <div className="ui-as-crm">
        <header className="ui-as-crm__top">
          <span className="ui-as-crm__path">
            <Icon icon={Folder01Icon} size={15} />
            <span>Sales</span>
            <i>/</i>
            <Dropdown
              title="Views"
              items={(
                [
                  ["Head of Sales", ChartLineData01Icon],
                  ["Account executive", Briefcase01Icon],
                  ["Partner manager", UserGroupIcon],
                ] as const
              ).map(([v, icon]) => ({ label: v, icon, checked: v === view, onSelect: () => setView(v) }))}
              trigger={({ open, toggle }) => (
                <button type="button" className="ui-as-crm__view" aria-expanded={open} onClick={toggle}>
                  {view}
                  <Icon icon={ArrowDown01Icon} size={13} />
                </button>
              )}
            />
          </span>
          <button
            type="button"
            className="ui-as-icon-btn ui-as-crm__star"
            aria-label={starred ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={starred}
            onClick={() => {
              setStarred((s) => !s);
              showToast(starred ? "Removed from favorites" : "Added to favorites");
            }}
          >
            <Icon icon={StarIcon} size={15} />
          </button>
        </header>

        <nav className="ui-as-crm__tabs" aria-label="Open views">
          <button type="button" className="ui-as-icon-btn" aria-label="New view" onClick={() => showToast("New views are coming soon")}>
            <Icon icon={FileAddIcon} size={16} />
          </button>
          <button type="button" className="ui-as-icon-btn" aria-label="All views" onClick={() => showToast("All views are coming soon")}>
            <Icon icon={GridViewIcon} size={16} />
          </button>
          <span className="ui-as-crm__sep" />
          <span className="ui-as-crm__tablist" role="tablist" aria-label="Views" onKeyDown={arrowTabs}>
          {tabs.map((t) => (
            <button
              key={t.label}
              type="button"
              role="tab"
              id={`ui-as-crm-tab-${t.logo}`}
              className="ui-as-crm__tab"
              aria-selected={tab === t.label}
              aria-controls="ui-as-crm-panel"
              tabIndex={tab === t.label ? 0 : -1}
              onClick={(e) => {
                setTab(t.label);
                // On a narrow screen the views scroll sideways – bring the picked one fully into view
                const el = e.currentTarget;
                const bar = el.closest<HTMLElement>(".ui-as-crm__tabs");
                if (!bar || bar.scrollWidth <= bar.clientWidth) return;
                const left = Math.min(el.offsetLeft - 14, Math.max(bar.scrollLeft, el.offsetLeft + el.offsetWidth + 14 - bar.clientWidth));
                bar.scrollTo({ left, behavior: "smooth" });
              }}
            >
              <TabMark id={t.logo} />
              {t.label}
            </button>
          ))}
          </span>
        </nav>

        <div
          className="ui-as-crm__table"
          key={tab}
          role="tabpanel"
          id="ui-as-crm-panel"
          aria-labelledby={`ui-as-crm-tab-${tabs.find((t) => t.label === tab)?.logo}`}
        >
          {loading && <SkelTable columns={viewColumns[tab] ?? columns} rows={Math.max(1, companyList.length || companies.length)} label={tab} round={tab === "Contacts"} />}
          {!loading && !companyList.length && (() => {
            const e = emptyCopy[tab] ?? emptyCopy["Company CRM"];
            return (
              <EmptyState
                bare
                icon={e.icon}
                title={e.title}
                text={e.text}
                action={
                  <Button variant="secondary" size="sm" icon={<Icon icon={PlusSignIcon} size={15} />} onClick={() => (onAdd ? onAdd(tab) : showToast(`${e.action.replace("Add ", "New ")} added`))}>
                    {e.action}
                  </Button>
                }
              />
            );
          })()}
          {!loading && !!companyList.length && tab === "Company CRM" && (
            <DataTable title="Company CRM" icon={<Icon icon={Table01Icon} size={16} />} columns={columns} rows={toRows(companyList)} tagTones={tones} />
          )}

          {!loading && !!companyList.length && tab === "Deals" && (
            <DataTable title="Deals" icon={<Icon icon={Dollar01Icon} size={16} />} columns={dealColumns} rows={toDeals(companyList)} tagTones={tones} />
          )}
          {!loading && !!companyList.length && tab === "Contacts" && (
            <DataTable title="Contacts" icon={<Icon icon={UserMultipleIcon} size={16} />} columns={contactColumns} rows={toContacts(companyList)} tagTones={tones} />
          )}
          {!loading && !!companyList.length && tab === "Renewals" && (
            <DataTable title="Renewals" icon={<Icon icon={RefreshIcon} size={16} />} columns={renewalColumns} rows={toRenewals(companyList)} tagTones={tones} />
          )}
        </div>
      </div>
      {toast}
    </AppShell>
  );
}

/* ---------- Styles ---------- */

const css = /* css */ `
/* CRM: path and tabs on the panel, the table as its own white layer below */
.ui-as-crm { display: flex; flex-direction: column; height: 100%; min-height: 0; padding: 0 0 12px; }
.ui-as-crm__top { display: flex; flex: none; align-items: center; gap: 6px; height: var(--as-head-h, 48px); padding: 0 16px 0 20px; }
.ui-as-crm__path { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 13px; color: var(--muted); white-space: nowrap; }
.ui-as-crm__path i { font-style: normal; color: var(--faint); }
.ui-as-crm__view {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  margin-left: -6px;
  padding: 0 6px;
  border-radius: var(--aui-radius, 7px);
  font-weight: 500;
  color: var(--ink);
  transition: background-color 140ms ease;
}
.ui-as-crm__view:hover { background: var(--hover); }
.ui-as-crm__star { width: 26px; height: 26px; }
.ui-as-crm__star[aria-pressed="true"] { color: var(--aui-amber, #e8b000); }
.ui-as-crm__star[aria-pressed="true"] path { fill: currentColor; }

.ui-as-crm__tabs { display: flex; flex: none; align-items: center; gap: 4px; padding: 0 14px 12px; }
.ui-as-crm__sep { width: 1px; height: 18px; margin: 0 6px; background: var(--line); }
.ui-as-crm__tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 12px 0 10px;
  border-radius: calc(var(--aui-radius, 7px) + 2px);
  font-size: 13px;
  color: var(--muted);
  transition: background-color 140ms ease, color 140ms ease;
}
.ui-as-crm__tab:hover { color: var(--ink); background: var(--hover); }
.ui-as-crm__tablist { display: flex; align-items: center; gap: 4px; }
/* The focus ring sits inside the tab, so the sideways-scrolling bar on narrow screens doesn't cut it off */
.ui-as-crm__tabs :focus-visible { outline-offset: -2px; }
.ui-as-crm__tab[aria-selected="true"] { background: var(--chip); color: var(--ink); font-weight: 500; }

/* The table as a white layer with a thin edge, inset from the panel */
.ui-as-crm__table {
  flex: 1;
  min-height: 0;
  margin: 0 12px;
  overflow: auto;
  border-radius: calc(var(--aui-radius-lg, 10px) + 2px);
  background: var(--card);
  box-shadow: var(--card-shadow);
}
.ui-as .ui-as-crm__table .ui-dtc { --ui-dtc-shadow: none; padding: 0; border-radius: 0; background: transparent; }
/* The tab above already names the table – no title row; the column heads start the layer */
.ui-as-crm__table .ui-dtc__head { display: none; }
/* A line under the last row, so the table ends cleanly before "Add row" */
.ui-as-crm__table .ui-dtc__card { border: 0; border-bottom: 1px solid var(--line); border-radius: 0; }

.ui-as-crm__table > * { animation: ui-as-rise 380ms var(--ease) both; }

/* Empty: the view's empty state in the middle of the white layer */
.ui-as-crm__table > .ui-as-empty[data-bare] { justify-content: center; min-height: 100%; padding: 32px 24px; }

/* Loading: the Data Table's rows and cells drawn with the same sizes – 36px heads, 40px rows under hairlines, the 44px last row –
   with gray bars in place of the values, so nothing moves when the data lands */
.ui-as-crm [data-skel] { pointer-events: none; }
.ui-as-crm__skel { width: 100%; min-width: 0; overflow: hidden; font-size: 13px; line-height: 20px; }
.ui-as-crm__skel-scroll { overflow-x: auto; scrollbar-width: thin; }
.ui-as-crm__skel-table { width: 100%; min-width: 600px; border-collapse: collapse; table-layout: fixed; }
.ui-as-crm__skel-table th,
.ui-as-crm__skel-table td { height: 40px; padding: 0 12px; border-top: 0.5px solid var(--line); text-align: left; vertical-align: middle; white-space: nowrap; overflow: hidden; }
.ui-as-crm__skel-table th { height: 36px; padding: 0 6px; font-size: 12px; font-weight: 500; line-height: 16px; color: var(--text); }
.ui-as-crm__skel-table .ui-as-crm__skel-select { padding: 0; }
.ui-as-crm__skel-th { display: flex; align-items: center; gap: 6px; height: 28px; padding: 0 6px; }
.ui-as-crm__skel-icon { display: grid; color: var(--muted); }
.ui-as-crm__skel-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* A bar centered in the cell's 20px line; the name's logo and bar 8px apart like the real ones */
.ui-as-crm__skel-line { display: flex; align-items: center; min-width: 0; height: 20px; }
.ui-as-crm__skel-name { gap: 8px; }
.ui-as-crm__skel-foot { min-height: 44px; border-top: 0.5px solid var(--line); }
@media (hover: none) and (pointer: coarse) {
  .ui-as-crm__skel-table td { height: 44px; }
  /* The real last row holds a 36px button on touch */
  .ui-as-crm__skel-foot { min-height: 52px; }
}

/* Company mark on a small white tile */
.ui-as-crm__logo {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border-radius: 5px;
  background: #ffffff;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
}
.ui-as-crm__logo svg { width: 64%; height: 64%; }
/* No mark: the first letter on the same tile */
.ui-as-crm__logo b { font-size: 11px; font-weight: 500; line-height: 1; color: #525252; }
.ui-as-crm__tab-logo { display: grid; flex: none; place-items: center; width: 18px; height: 18px; border-radius: 5px; }
.ui-as-crm__tab-logo svg { width: 11px; height: 11px; }
/* A contact's initials in the logo spot */
.ui-as-crm__avatar { display: grid; place-items: center; width: 100%; height: 100%; border-radius: 50%; background: var(--accent-soft); font-size: 7.5px; font-weight: 600; line-height: 1; color: var(--accent); }

/* Touch: the small controls grow to a comfortable 32px */
@media (pointer: coarse) {
  .ui-as-crm__star, .ui-as-crm__tabs .ui-as-icon-btn { width: 32px; height: 32px; }
  .ui-as-crm__view { height: 32px; }
}

/* Room for the sidebar icon on narrow screens, where the sidebar is a drawer */
.ui-as-crm__top { transition: padding-left 420ms var(--ease); }

/* Narrow: the views scroll sideways, the table scrolls inside its layer */
@container ui-as (max-width: 900px) {
  .ui-as-crm__top { padding-left: 52px; }
  .ui-as-crm__tabs { position: relative; overflow-x: auto; scrollbar-width: none; }
  .ui-as-crm__tabs::-webkit-scrollbar { display: none; }
  .ui-as-crm__tabs > *, .ui-as-crm__tablist > * { flex: none; }
  .ui-as-crm__table .ui-dtc__table, .ui-as-crm__skel-table { min-width: 880px; }
}
@container ui-as (max-width: 600px) {
  .ui-as-crm { padding-bottom: 6px; }
  .ui-as-crm__top { padding-right: 8px; }
  .ui-as-crm__tabs { padding: 0 8px 10px; }
  .ui-as-crm__table { margin: 0 6px; border-radius: calc(var(--aui-radius-lg, 10px) + 2px); }
}
`;
