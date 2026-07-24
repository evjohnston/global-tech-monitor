import type { Entry } from "../../src/lib/types.ts";

// Hand-curated entries for the pipeline stages that have no clean live feed.
// Same standard as data/quantum/seed.ts and data/ai/seed.ts: every entry
// below was fetched and confirmed against its source URL before being
// added (built via four parallel research passes across US immigration
// policy, US federal STEM funding, international talent-competition policy,
// and corporate workforce programs — 2026-07-24 — then spot-checked by
// hand against two of the more surprising claims). `country` is the real
// ISO 3166-1 alpha-2 code for where the org/agency is based — every entry
// gets its actual country, never a regional bucket. `date` may be YYYY-MM.
//
// Thinner and more US-weighted than quantum/AI's seed sets by construction
// — trade coverage of the STEM-talent pipeline specifically (as opposed to
// higher-ed news broadly) is a much smaller beat, and US immigration/NSF
// policy is simply better-documented in English-language sources than most
// other countries' equivalents. Extend this with the same country/domain
// breadth used to build it, not just more US entries.
//
// One entry (seed-china-qiming-program-2023) rests on a single private
// research firm's blog post, not an official government source — China does
// not publish this kind of program transparently, the same access gap
// already disclosed for NSFC funding elsewhere in this app. Treat it as a
// lead, not a verified fact, same as every "auto" provenance entry.
//
// To add a new entry: copy a block, change the fields, give it a unique id.

