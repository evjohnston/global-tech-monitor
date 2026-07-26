import { useEffect, useMemo } from "react";
import type { DataFile, Entry, TrendPoint } from "../lib/types.ts";
import { STAGES } from "../lib/types.ts";
import type { DrawerTarget } from "../lib/drawerTarget.ts";
import { serializeDrawerTarget } from "../lib/drawerTarget.ts";
import { countByCountry, countryShares, orgLeaderboard, rankOf, orgRankOf } from "../lib/aggregate.ts";
import { resolveOrgProfile } from "../lib/resolveOrg.ts";
import { entriesAsOf, daysAgo } from "../lib/history.ts";
import { countryColor, countryName } from "../lib/countries.ts";
import { investorLeaderboard } from "../lib/vcInvestors.ts";
import { entriesForCollaboration, topPartnersFor, collaborationEdges } from "../lib/collaboration.ts";
import { dealsForLink } from "../lib/moneyFlow.ts";
import { entriesForResearchFlowLink, OUTPUT_PUBLICATIONS, OUTPUT_PATENTS } from "../lib/researchFlow.ts";
import { lookupOrgFinancials, type OrgFinancialIndex } from "../lib/orgFinancials.ts";
import { fmtUsd } from "../lib/format.ts";
import { downloadCsv } from "../lib/csvExport.ts";
import { isNewsEntry, newsCategory, newsFreshnessLabel } from "../lib/news.ts";

const RANK_CHANGE_WINDOW_DAYS = 42;

export interface MetadataDrawerProps {
  target: DrawerTarget;
  data: DataFile;
  trend: TrendPoint[];
  orgFinancialIndex: OrgFinancialIndex;
  compareCountries: string[];
  onClose: () => void;
  onFilterCountry: (country: string) => void;
  onToggleCompare: (country: string) => void;
  onOpenTarget: (target: DrawerTarget) => void;
  onHighlightOrg: (org: string) => void;
}

// One shared right-side drawer for every entity type this app tracks —
// country, institution, company, investor, individual record (paper/
// patent/grant/deployment/milestone/funding-round), a collaboration pair,
// or a Sankey investor->company link. Same Escape/backdrop-close overlay
// as the old EntryModal/CountryProfileDrawer this replaces; every field
// shown is real, already-computed data — nothing here is generated text.
export function MetadataDrawer(props: MetadataDrawerProps) {
  const { target, onClose } = props;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function copyLink() {
    const url = new URL(window.location.href);
    const s = serializeDrawerTarget(target);
    if (s) url.searchParams.set("record", s);
    else url.searchParams.delete("record");
    navigator.clipboard?.writeText(url.toString()).catch(() => {});
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Record details">
        <button className="drawer-close" onClick={onClose} aria-label="Close">×</button>
        <DrawerBody {...props} copyLink={copyLink} />
      </aside>
    </div>
  );
}

function DrawerBody(props: MetadataDrawerProps & { copyLink: () => void }) {
  const { target, data, trend, orgFinancialIndex, compareCountries, onFilterCountry, onToggleCompare, onOpenTarget, onHighlightOrg, copyLink } = props;
  const entries = data.entries;

  if (target.kind === "country") {
    return <CountryBody code={target.code} entries={entries} trend={trend} compareCountries={compareCountries} onFilterCountry={onFilterCountry} onToggleCompare={onToggleCompare} onOpenTarget={onOpenTarget} copyLink={copyLink} />;
  }
  if (target.kind === "org") {
    return <OrgBody orgId={target.orgId} label={target.label} entries={entries} orgFinancialIndex={orgFinancialIndex} onHighlightOrg={onHighlightOrg} onOpenTarget={onOpenTarget} copyLink={copyLink} />;
  }
  if (target.kind === "investor") {
    return <InvestorBody name={target.name} vcFunding={data.vcFunding ?? []} onOpenTarget={onOpenTarget} copyLink={copyLink} />;
  }
  if (target.kind === "entry") {
    return <EntryBody id={target.id} entries={entries} orgFinancialIndex={orgFinancialIndex} onOpenTarget={onOpenTarget} copyLink={copyLink} />;
  }
  if (target.kind === "collaboration") {
    return <CollaborationBody a={target.a} b={target.b} entries={entries} onOpenTarget={onOpenTarget} copyLink={copyLink} />;
  }
  if (target.kind === "researchFlowLink") {
    return <ResearchFlowLinkBody source={target.source} target={target.target} entries={entries} onOpenTarget={onOpenTarget} copyLink={copyLink} />;
  }
  return <SankeyLinkBody investor={target.investor} companyId={target.companyId} vcFunding={data.vcFunding ?? []} onOpenTarget={onOpenTarget} copyLink={copyLink} />;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="drawer-field">
      <span className="drawer-field-label">{label}</span>
      <span className="drawer-field-value">{value}</span>
    </div>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="drawer-actions">{children}</div>;
}

