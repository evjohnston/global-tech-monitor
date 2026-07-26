// Central, real thresholds for the findings engine (findingsEngine.ts) —
// kept in one place so every dashboard applies the SAME bar for "is this
// change worth surfacing," rather than each finding type inventing its
// own cutoff inline. Trivial changes never generate a finding; these are
// the floors that decide "trivial."
export const THRESHOLDS = {
  shareChangePt: 1, // minimum percentage-point share move to report
  rankChangePlaces: 2, // minimum rank-position move to report...
  rankTopN: 5, // ...unless the move crosses into/within this top band, which always counts
  newInstitutionTopN: 10, // an org must enter this band to count as "newly prominent"
  verificationChangePt: 5, // minimum verified-share move to report
  concentrationBands: [25, 50, 75], // top-1-org share crossing one of these is reportable
  fundingEventUsd: 10_000_000, // minimum disclosed amount for a single record to count as a "large" event
  windowDays: 42, // comparison period for change-based findings, matches the rest of this app's CHANGE_WINDOW_DAYS
};