export const SEED: Entry[] = [
  {
    id: "seed-cyberaicorps-2023",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "NSF implements the CHIPS and Science Act's mandate to expand CyberCorps Scholarship for Service into artificial intelligence, funding 12 to 16 new CyberAICorps awards totaling about $20 million for FY2024.",
    org: "National Science Foundation", date: "2023-04",
    url: "https://www.nsf.gov/funding/opportunities/cyberai-sfs-cyberaicorps-scholarship-service/504991/nsf23-574/solicitation",
  },
  {
    id: "seed-global-talent-endorsements-2023",
    stage: "adoption", country: "GB", provenance: "seeded", source: "deployment",
    title: "The UK's Global Talent visa route granted 12,243 visas from 17,012 endorsement applications across its six endorsing bodies between its February 2020 launch and April 2023.",
    org: "UK Home Office", date: "2023-04",
    url: "https://www.gov.uk/government/publications/global-talent-visa-evaluation-wave-2-report/global-talent-visa-evaluation-wave-2-report",
  },
  {
    id: "seed-noyce-funding-2023",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "NSF funds 60 to 77 Robert Noyce Teacher Scholarship Program awards totaling $68 million to recruit, prepare, and retain K-12 STEM teachers in high-need school districts.",
    org: "National Science Foundation", date: "2023-05",
    url: "https://www.nsf.gov/funding/opportunities/robert-noyce-teacher-scholarship-program/nsf23-586/solicitation",
  },
  {
    id: "seed-canada-h1b-cap-2023",
    stage: "adoption", country: "CA", provenance: "seeded", source: "deployment",
    title: "Canada's new open work permit stream for US H-1B visa holders hit its 10,000-application cap one day after opening, on 17 July 2023.",
    org: "Immigration, Refugees and Citizenship Canada", date: "2023-07",
    url: "https://www.cicnews.com/2023/07/canada-launches-open-work-permit-stream-for-u-s-h-1b-visa-holders-today-0735932.html",
  },
  {
    id: "seed-tsmc-arizona-delay-2023",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "TSMC delays the start of chip production at its $40 billion Arizona fab from 2024 to 2025, citing a shortage of workers skilled in specialized equipment installation.",
    org: "TSMC", date: "2023-07",
    url: "https://www.sdxcentral.com/news/tsmc-delays-40bn-chip-fab-in-arizona-due-to-skilled-worker-shortage/",
  },
  {
    id: "seed-sstem-fy24-2023",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "NSF funds 50 to 90 S-STEM scholarship awards totaling $80 million to $120 million for the FY2024 competition, supporting low-income students in science, technology, engineering, and mathematics degree programs.",
    org: "National Science Foundation", date: "2023-12",
    url: "https://www.nsf.gov/funding/opportunities/s-stem-nsf-scholarships-science-technology-engineering-mathematics/nsf24-511/solicitation",
  },
  {
    id: "seed-nsf-engines-2024",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "NSF names its first 10 Regional Innovation Engines awardees, spanning 18 states, with a potential NSF investment of nearly $1.6 billion over a decade covering research, innovation, and workforce development.",
    org: "National Science Foundation", date: "2024-01",
    url: "https://www.nsf.gov/news/nsf-establishes-10-inaugural-regional-innovation",
  },
  {
    id: "seed-india-vaibhav-fellows-2024",
    stage: "adoption", country: "IN", provenance: "seeded", source: "deployment",
    title: "India's Department of Science and Technology selected 22 VAIBHAV Fellows, including scholars from Caltech, USC, and the National University of Singapore, from 302 diaspora-scientist proposals, announced on 25 January 2024.",
    org: "Department of Science and Technology", date: "2024-01",
    url: "https://news.careers360.com/dst-award-vaibhav-fellowship-22-indian-origin-scholars-collaborate-indian-institutes",
  },
  {
    id: "seed-h1b-fy2025-lottery-decline-2024",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "USCIS completes the FY2025 H-1B lottery with 470,342 eligible registrations, down 38% from 758,994 in FY2024 after the beneficiary-centric reform curbed duplicate entries.",
    org: "U.S. Citizenship and Immigration Services", date: "2024-04",
    url: "https://www.fragomen.com/insights/united-states-uscis-releases-selection-numbers-for-the-fy-2025-h-1b-cap.html",
  },
  {
    id: "seed-ate-fy25-2024",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "NSF funds 45 to 80 Advanced Technological Education awards totaling $69 million in new funding for the FY2025 competition, training technicians for high-technology fields at two-year colleges.",
    org: "National Science Foundation", date: "2024-06",
    url: "https://www.nsf.gov/funding/opportunities/ate-advanced-technological-education/nsf24-584/solicitation",
  },
  {
    id: "seed-grfp-fy25-cohort-2024",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "NSF funds up to 2,300 new Graduate Research Fellows for the FY2025 competition, each receiving a $37,000 stipend plus a $16,000 cost-of-education allowance.",
    org: "National Science Foundation", date: "2024-07",
    url: "https://www.nsf.gov/funding/opportunities/grfp-nsf-graduate-research-fellowship-program/nsf24-591/solicitation",
  },
  {
    id: "seed-germany-chancenkarte-issued-2024",
    stage: "adoption", country: "DE", provenance: "seeded", source: "deployment",
    title: "Germany issued about 2,500 Opportunity Cards between June and October 2024, with Indian nationals receiving roughly 31 percent of them, per Federal Ministry of the Interior data.",
    org: "German Federal Ministry of the Interior", date: "2024-10",
    url: "https://www.y-axis.com/news/indians-top-the-list-with-31-percent-of-all-the-opportunity-cards-issued-by-germany-in-2024/",
  },
  {
    id: "seed-federal-stem-plan-2024",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "The White House Office of Science and Technology Policy releases the Federal Strategic Plan for Advancing STEM Education and Cultivating STEM Talent, coordinating STEM workforce efforts across more than 20 federal agencies through the National Science and Technology Council.",
    org: "White House Office of Science and Technology Policy", date: "2024-11",
    url: "https://bidenwhitehouse.archives.gov/ostp/news-updates/2024/11/26/2024fedstemplan/",
  },
  {
    id: "seed-google-career-cert-1m-2024",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "Google Career Certificate graduates reach 1 million globally, with more than 150 employers including Deloitte, Verizon, Ford, and Wells Fargo in its hiring consortium.",
    org: "Google", date: "2024-12",
    url: "https://blog.google/company-news/outreach-and-initiatives/grow-with-google/google-career-certificate-graduates-reach-1-million/",
  },
  {
    id: "seed-niw-policy-update-2025",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "USCIS tightens EB-2 National Interest Waiver adjudication standards for STEM advanced-degree holders and entrepreneurs in a January 15, 2025 policy manual update.",
    org: "U.S. Citizenship and Immigration Services", date: "2025-01",
    url: "https://www.uscis.gov/sites/default/files/document/policy-manual-updates/20250115-Employment-BasedNationalInterestWaivers.pdf",
  },
  {
    id: "seed-h1b-fee-215-2025",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "USCIS charges the new $215 H-1B registration fee for the first time during the FY2026 cap registration period, March 7-24, 2025, up from $10 under the prior fee schedule.",
    org: "U.S. Citizenship and Immigration Services", date: "2025-03",
    url: "https://www.uscis.gov/newsroom/alerts/fy-2026-h-1b-cap-initial-registration-period-opens-on-march-7",
  },
  {
    id: "seed-h1b-fy2026-lottery-2025",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "USCIS selects 118,660 of 336,153 eligible H-1B beneficiaries, a 35.3% selection rate, for FY2026, the highest rate since the beneficiary-centric process began.",
    org: "U.S. Citizenship and Immigration Services", date: "2025-05",
    url: "https://www.fragomen.com/insights/united-states-uscis-releases-selection-numbers-for-the-fy-2026-h-1b-cap.html",
  },
  {
    id: "seed-amazon-700k-2025",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "Amazon says it has upskilled more than 700,000 employees globally through its free training programs, exceeding its original 100,000-employee goal sevenfold.",
    org: "Amazon", date: "2025-07",
    url: "https://www.aboutamazon.com/news/workplace/amazon-employees-upskilling-education-training",
  },
  {
    id: "seed-h1b-100k-proclamation-2025",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "President Trump's proclamation requiring a $100,000 payment for new H-1B petitions takes effect at 12:01 a.m. EDT on September 21, 2025.",
    org: "The White House", date: "2025-09",
    url: "https://www.uscis.gov/newsroom/alerts/presidential-proclamation-on-restriction-on-entry-of-certain-nonimmigrant-workers",
  },
  {
    id: "seed-h1b-100k-court-ruling-2025",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "The U.S. District Court for the District of Columbia upholds the $100,000 H-1B fee proclamation on December 23, 2025, rejecting a challenge from the U.S. Chamber of Commerce and the Association of American Universities.",
    org: "U.S. District Court for the District of Columbia", date: "2025-12",
    url: "https://www.globalimmigrationblog.com/2025/12/federal-court-upholds-trump-administration-100000-fee-for-certain-h-1b-petitions/",
  },
  {
    id: "seed-ibm-skillsbuild-16m-2025",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "IBM SkillsBuild reaches more than 16 million learners globally, en route to IBM's goal of training 30 million people by 2030.",
    org: "IBM", date: "2025-12",
    url: "https://in.newsroom.ibm.com/2025-12-19-IBM-commits-to-skill-5-million-Indian-youth-in-AI,-Cybersecurity-Quantum-by-2030",
  },
  {
    id: "seed-amazon-upskilling2025-2021",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "Amazon expands its Upskilling 2025 pledge to more than $1.2 billion to give 300,000 employees free training and college tuition for in-demand jobs.",
    org: "Amazon", date: "2021-09",
    url: "https://www.aboutamazon.com/news/workplace/upskilling-2025",
  },
  {
    id: "seed-ibm-skill30-2021",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "IBM commits to skill 30 million people globally by 2030, backed by more than 170 new academic and industry partnerships across 30-plus countries.",
    org: "IBM", date: "2021-10",
    url: "https://newsroom.ibm.com/2021-10-13-IBM-Commits-to-Skill-30-Million-People-Globally-by-2030",
  },
  {
    id: "seed-intel-ohio-50m-2022",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "Intel commits $50 million directly to Ohio higher education institutions over the next decade to build a semiconductor workforce pipeline.",
    org: "Intel", date: "2022-03",
    url: "https://news.osu.edu/intel-announces-50-million-investment-in-ohio-higher-education/",
  },
  {
    id: "seed-chips-act-signed-2022",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "President Biden signs the CHIPS and Science Act of 2022, authorizing new and expanded federal investment in STEM education and training from K-12 through graduate school.",
    org: "The White House", date: "2022-08",
    url: "https://bidenwhitehouse.archives.gov/briefing-room/statements-releases/2022/08/09/fact-sheet-chips-and-science-act-will-lower-costs-create-jobs-strengthen-supply-chains-and-counter-china/",
  },
  {
    id: "seed-chips-nsf-stem-authorization-2022",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "The CHIPS and Science Act authorizes $81 billion for NSF over fiscal years 2023 to 2027, including $200 million for semiconductor workforce training and education activities.",
    org: "National Science Foundation", date: "2022-08",
    url: "https://www.nsf.gov/chips",
  },
  {
    id: "seed-japan-jskip-jfind-2023",
    stage: "scaling", country: "JP", provenance: "seeded", source: "milestone",
    title: "Japan's Ministry of Justice launched the J-Skip and J-Find visa routes in April 2023, citing the 'global competition for talent,' fast-tracking permanent residency for high-earning specialists and letting elite-university graduates job-hunt in Japan for up to two years.",
    org: "Japan Ministry of Justice / Immigration Services Agency", date: "2023-04",
    url: "https://www.chemistryworld.com/news/japan-launches-new-visa-routes-for-graduates-and-highly-skilled-professionals/4017080.article",
  },
  {
    id: "seed-canada-tech-talent-strategy-2023",
    stage: "scaling", country: "CA", provenance: "seeded", source: "milestone",
    title: "Canada launched its first-ever Tech Talent Strategy on 27 June 2023, creating a new open work permit stream for US H-1B visa holders and a 14-day service standard for Global Skills Strategy work permits.",
    org: "Immigration, Refugees and Citizenship Canada", date: "2023-06",
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/news/2023/06/minister-fraser-launches-canadas-first-ever-tech-talent-strategy-at-collision-2023.html",
  },
  {
    id: "seed-grfp-stipend-increase-2023",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "NSF raises the Graduate Research Fellowship Program's annual stipend to $37,000 and its cost-of-education allowance to $16,000 per fellow, effective with the FY2024 competition.",
    org: "National Science Foundation", date: "2023-07",
    url: "https://www.nsf.gov/funding/opportunities/grfp-nsf-graduate-research-fellowship-program/nsf23-605/solicitation",
  },
  {
    id: "seed-china-qiming-program-2023",
    stage: "scaling", country: "CN", provenance: "seeded", source: "milestone",
    title: "China's Ministry of Industry and Information Technology has been running the Qiming Program, a discreetly rebranded successor to the Thousand Talents Plan since around 2021, offering signing bonuses of 3 to 5 million yuan to recruit overseas semiconductor and technology experts.",
    org: "Ministry of Industry and Information Technology", date: "2023-08",
    url: "https://www.striderintel.com/blog/the-quiet-rebranding-of-chinas-global-talent-pipeline/",
  },
  {
    id: "seed-ai-eo-immigration-pathways-2023",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "President Biden's Executive Order 14110 directs DHS to modernize O-1A, EB-1, EB-2, and International Entrepreneur Rule pathways for AI and critical-technology experts within 180 days.",
    org: "The White House", date: "2023-10",
    url: "https://www.federalregister.gov/documents/2023/11/01/2023-24283/safe-secure-and-trustworthy-development-and-use-of-artificial-intelligence",
  },
  {
    id: "seed-germany-eu-blue-card-2023",
    stage: "scaling", country: "DE", provenance: "seeded", source: "milestone",
    title: "Germany's revised EU Blue Card rules took effect on 18 November 2023, lowering the minimum shortage-occupation salary threshold to EUR 39,682.80 and easing employer-switching and family-reunification requirements.",
    org: "German Federal Ministry of the Interior", date: "2023-11",
    url: "https://www.fragomen.com/insights/germany-new-eu-blue-card-rules-in-force-from-november-18.html",
  },
  {
    id: "seed-samsung-taylor-isd-2023",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "Samsung Austin Semiconductor donates $1 million to Taylor ISD to build a career and technical education center for the local semiconductor workforce.",
    org: "Samsung Austin Semiconductor", date: "2023-11",
    url: "https://www.siliconhillsnews.com/2023/11/15/samsung-austin-semiconductor-donates-1-million-to-taylor-isd-for-a-career-and-technical-education-center/",
  },
  {
    id: "seed-h1b-beneficiary-centric-rule-2024",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "DHS finalizes a beneficiary-centric H-1B registration selection process, replacing the old one-entry-per-registration lottery, effective March 4, 2024.",
    org: "U.S. Citizenship and Immigration Services", date: "2024-03",
    url: "https://www.federalregister.gov/documents/2024/02/02/2024-01770/improving-the-h-1b-registration-selection-process-and-program-integrity",
  },
  {
    id: "seed-ut-acc-tie-stc-2024",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "UT Austin, Austin Community College, and the Texas Institute for Electronics launch a joint Semiconductor Training Center backed by a $3.75 million TIE investment, with first programs set to begin January 2025.",
    org: "Texas Institute for Electronics", date: "2024-03",
    url: "https://news.utexas.edu/2024/03/28/ut-acc-texas-institute-for-electronics-to-launch-semiconductor-training-center-to-meet-industry-workforce-needs/",
  },
  {
    id: "seed-germany-chancenkarte-2024",
    stage: "scaling", country: "DE", provenance: "seeded", source: "milestone",
    title: "Germany's Opportunity Card (Chancenkarte), created under the reformed Skilled Immigration Act, took effect on 1 June 2024, letting qualified workers enter and job-search for up to a year without a firm job offer.",
    org: "German Federal Ministry of the Interior", date: "2024-06",
    url: "https://handbookgermany.de/en/opportunity-card",
  },
  {
    id: "seed-stem-opt-list-update-2024",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "DHS adds Environmental/Natural Resource Economics (CIP 03.0204) to the STEM Designated Degree Program List, expanding which majors qualify international graduates for the 24-month STEM OPT extension.",
    org: "Department of Homeland Security", date: "2024-07",
    url: "https://www.federalregister.gov/documents/2024/07/23/2024-16127/update-to-the-department-of-homeland-security-stem-designated-degree-program-list",
  },
  {
    id: "seed-o1a-policy-update-2025",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "USCIS issues Policy Alert PA-2025-02, updating O-1A evidentiary guidance with examples for AI, biotechnology, and other critical-technology experts under Executive Order 14110.",
    org: "U.S. Citizenship and Immigration Services", date: "2025-01",
    url: "https://www.uscis.gov/sites/default/files/document/policy-manual-updates/20250108-ExtraordinaryAbility.pdf",
  },
  {
    id: "seed-korea-top-tier-visa-2025",
    stage: "scaling", country: "KR", provenance: "seeded", source: "milestone",
    title: "South Korea launched a new 'top-tier visa' in March 2025, granting F-2 residency to senior foreign engineers in AI, robotics, semiconductors, displays, biotechnology, and defense technology.",
    org: "Ministry of Justice (South Korea)", date: "2025-03",
    url: "https://www.koreajoongangdaily.com/korea/koreas-new-top-tier-visa-offers-various-perks-to-attract-select-foreign-professionals/12296990",
  },
  {
    id: "seed-ai-education-eo-2025",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "President Trump signs Executive Order 14277, establishing a White House Task Force on AI Education and directing NSF, the Department of Education, and the Department of Labor to expand AI-skills training and launch a Presidential AI Challenge.",
    org: "The White House", date: "2025-04",
    url: "https://www.whitehouse.gov/presidential-actions/2025/04/advancing-artificial-intelligence-education-for-american-youth/",
  },
  {
    id: "seed-microsoft-elevate-2025",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "Microsoft launches Microsoft Elevate, a $4 billion commitment over five years to help 20 million people earn AI skilling credentials.",
    org: "Microsoft", date: "2025-07",
    url: "https://blogs.microsoft.com/on-the-issues/2025/07/09/elevate/",
  },
  {
    id: "seed-tech-nation-endorsing-2025",
    stage: "scaling", country: "GB", provenance: "seeded", source: "milestone",
    title: "UK Home Office confirmed Tech Nation as the Global Talent visa's Digital Technology endorsing body for at least three years, moving to a single consolidated endorsement form from 4 August 2025.",
    org: "UK Home Office", date: "2025-08",
    url: "https://eiglaw.com/uk-updates-global-talent-visa-endorsement-process-with-tech-nation-from-august-4-2025/",
  },
  {
    id: "seed-h1b-weighted-selection-rule-2025",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "DHS finalizes a wage-weighted H-1B lottery that enters higher-wage-level beneficiaries into the selection pool up to four times, effective February 27, 2026 for the FY2027 cap season.",
    org: "Department of Homeland Security", date: "2025-12",
    url: "https://www.federalregister.gov/documents/2025/12/29/2025-23853/weighted-selection-process-for-registrants-and-petitioners-seeking-to-file-cap-subject-h-1b",
  },
  {
    id: "seed-micron-nycreates-apprenticeship-2026",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "Micron and NY Creates launch a three-year pilot apprenticeship program in Central New York, targeting 70 percent of participants for employment at Micron's semiconductor megafab.",
    org: "Micron Technology", date: "2026-04",
    url: "https://www.governor.ny.gov/news/governor-hochul-announces-ny-creates-and-micron-workforce-development-partnership-support-new",
  },
  {
    id: "seed-korea-top-tier-visa-expansion-2026",
    stage: "scaling", country: "KR", provenance: "seeded", source: "milestone",
    title: "South Korea's Justice Ministry expanded the top-tier visa's eligibility on 31 May 2026 to include professors and full-time researchers in STEM fields, aiming to attract 350 additional foreign researchers through the program by 2030.",
    org: "Ministry of Justice (South Korea)", date: "2026-05",
    url: "https://www.koreaherald.com/article/10760272",
  },];