// ── Country ──────────────────────────────────────────────────────────
function CountryBody({
  code, entries, trend, compareCountries, onFilterCountry, onToggleCompare, onOpenTarget, copyLink,
}: {
  code: string; entries: Entry[]; trend: TrendPoint[]; compareCountries: string[];
  onFilterCountry: (c: string) => void; onToggleCompare: (c: string) => void; onOpenTarget: (t: DrawerTarget) => void; copyLink: () => void;
}) {
  const innovationCounts = useMemo(() => countByCountry(entries, "innovation"), [entries]);
  const rank = rankOf(innovationCounts, code);
  const pastCounts = useMemo(() => countByCountry(entriesAsOf(entries, daysAgo(RANK_CHANGE_WINDOW_DAYS)), "innovation"), [entries]);
  const pastRank = rankOf(pastCounts, code);
  const rankChange = rank != null && pastRank != null ? pastRank - rank : null;

  const strengths = STAGES.map((s) => {
    const counts = countByCountry(entries, s.id);
    const shares = countryShares(counts);
    const nCountries = Object.keys(counts).length || 1;
    const avgShare = 100 / nCountries;
    const share = shares[code] ?? 0;
    return { stage: s.id, label: s.label, share, avgShare, relative: share - avgShare, count: counts[code] ?? 0 };
  }).filter((s) => s.share > 0);
  const strongest = [...strengths].sort((a, b) => b.relative - a.relative).slice(0, 2);
  const weakest = strengths.length > 2 ? [...strengths].sort((a, b) => a.relative - b.relative).slice(0, 2) : [];

  const countryEntries = useMemo(() => entries.filter((e) => e.country === code), [entries, code]);
  const topOrgs = orgLeaderboard(countryEntries, undefined, 5);
  const sparkline = trend.slice(-21).map((p) => p.counts[code] ?? 0);
  const sparkMax = Math.max(1, ...sparkline);
  const inComparison = compareCountries.includes(code);

  return (
    <>
      <div className="drawer-flag" style={{ background: countryColor(code) }} />
      <h2>{countryName(code)}</h2>
      <div className="drawer-type">Country</div>
      <Field label="Rank (innovation)" value={rank != null ? `#${rank}${rankChange && rankChange !== 0 ? ` (${rankChange > 0 ? "up" : "down"} ${Math.abs(rankChange)} in ${RANK_CHANGE_WINDOW_DAYS}d)` : ""}` : "No tracked innovation output yet"} />
      <Field label="Total tracked entries" value={countryEntries.length} />
      {sparkline.some((v) => v > 0) && (
        <svg viewBox="0 0 200 40" width="100%" height={40} style={{ marginBottom: 12, display: "block" }} aria-label={`${countryName(code)} innovation output, trailing 21 days`}>
          <polyline fill="none" stroke={countryColor(code)} strokeWidth={2}
            points={sparkline.map((v, i) => `${(i / Math.max(1, sparkline.length - 1)) * 200},${40 - (v / sparkMax) * 36}`).join(" ")} />
        </svg>
      )}
      {strongest.length > 0 && (
        <>
          <div className="drawer-label">Relative strength</div>
          <ul className="drawer-list">{strongest.map((s) => <li key={s.stage}>{s.label}: {s.share.toFixed(1)}% share (avg {s.avgShare.toFixed(1)}%) · {s.count} entries</li>)}</ul>
        </>
      )}
      {weakest.length > 0 && (
        <>
          <div className="drawer-label">Trails its overall position in</div>
          <ul className="drawer-list">{weakest.map((s) => <li key={s.stage}>{s.label}: {s.share.toFixed(1)}% share (avg {s.avgShare.toFixed(1)}%)</li>)}</ul>
        </>
      )}
      {topOrgs.length > 0 && (
        <>
          <div className="drawer-label">Leading institutions</div>
          <ul className="drawer-list">
            {topOrgs.map((o) => (
              <li key={o.org}>
                <button className="drawer-link-btn" onClick={() => onOpenTarget({ kind: "org", orgId: o.org })}>{o.org}</button> · {o.count}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="drawer-label">Coverage note</div>
      <p className="drawer-note">Country attribution is a lead, not a verdict — see each record's country badge for the real evidence it was decided from.</p>
      <Actions>
        <button className="pill primary" onClick={() => onFilterCountry(code)}>Filter page to {countryName(code)} →</button>
        <button className="chip" aria-pressed={inComparison} onClick={() => onToggleCompare(code)}>{inComparison ? "Remove from comparison" : "Add to comparison"}</button>
        <button className="chip" onClick={() => downloadCsv(`${code}-entries.csv`, countryEntries.map((e) => ({ id: e.id, title: e.title, stage: e.stage, source: e.source, date: e.date, org: e.org, amountUsd: e.amountUsd ?? "", url: e.url })))} disabled={countryEntries.length === 0}>
          Download these rows ({countryEntries.length})
        </button>
        <button className="chip" onClick={copyLink}>Copy link to this view</button>
      </Actions>
    </>
  );
}

// ── Institution / company ───────────────────────────────────────────
// Three real, honest outcomes instead of one blanket "not found": (1) the
// org has tracked Entry records — full profile as before; (2) it has no
// Entry records but DOES have real financial data (a ticker/VC/R&D row
// keyed by the same canonical id — orgFinancialIndex's maps are already
// id-keyed, so this doesn't need the entries path at all) — a company can
// be legitimately financially-tracked with zero papers/patents/milestones,
// that's real, not broken; (3) neither resolves, in which case fall back to
// searching entries for the raw label text that was actually clicked
// (target.label) and show those as "appears in the following records"
// rather than a dead end.
function OrgBody({
  orgId, label, entries, orgFinancialIndex, onHighlightOrg, onOpenTarget, copyLink,
}: {
  orgId: string; label?: string; entries: Entry[]; orgFinancialIndex: OrgFinancialIndex; onHighlightOrg: (org: string) => void; onOpenTarget: (t: DrawerTarget) => void; copyLink: () => void;
}) {
  const resolution = useMemo(() => resolveOrgProfile(entries, orgFinancialIndex, orgId, label), [entries, orgFinancialIndex, orgId, label]);

  if (resolution.status === "unresolved") {
    return (
      <>
        <h2>Unresolved organization</h2>
        <div className="drawer-type">{label ?? orgId}</div>
        {resolution.fuzzyMatches.length > 0 ? (
          <>
            <p className="drawer-note">This label doesn't match a tracked institution id directly, but appears in the following tracked records:</p>
            <ul className="drawer-list">
              {resolution.fuzzyMatches.map((e) => <li key={e.id}><button className="drawer-link-btn" onClick={() => onOpenTarget({ kind: "entry", id: e.id })}>{e.title}</button> · {e.org}</li>)}
            </ul>
          </>
        ) : (
          <p className="drawer-note">No tracked records or financial data currently resolve to this label — it may have been renamed on re-fetch, or this link is stale.</p>
        )}
        <Actions>
          <button className="chip" onClick={copyLink}>Copy link to this view</button>
        </Actions>
      </>
    );
  }

  const orgEntries = resolution.status === "entries" ? resolution.entries : [];
  const name = resolution.name;
  const countries = new Set(orgEntries.map((e) => e.country).filter((c): c is string => !!c));
  const primaryCountry = orgEntries.find((e) => e.country)?.country ?? null;
  const byStage = STAGES.map((s) => ({ stage: s.id, label: s.label, count: orgEntries.filter((e) => e.stage === s.id).length, rank: orgRankOf(entries, orgId, s.id) })).filter((s) => s.count > 0);
  const financials = lookupOrgFinancials(orgFinancialIndex, name);
  const recent = [...orgEntries].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);

  return (
    <>
      {primaryCountry && <div className="drawer-flag" style={{ background: countryColor(primaryCountry) }} />}
      <h2>{name}</h2>
      <div className="drawer-type">Institution / company</div>
      {orgEntries.length === 0 && (
        <p className="drawer-note">No tracked papers, patents, or milestones for this organization — it's tracked here only through its financial data below. That's a real, expected gap for a public company or investor, not a broken link.</p>
      )}
      {orgEntries.length > 0 && (
        <Field label="Country" value={primaryCountry ? <button className="drawer-link-btn" onClick={() => onOpenTarget({ kind: "country", code: primaryCountry })}>{countryName(primaryCountry)}</button> : "Unknown — no resolvable institution country on any tracked record"} />
      )}
      <Field label="Total tracked records" value={orgEntries.length} />
      {countries.size > 1 && <Field label="Note" value={`Records under this name carry ${countries.size} different country codes — a real multi-site organization, or a data-attribution mismatch worth checking (see each record's country evidence).`} />}
      {byStage.length > 0 && (
        <>
          <div className="drawer-label">Activity by stage</div>
          <ul className="drawer-list">{byStage.map((s) => <li key={s.stage}>{s.label}: {s.count} records{s.rank ? ` · rank #${s.rank}` : ""}</li>)}</ul>
        </>
      )}
      {financials && (
        <>
          <div className="drawer-label">Financial profile</div>
          <ul className="drawer-list">
            {financials.ticker && <li>{financials.ticker.symbol} · {financials.ticker.marketCapUsd != null ? fmtUsd(financials.ticker.marketCapUsd) : "—"} market cap{financials.ticker.price != null ? ` · $${financials.ticker.price.toFixed(2)}/share` : ""}</li>}
            {financials.vc && (
              <li>
                {fmtUsd(financials.vc.totalRaisedUsd)} disclosed VC/growth capital across {financials.vc.dealCount} deal{financials.vc.dealCount === 1 ? "" : "s"}
                {financials.vc.deals[0]?.investors[0] && (
                  <> · <button className="drawer-link-btn" onClick={() => onOpenTarget({ kind: "investor", name: financials.vc!.deals[0].investors[0] })}>view an investor</button></>
                )}
              </li>
            )}
            {financials.rd && <li>{fmtUsd(financials.rd.amountUsd)} R&D spend, FY{financials.rd.fiscalYear} ({financials.rd.source === "capiq" ? "S&P Capital IQ" : "SEC filing"})</li>}
          </ul>
        </>
      )}
      {recent.length > 0 && (
        <>
          <div className="drawer-label">Recent records</div>
          <ul className="drawer-list">
            {recent.map((e) => <li key={e.id}><button className="drawer-link-btn" onClick={() => onOpenTarget({ kind: "entry", id: e.id })}>{e.title}</button> · {e.date || "undated"}</li>)}
          </ul>
        </>
      )}
      <Actions>
        {orgEntries.length > 0 && <button className="pill primary" onClick={() => onHighlightOrg(name)}>Highlight in the pipeline →</button>}
        {orgEntries.length > 0 && (
          <button className="chip" onClick={() => downloadCsv(`${orgId}-records.csv`, orgEntries.map((e) => ({ id: e.id, title: e.title, stage: e.stage, country: e.country ?? "", date: e.date, amountUsd: e.amountUsd ?? "", url: e.url })))}>
            Download these rows ({orgEntries.length})
          </button>
        )}
        <button className="chip" onClick={copyLink}>Copy link to this view</button>
      </Actions>
    </>
  );
}

// ── Investor ─────────────────────────────────────────────────────────
function InvestorBody({ name, vcFunding, onOpenTarget, copyLink }: { name: string; vcFunding: DataFile["vcFunding"]; onOpenTarget: (t: DrawerTarget) => void; copyLink: () => void }) {
  const rows = useMemo(() => investorLeaderboard(vcFunding ?? []), [vcFunding]);
  const row = rows.find((r) => r.investor === name);
  if (!row) {
    return <><h2>{name}</h2><p className="drawer-note">No tracked deal activity found for this investor.</p></>;
  }
  return (
    <>
      <h2>{name}</h2>
      <div className="drawer-type">Investor</div>
      <Field label="Tracked deals" value={row.dealCount} />
      <Field label="Companies backed" value={row.companies.length} />
      <div className="drawer-label">Companies backed</div>
      <ul className="drawer-list">
        {row.companies.map((c) => <li key={c.orgId}><button className="drawer-link-btn" onClick={() => onOpenTarget({ kind: "org", orgId: c.orgId })}>{c.name}</button></li>)}
      </ul>
      <p className="drawer-note">Deal counts and companies backed are real activity signals — a dollar total isn't shown here, since a syndicated round's disclosed amount would otherwise be double-counted across every co-investor.</p>
      <Actions>
        <button className="chip" onClick={() => downloadCsv(`${name}-companies.csv`, row.companies.map((c) => ({ company: c.name, orgId: c.orgId })))}>Download these rows ({row.companies.length})</button>
        <button className="chip" onClick={copyLink}>Copy link to this view</button>
      </Actions>
    </>
  );
}

// ── Entry (paper / patent / grant / deployment / milestone / funding round) ──
const AUTHOR_LABEL: Partial<Record<Entry["source"], string>> = { patent: "Inventors" };
const VENUE_LABEL: Partial<Record<Entry["source"], string>> = { grant: "Program" };
const STAGE_REASON: Record<Entry["stage"], string> = {
  innovation: "Assigned to Innovation: a paper, patent, or research statistic tracking new discovery or invention.",
  scaling: "Assigned to Scaling: a hardware/production milestone tracking engineering capacity.",
  adoption: "Assigned to Adoption: a real deployment, procurement, or use-in-production record.",
  investment: "Assigned to Investment: public grant funding, a disclosed private capital raise, or funding news.",
};
const DEPLOYMENT_STATUS_LABEL: Record<NonNullable<Entry["deploymentStatus"]>, string> = {
  announced: "Announced", pilot: "Pilot", procurement: "Procurement", deployed: "Deployed", operating: "Operating",
};

function EntryBody({ id, entries, orgFinancialIndex, onOpenTarget, copyLink }: { id: string; entries: Entry[]; orgFinancialIndex: OrgFinancialIndex; onOpenTarget: (t: DrawerTarget) => void; copyLink: () => void }) {
  const entry = entries.find((e) => e.id === id);
  if (!entry) return <><h2>Record not found</h2><p className="drawer-note">This record id isn't in the currently loaded data — it may be from a different vertical's shared link.</p></>;
  const meta = STAGES.find((s) => s.id === entry.stage)!;
  const financials = entry.org ? lookupOrgFinancials(orgFinancialIndex, entry.org) : null;

  // Three real, non-overlapping lenses to continue the story from — same
  // organization, same country, same pipeline stage — rather than one flat
  // list. Each lens draws from the same real entries[] (no fabricated
  // grouping), sorted newest-first so it reads as "what happened next,"
  // and excludes anything already surfaced by a higher-priority lens so a
  // record never shows up twice under different headings.
  const seenRelatedIds = new Set([entry.id]);
  const recentFirst = (a: Entry, b: Entry) => (b.date ?? "").localeCompare(a.date ?? "");
  const relatedByOrg = entry.orgId
    ? entries.filter((e) => e.orgId === entry.orgId && !seenRelatedIds.has(e.id)).sort(recentFirst).slice(0, 4)
    : [];
  relatedByOrg.forEach((e) => seenRelatedIds.add(e.id));
  const relatedByCountry = entry.country
    ? entries.filter((e) => e.country === entry.country && !seenRelatedIds.has(e.id)).sort(recentFirst).slice(0, 4)
    : [];
  relatedByCountry.forEach((e) => seenRelatedIds.add(e.id));
  const relatedByStage = entries.filter((e) => e.stage === entry.stage && !seenRelatedIds.has(e.id)).sort(recentFirst).slice(0, 4);

  return (
    <>
      <div className="drawer-flag" style={{ background: countryColor(entry.country) }} />
      <h2>{entry.title}</h2>
      <div className="drawer-type">{meta.label} · {entry.source}</div>
      <Field label="Country" value={entry.country ? <button className="drawer-link-btn" onClick={() => onOpenTarget({ kind: "country", code: entry.country! })}>{countryName(entry.country)}</button> : "Unknown — see below"} />
      {!entry.country && <Field label="Why unknown" value={entry.countryEvidence || "This source returned no institution/awardee location for this record."} />}
      <Field label="Date" value={entry.date || "undated"} />
      {entry.amountUsd != null && <Field label="Amount" value={fmtUsd(entry.amountUsd)} />}
      <Field label="Organization" value={entry.org ? <button className="drawer-link-btn" onClick={() => onOpenTarget({ kind: "org", orgId: entry.orgId ?? entry.org })}>{entry.org}</button> : null} />
      {entry.deploymentStatus && (
        <Field
          label="Deployment status"
          value={`${DEPLOYMENT_STATUS_LABEL[entry.deploymentStatus]} (${entry.provenance === "seeded" ? "hand-assigned" : "keyword-guessed"})`}
        />
      )}
      <Field label="Provenance" value={entry.provenance === "live" ? "Live — institution/awardee-attributed" : entry.provenance === "seeded" ? "Hand-verified against source" : "Auto-classified (RSS/keyword), weakest tier"} />
      {isNewsEntry(entry) && (
        <>
          <Field label="Publisher" value={entry.publisher ?? "Unknown"} />
          <Field label="Category" value={`${newsCategory(entry)} (auto-classified)`} />
          <Field label="Why it appears" value={`Real ${STAGES.find((s) => s.id === entry.stage)!.label.toLowerCase()}-track news, ${newsFreshnessLabel(entry.date)} old.`} />
        </>
      )}
      <Field label={VENUE_LABEL[entry.source] ?? "Venue"} value={entry.venue} />
      <Field label="CPC classification" value={entry.classification} />
      <Field label="Citations" value={entry.citations} />
      <Field label={AUTHOR_LABEL[entry.source] ?? "Authors"} value={entry.authors?.join(", ")} />
      <div className="drawer-label">Why this stage</div>
      <p className="drawer-note">{STAGE_REASON[entry.stage]}</p>
      {entry.abstract && (<><div className="drawer-label">Abstract</div><p className="drawer-note">{entry.abstract}</p></>)}
      {financials && (
        <>
          <div className="drawer-label">Organization's financial profile</div>
          <ul className="drawer-list">
            {financials.ticker && <li>{financials.ticker.symbol} · {financials.ticker.marketCapUsd != null ? fmtUsd(financials.ticker.marketCapUsd) : "—"} market cap</li>}
            {financials.vc && <li>{fmtUsd(financials.vc.totalRaisedUsd)} VC/growth capital, {financials.vc.dealCount} deals</li>}
            {financials.rd && <li>{fmtUsd(financials.rd.amountUsd)} R&D spend, FY{financials.rd.fiscalYear}</li>}
          </ul>
        </>
      )}
      {relatedByOrg.length > 0 && (
        <>
          <div className="drawer-label">More from {entry.org}</div>
          <ul className="drawer-list">{relatedByOrg.map((e) => <li key={e.id}><button className="drawer-link-btn" onClick={() => onOpenTarget({ kind: "entry", id: e.id })}>{e.title}</button></li>)}</ul>
        </>
      )}
      {relatedByCountry.length > 0 && (
        <>
          <div className="drawer-label">More from {countryName(entry.country)}</div>
          <ul className="drawer-list">{relatedByCountry.map((e) => <li key={e.id}><button className="drawer-link-btn" onClick={() => onOpenTarget({ kind: "entry", id: e.id })}>{e.title}</button></li>)}</ul>
        </>
      )}
      {relatedByStage.length > 0 && (
        <>
          <div className="drawer-label">More {meta.label.toLowerCase()} records</div>
          <ul className="drawer-list">{relatedByStage.map((e) => <li key={e.id}><button className="drawer-link-btn" onClick={() => onOpenTarget({ kind: "entry", id: e.id })}>{e.title}</button></li>)}</ul>
        </>
      )}
      <Actions>
        <a className="pill primary" href={entry.url} target="_blank" rel="noopener noreferrer">View source ↗</a>
        {entry.org && <button className="chip" onClick={() => onOpenTarget({ kind: "org", orgId: entry.orgId ?? entry.org })}>Open institution profile</button>}
        <button className="chip" onClick={copyLink}>Copy link to this view</button>
      </Actions>
    </>
  );
}

// ── Collaboration pair ──────────────────────────────────────────────
function CollaborationBody({ a, b, entries, onOpenTarget, copyLink }: { a: string; b: string; entries: Entry[]; onOpenTarget: (t: DrawerTarget) => void; copyLink: () => void }) {
  const papers = useMemo(() => entriesForCollaboration(entries, a, b), [entries, a, b]);
  const edges = useMemo(() => collaborationEdges(entries), [entries]);
  const aPartners = topPartnersFor(edges, a, 5);
  const bPartners = topPartnersFor(edges, b, 5);
  const dates = papers.map((p) => p.date).filter(Boolean).sort();

  return (
    <>
      <h2>{countryName(a)} – {countryName(b)}</h2>
      <div className="drawer-type">Collaboration pair</div>
      <Field label="Real co-authored papers" value={papers.length} />
      <Field label="Date range" value={dates.length > 0 ? `${dates[0]} – ${dates[dates.length - 1]}` : null} />
      <div className="drawer-label">{countryName(a)}'s other top partners</div>
      <ul className="drawer-list">{aPartners.map((p) => <li key={p.partner}><button className="drawer-link-btn" onClick={() => onOpenTarget({ kind: "collaboration", a, b: p.partner })}>{countryName(p.partner)}</button> · {p.count}</li>)}</ul>
      <div className="drawer-label">{countryName(b)}'s other top partners</div>
      <ul className="drawer-list">{bPartners.map((p) => <li key={p.partner}><button className="drawer-link-btn" onClick={() => onOpenTarget({ kind: "collaboration", a: b, b: p.partner })}>{countryName(p.partner)}</button> · {p.count}</li>)}</ul>
      <div className="drawer-label">Underlying papers</div>
      <ul className="drawer-list">{papers.slice(0, 8).map((p) => <li key={p.id}><button className="drawer-link-btn" onClick={() => onOpenTarget({ kind: "entry", id: p.id })}>{p.title}</button> · {p.date}</li>)}</ul>
      <p className="drawer-note">An edge is one real paper whose authors' resolved institutions span both countries — this shows who has co-published, not a claim about who depends on whom.</p>
      <Actions>
        <button className="chip" onClick={() => downloadCsv(`${a}-${b}-papers.csv`, papers.map((p) => ({ id: p.id, title: p.title, date: p.date, url: p.url })))} disabled={papers.length === 0}>Download these rows ({papers.length})</button>
        <button className="chip" onClick={copyLink}>Copy link to this view</button>
      </Actions>
    </>
  );
}

// ── Sankey investor -> company link ─────────────────────────────────
function SankeyLinkBody({ investor, companyId, vcFunding, onOpenTarget, copyLink }: { investor: string; companyId: string; vcFunding: DataFile["vcFunding"]; onOpenTarget: (t: DrawerTarget) => void; copyLink: () => void }) {
  const result = dealsForLink(vcFunding ?? [], investor, companyId);
  if (!result || result.deals.length === 0) {
    return <><h2>{investor} → {companyId}</h2><p className="drawer-note">No tracked deals found for this pair.</p></>;
  }
  const { company, deals } = result;
  const disclosed = deals.filter((d) => d.amountUsd != null);
  const totalDisclosed = disclosed.reduce((s, d) => s + (d.amountUsd ?? 0), 0);
  const dates = deals.map((d) => d.date).filter(Boolean).sort();

  return (
    <>
      <h2>{investor} → <button className="drawer-link-btn" onClick={() => onOpenTarget({ kind: "org", orgId: companyId })}>{company.name}</button></h2>
      <div className="drawer-type">Investor → company (S&P Capital IQ)</div>
      <Field label="Tracked deals" value={deals.length} />
      <Field label="Date range" value={dates.length > 0 ? `${dates[0]} – ${dates[dates.length - 1]}` : null} />
      <Field label="Disclosed amount (this investor's rounds)" value={disclosed.length > 0 ? `${fmtUsd(totalDisclosed)} across ${disclosed.length} disclosed round${disclosed.length === 1 ? "" : "s"}` : "Not disclosed"} />
      <div className="drawer-label">Transactions</div>
      <ul className="drawer-list">
        {deals.map((d, i) => (
          <li key={i}>{d.date || "date undisclosed"} · {d.type} · {d.status} · {d.amountUsd != null ? fmtUsd(d.amountUsd) : "amount undisclosed"} · {d.investors.length} investor{d.investors.length === 1 ? "" : "s"} on this round</li>
        ))}
      </ul>
      <p className="drawer-note">A disclosed amount is the whole round's total, not this investor's specific contribution — a syndicated round's full amount can't be honestly split per co-investor.</p>
      <Actions>
        <button className="chip" onClick={() => downloadCsv(`${investor}-${company.name}-deals.csv`, deals.map((d) => ({ date: d.date, type: d.type, status: d.status, amountUsd: d.amountUsd ?? "", investorCount: d.investors.length })))}>Download these rows ({deals.length})</button>
        <button className="chip" onClick={copyLink}>Copy link to this view</button>
      </Actions>
    </>
  );
}

// ── Research flow: country -> institution -> output-type link ─────────
function ResearchFlowLinkBody({ source, target, entries, onOpenTarget, copyLink }: { source: string; target: string; entries: Entry[]; onOpenTarget: (t: DrawerTarget) => void; copyLink: () => void }) {
  const rows = useMemo(() => entriesForResearchFlowLink(entries, source, target), [entries, source, target]);
  const isOutputTarget = target === OUTPUT_PUBLICATIONS || target === OUTPUT_PATENTS;
  const sourceLabel = isOutputTarget ? (rows[0]?.org ?? source) : countryName(source);
  const targetLabel = isOutputTarget ? (target === OUTPUT_PATENTS ? "Patents" : "Publications") : (rows[0]?.org ?? target);
  const dates = rows.map((e) => e.date).filter(Boolean).sort();

  if (rows.length === 0) {
    return <><h2>{sourceLabel} → {targetLabel}</h2><p className="drawer-note">No tracked records found for this pair.</p></>;
  }

  return (
    <>
      <h2>{sourceLabel} → {targetLabel}</h2>
      <div className="drawer-type">Research flow link</div>
      <Field label="Tracked records" value={rows.length} />
      <Field label="Date range" value={dates.length > 0 ? `${dates[0]} – ${dates[dates.length - 1]}` : null} />
      <div className="drawer-label">Records on this link</div>
      <ul className="drawer-list">{rows.slice(0, 12).map((e) => <li key={e.id}><button className="drawer-link-btn" onClick={() => onOpenTarget({ kind: "entry", id: e.id })}>{e.title}</button> · {e.date || "undated"}</li>)}</ul>
      <p className="drawer-note">An institution is placed under the one real country it's headquartered in; output type is drawn from each record's own source field (patent filing vs. paper/preprint).</p>
      <Actions>
        <button className="chip" onClick={() => downloadCsv(`${sourceLabel}-${targetLabel}-records.csv`, rows.map((e) => ({ id: e.id, title: e.title, date: e.date, org: e.org, country: e.country ?? "", url: e.url })))}>Download these rows ({rows.length})</button>
        <button className="chip" onClick={copyLink}>Copy link to this view</button>
      </Actions>
    </>
  );
}
