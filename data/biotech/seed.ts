import type { Entry } from "../../src/lib/types.ts";

// Hand-curated entries for the pipeline stages that have no clean live feed.
// This is the honest layer: production/scaling milestones and adoption events
// are reported in press releases, regulatory notices and government policy
// documents, not a queryable API. Add, remove, or correct entries here —
// each is one object. Keep `provenance` as "seeded" so the UI labels them
// correctly. `date` may be YYYY-MM.
//
// `country` is the real ISO 3166-1 alpha-2 code for where the org is based —
// every entry gets its actual country, never a regional bucket. Two
// conventions worth stating, because biotech forces the question more than
// quantum or AI did:
//   - For a manufacturing milestone, `country` is where the CAPACITY
//     physically sits, not where the parent company is domiciled. Lonza's
//     Vacaville acquisition is US, even though Lonza is Swiss — a policy
//     reader asking "who has fermentation capacity on their soil" wants the
//     site, and the acquiring company is named in the title either way.
//   - For a supranational body with no country of its own, `country` is
//     where the institution physically sits — the European Commission is
//     BE — matching institutionCountry.ts's own "where is this institution
//     located" framing. Nothing is bucketed into a synthetic "EU" code.
//
// Every entry below was fetched and confirmed against its source URL before
// being added (specific claim checked — the figure, the date and the "first"
// claim each read off the source, not recalled). Don't add an entry you
// haven't verified the same way — a wrong one here is presented as curated
// fact, not a live feed that can just be re-fetched.
//
// Deliberate scope decision, same one the OpenAlex filter in verticals.ts
// makes: this vertical tracks BIOTECHNOLOGY as a platform technology —
// engineering biology, biomanufacturing capacity, gene/cell therapy,
// omics and molecular-diagnostic platforms, biosecurity — not clinical
// medicine or the pharmaceutical industry at large. A phase 3 readout, an
// M&A deal and a drug-pricing fight are all real news and none of them are
// a scaling or adoption milestone in this app's sense. That's also why the
// RSS classifier excludes them (see AI_RSS_CLASSIFIER's biotech sibling in
// verticals.ts).
//
// To add a new entry: copy a block, change the fields, give it a unique id.

export const SEED: Entry[] = [
  // ── Stage 02: production / scaling ──────────────────────────────
  // Biomanufacturing capacity — the closest biotech analogue to quantum's
  // qubit count. Measured in litres of bioreactor capacity and doses per
  // year, and increasingly a sovereign-capability question rather than a
  // purely commercial one.
  {
    id: "seed-samsung-biologics-plant4-2022",
    stage: "scaling", country: "KR", provenance: "seeded", source: "milestone",
    title: "Samsung Biologics begins GMP operations at Plant 4 in Songdo, 23 months after groundbreaking — 240,000 litres on full completion, taking Bio Campus I to 604,000 litres, which the company puts at over a quarter of global CDMO capacity",
    org: "Samsung Biologics", date: "2022-10",
    url: "https://samsungbiologics.com/media/bio-story/how-samsung-biologics-plant4-will-drive-clients-success",
  },
  {
    id: "seed-fujifilm-holly-springs-2025",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "FUJIFILM Biotechnologies opens its $3.2 billion Holly Springs site in North Carolina with eight 20,000-litre mammalian cell-culture bioreactors, one of the largest commercial-scale sites in North America",
    org: "FUJIFILM Biotechnologies", date: "2025-09",
    url: "https://fujifilmbiotechnologies.fujifilm.com/about/news/opening-of-commercial-scale-cell-culture-manufacturing-site-in-north-carolina/",
  },
  {
    id: "seed-lonza-vacaville-2024",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "Lonza completes its $1.2 billion purchase of Roche's Vacaville biologics site, about 330,000 litres of bioreactor capacity and one of the largest such facilities in the world",
    org: "Lonza", date: "2024-10",
    url: "https://www.lonza.com/news/2024-10-01-16-45",
  },
  {
    id: "seed-biontech-marburg-2021",
    stage: "scaling", country: "DE", provenance: "seeded", source: "milestone",
    title: "EMA clears mRNA drug-substance production at BioNTech's Marburg site, a former Novartis plant scaled toward up to one billion COVID-19 vaccine doses a year",
    org: "BioNTech", date: "2021-03",
    url: "https://investors.biontech.de/news-releases/news-release-details/biontech-provides-update-vaccine-production-status-marburg/",
  },
  {
    id: "seed-biontech-kigali-2023",
    stage: "scaling", country: "RW", provenance: "seeded", source: "milestone",
    title: "BioNTech inaugurates Africa's first mRNA vaccine plant in Kigali, a container-based BioNTainer site with roughly 50 million doses a year of initial capacity",
    org: "BioNTech", date: "2023-12",
    url: "https://investors.biontech.de/news-releases/news-release-details/biontech-achieves-milestone-mrna-based-vaccine-manufacturing-0",
  },
  {
    id: "seed-moderna-monash-2024",
    stage: "scaling", country: "AU", provenance: "seeded", source: "milestone",
    title: "Moderna opens the Southern Hemisphere's only pandemic-scale mRNA plant at Monash University in Victoria, rated at 100 million respiratory-vaccine doses a year",
    org: "Moderna", date: "2024-12",
    url: "https://www.health.gov.au/ministers/the-hon-mark-butler-mp/media/world-leading-moderna-vaccine-facility-opens-in-victoria",
  },
  {
    id: "seed-moderna-laval-2025",
    stage: "scaling", country: "CA", provenance: "seeded", source: "milestone",
    title: "Moderna produces the first made-in-Canada mRNA COVID-19 doses at its Laval facility, rated at 30 million doses a year and up to 100 million in a pandemic",
    org: "Moderna", date: "2025-09",
    url: "https://www.canada.ca/en/innovation-science-economic-development/news/2025/09/government-of-canada-announces-major-milestone-in-the-canadian-biomanufacturing-sector.html",
  },
  {
    id: "seed-novo-kalundborg-2023",
    stage: "scaling", country: "DK", provenance: "seeded", source: "milestone",
    title: "Novo Nordisk commits more than 42 billion Danish kroner to expand Kalundborg, most of it new active-ingredient capacity in a 170,000 m² multi-product facility",
    org: "Novo Nordisk", date: "2023-11",
    url: "https://www.globenewswire.com/news-release/2023/11/10/2778052/0/en/Novo-Nordisk-invests-more-than-42-billion-Danish-kroner-in-expansion-of-manufacturing-facilities-in-Kalundborg-Denmark.html",
  },
  {
    id: "seed-celltrion-plant3-2024",
    stage: "scaling", country: "KR", provenance: "seeded", source: "milestone",
    title: "Celltrion brings its 60,000-litre Songdo Plant 3 into commercial production, taking total drug-substance capacity to 250,000 litres across three plants",
    org: "Celltrion", date: "2024-12",
    url: "https://www.koreaherald.com/article/10012465",
  },
  {
    id: "seed-wuxi-dundalk-2021",
    stage: "scaling", country: "IE", provenance: "seeded", source: "milestone",
    title: "WuXi Biologics starts operations at Dundalk, its first site outside China, whose second cell-culture area runs twelve 4,000-litre single-use bioreactors for 48,000 litres",
    org: "WuXi Biologics", date: "2021-12",
    url: "https://www.pharmaceutical-technology.com/uncategorized/wuxi-biologics-dundalk-manufacturing-facility/",
  },
  {
    id: "seed-wuxi-singapore-2026",
    stage: "scaling", country: "SG", provenance: "seeded", source: "milestone",
    title: "WuXi Biologics tops out the drug-product facility at its Singapore CRDMO hub in Tuas Biomedical Park, adding 120,000 litres to a network it expects to pass 588,000 litres",
    org: "WuXi Biologics", date: "2026-06",
    url: "https://www.wuxibiologics.com/press-release/wuxi-biologics-singapore-crdmo-hub-completes-modular-topping-out-of-drug-product-facility/",
  },
  {
    id: "seed-afrigen-mrna-hub-2022",
    stage: "scaling", country: "ZA", provenance: "seeded", source: "milestone",
    title: "Afrigen's Cape Town mRNA technology-transfer hub, the WHO's first, produces a lab-scale batch of a second-generation mRNA vaccine built from the published Moderna sequence",
    org: "Afrigen Biologics and Vaccines", date: "2022-02",
    url: "https://www.who.int/news/item/11-02-2022-south-africa-s-mrna-hub-progress-is-foundation-for-self-reliance",
  },
  // Platform capability — sequencing throughput, protein design, bespoke
  // manufacturing. The "how fast and how cheap can we read, write and make
  // biology" layer.
  {
    id: "seed-illumina-novaseq-x-2022",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "Illumina launches the NovaSeq X series on new XLEAP-SBS chemistry, more than 20,000 whole genomes a year per instrument and a $200 genome at list price on the 25B flow cell",
    org: "Illumina", date: "2022-09",
    url: "https://www.illumina.com/company/news-center/press-releases/press-release-details.html?newsid=8d04df3f-d9c1-4c85-8177-6ea604627ccd",
  },
  {
    id: "seed-baby-kj-base-editing-2025",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "CHOP and Penn dose the first patient ever treated with a personalised in-vivo base-editing therapy, a lipid-nanoparticle base editor designed and manufactured in about six months for one infant's CPS1 mutation",
    org: "Children's Hospital of Philadelphia / University of Pennsylvania", date: "2025-02",
    url: "https://www.chop.edu/news/worlds-first-patient-treated-personalized-crispr-gene-editing-therapy-childrens-hospital",
  },
  {
    id: "seed-baker-protein-design-nobel-2024",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "David Baker takes half the 2024 Nobel Prize in Chemistry for computational protein design, work that has produced proteins used as pharmaceuticals, vaccines, nanomaterials and sensors",
    org: "University of Washington", date: "2024-10",
    url: "https://www.nobelprize.org/prizes/chemistry/2024/press-release/",
  },
  {
    id: "seed-alphafold-nobel-2024",
    stage: "scaling", country: "GB", provenance: "seeded", source: "milestone",
    title: "Demis Hassabis and John Jumper share the 2024 Nobel Prize in Chemistry for AlphaFold2, whose public database has grown from about 360,000 predicted structures at launch to roughly 200 million",
    org: "Google DeepMind", date: "2024-10",
    url: "https://www.nobelprize.org/prizes/chemistry/2024/press-release/",
  },
  {
    id: "seed-mgi-dnbseq-t7-2019",
    stage: "scaling", country: "CN", provenance: "seeded", source: "milestone",
    title: "MGI delivers the DNBSEQ-T7 to its first partners, a four-chip platform generating 6 terabases a day and up to 60 whole human genomes a day — the only high-throughput sequencing line at this scale outside the US",
    org: "MGI Tech", date: "2019-09-09",
    url: "https://www.prnewswire.com/news-releases/mgis-life-science-super-computer-dnbseq-t7-delivered-to-business-partners-300914181.html",
  },
  // Industrial and food biotechnology — fermentation as a manufacturing
  // technology rather than a therapeutic one.
  {
    id: "seed-lanzatech-china-2025",
    stage: "scaling", country: "CN", provenance: "seeded", source: "milestone",
    title: "LanzaTech's Chinese gas-fermentation plants reach a combined 210,000 tonnes a year of ethanol and 23,200 tonnes of microbial protein across four sites, fed by steel-mill and ferroalloy flue gas",
    org: "Beijing Shougang LanzaTech New Energy Technology", date: "2025-08",
    url: "http://english.scio.gov.cn/m/in-depth/2025-08/26/content_118042663.html",
  },
  {
    id: "seed-solar-foods-factory01-2024",
    stage: "scaling", country: "FI", provenance: "seeded", source: "milestone",
    title: "Solar Foods opens Factory 01 in Vantaa, the first commercial-scale plant growing Solein protein from carbon dioxide, hydrogen and electricity, at up to 160 tonnes a year",
    org: "Solar Foods", date: "2024-04",
    url: "https://solarfoods.com/opening-a-window-to-the-food-industrys-future-the-worlds-first-factory-growing-food-out-of-thin-air-launches/",
  },
  {
    id: "seed-lonza-visp-stein-2024",
    stage: "scaling", country: "CH", provenance: "seeded", source: "milestone",
    title: "Lonza confirms continuing investment in large-scale bioconjugation at Visp and drug-product manufacturing at Stein, its two Swiss anchor sites",
    org: "Lonza", date: "2024-10",
    url: "https://www.lonza.com/news/2024-10-01-16-45",
  },

  {
    id: "seed-samsung-biologics-plant5-2025",
    stage: "scaling", country: "KR", provenance: "seeded", source: "milestone",
    title: "Samsung Biologics brings its 180,000-litre Plant 5 into full operation, the first of Bio Campus II, taking total Songdo capacity across five plants to 785,000 litres",
    org: "Samsung Biologics", date: "2025-04",
    url: "https://www.koreabiomed.com/news/articleView.html?idxno=30281",
  },
  {
    id: "seed-boehringer-vienna-lscc-2021",
    stage: "scaling", country: "AT", provenance: "seeded", source: "milestone",
    title: "Boehringer Ingelheim inaugurates its Large Scale Cell Culture plant in Vienna, 185,000 litres of fermenter volume and a 30% addition to its mammalian large-scale capacity, on more than €700 million — the largest single investment in the company's history",
    org: "Boehringer Ingelheim", date: "2021-10",
    url: "https://www.boehringer-ingelheim.com/about-us/who-we-are/inaugurationbiopharmaceuticalproductionfacilityvienna",
  },
  {
    id: "seed-serum-institute-capacity-2024",
    stage: "scaling", country: "IN", provenance: "seeded", source: "milestone",
    title: "Serum Institute of India, the world's largest vaccine maker by volume, runs capacity for about 3 billion doses a year against roughly 1.5 billion actually sold",
    org: "Serum Institute of India", date: "2024-06-11",
    url: "https://www.business-standard.com/companies/news/world-s-largest-vaccine-maker-serum-institute-sees-demand-doubling-in-5-yrs-124061100081_1.html",
  },
  {
    id: "seed-bio-farma-capacity-2025",
    stage: "scaling", country: "ID", provenance: "seeded", source: "milestone",
    title: "Bio Farma, Southeast Asia's largest vaccine maker, reports capacity above 3.5 billion doses a year across 150-plus countries and WHO prequalification for 12 vaccines, the only ASEAN manufacturer prequalified for export",
    org: "Bio Farma", date: "2025-10-20",
    url: "https://www.globenewswire.com/news-release/2025/10/21/3170088/0/en/Indonesia-s-Legacy-in-the-Global-Vaccine-Landscape-Bio-Farma-and-DCVMN-Strengthen-Health-Resilience-Through-Global-Partnership.html",
  },
  {
    id: "seed-pasteur-dakar-madiba-2024",
    stage: "scaling", country: "SN", provenance: "seeded", source: "milestone",
    title: "Institut Pasteur de Dakar closes a $45 million IFC-led financing package for MADIBA, a modular container-built vaccine plant at Diamniadio designed for up to 300 million doses a year",
    org: "Institut Pasteur de Dakar", date: "2024-12",
    url: "https://www.ifc.org/en/pressroom/2024/ifc-and-partners-support-institut-pasteur-de-dakar-to-boost-vaccine-manufacturing-for-africa",
  },
  {
    id: "seed-sanofi-mrna-coe-2021",
    stage: "scaling", country: "FR", provenance: "seeded", source: "milestone",
    title: "Sanofi launches a vaccines mRNA Center of Excellence at roughly €400 million a year and about 400 staff, integrating end-to-end mRNA capability across Marcy l'Étoile near Lyon and Cambridge, Massachusetts",
    org: "Sanofi", date: "2021-06-29",
    url: "https://www.sanofi.com/en/media-room/press-releases/2021/2021-06-29-08-00-40-2254458",
    countryEvidence: "Dual-site centre — logged to France for the Marcy l'Étoile anchor, with the Cambridge, Massachusetts half stated in the title rather than hidden",
  },
  {
    id: "seed-grifols-llica-de-vall-2025",
    stage: "scaling", country: "ES", provenance: "seeded", source: "milestone",
    title: "Grifols commits to a new Lliçà de Vall plant that would double its European plasma fractionation capacity, adding three million litres of plasma a year",
    org: "Grifols", date: "2025-07-16",
    url: "https://www.grifols.com/en/view-news/-/news/grifols-will-build-new-manufacturing-site-in-spain-to-double-its-plasma-fractionation-capacity-in-europe",
  },
  // ── Stage 03: adoption ──────────────────────────────────────────
  // ── Historical anchors, added 2026-09-02 ────────────────────────
  // Same reason as quantum's and AI's: this set started in 2018, so the
  // pipeline view opened mid-story. Both of these are the "first ever" that
  // every later approval in this file is measured against.
  {
    id: "seed-fda-humulin-1982",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "The FDA approves Eli Lilly's Humulin, human insulin grown in recombinant E. coli licensed from Genentech — the first marketed healthcare product of any kind derived from recombinant DNA, cleared five months after filing",
    org: "Eli Lilly / Genentech", date: "1982-10-29",
    url: "https://www.acsh.org/news/2019/10/28/record-time-fda-approval-human-insulin-1982-when-genetic-engineering-came-age-14362",
    deploymentStatus: "deployed",
  },
  {
    id: "seed-fda-kymriah-2017",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "The FDA approves Novartis' Kymriah for relapsed or refractory B-cell ALL in patients up to 25, the first CAR-T cell immunotherapy and the first gene therapy of any kind cleared in the United States, on a trial where 83% of 63 patients reached remission within three months",
    org: "Novartis", date: "2017-08-30",
    url: "https://www.fda.gov/drugs/resources-information-approved-drugs/fda-approves-tisagenlecleucel-b-cell-all-and-tocilizumab-cytokine-release-syndrome",
    deploymentStatus: "deployed",
  },
  // Regulatory approval is biotech's real adoption gate: it is the moment a
  // platform stops being research and starts being something a health system
  // can buy. `deploymentStatus: "deployed"` for an approval that opens
  // commercial use, "operating" for a programme already in routine service,
  // "pilot" for a real study at national scale, "announced" for a strategy
  // or policy with no product behind it yet.
  {
    id: "seed-mhra-casgevy-2023",
    stage: "adoption", country: "GB", provenance: "seeded", source: "deployment",
    title: "The MHRA authorises Casgevy for sickle cell disease and transfusion-dependent beta thalassaemia in patients 12 and older, the world's first approved CRISPR-based medicine",
    org: "Medicines and Healthcare products Regulatory Agency", date: "2023-11-16",
    url: "https://www.gov.uk/government/case-studies/the-importance-of-giving-patients-a-voice-in-the-approval-of-new-sickle-cell-treatment",
    deploymentStatus: "deployed",
  },
  {
    id: "seed-fda-sickle-cell-gene-therapies-2023",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "The FDA approves Casgevy and Lyfgenia, the first cell-based gene therapies for sickle cell disease, making roughly 16,000 US patients eligible for a one-time treatment",
    org: "U.S. Food and Drug Administration", date: "2023-12-08",
    url: "https://www.fda.gov/news-events/press-announcements/fda-approves-first-gene-therapies-treat-patients-sickle-cell-disease",
    deploymentStatus: "deployed",
  },
  {
    id: "seed-cdsco-nexcar19-2023",
    stage: "adoption", country: "IN", provenance: "seeded", source: "deployment",
    title: "CDSCO approves NexCAR19, India's first indigenous CAR-T therapy, built by ImmunoACT with IIT Bombay and Tata Memorial Centre and priced near $50,000 against roughly $400,000 for a US infusion",
    org: "ImmunoACT", date: "2023-10",
    url: "https://www.cancer.gov/news-events/cancer-currents-blog/2024/nexcar19-car-t-cell-therapy-india-nci-collaboration",
    deploymentStatus: "deployed",
  },
  {
    id: "seed-nmpa-fucaso-2023",
    stage: "adoption", country: "CN", provenance: "seeded", source: "deployment",
    title: "China's NMPA conditionally approves FUCASO (equecabtagene autoleucel), the first fully-human BCMA CAR-T therapy, for relapsed or refractory multiple myeloma",
    org: "IASO Bio / Innovent Biologics", date: "2023-06-30",
    url: "https://en.iasobio.com/info.php?id=224",
    deploymentStatus: "deployed",
  },
  {
    id: "seed-fda-hemgenix-2022",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "The FDA approves Hemgenix, the first gene therapy for haemophilia B, priced at about $3.5 million and the most expensive single-use medicine in the United States",
    org: "CSL Behring", date: "2022-11-22",
    url: "https://newsroom.csl.com/2022-11-22-U-S-Food-and-Drug-Administration-approves-CSLs-HEMGENIX-R-etranacogene-dezaparvovec-drlb-,-the-first-gene-therapy-for-hemophilia-B",
    deploymentStatus: "deployed",
  },
  {
    id: "seed-fda-zolgensma-2019",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "The FDA approves Zolgensma, the first gene therapy for spinal muscular atrophy, for children under two including those pre-symptomatic at diagnosis",
    org: "U.S. Food and Drug Administration", date: "2019-05-24",
    url: "https://www.fda.gov/news-events/press-announcements/fda-approves-innovative-gene-therapy-treat-pediatric-patients-spinal-muscular-atrophy-rare-disease",
    deploymentStatus: "deployed",
  },
  // Cultivated meat and precision fermentation — the clearest case anywhere
  // in this dataset of regulatory approval, not technical capability, being
  // the binding constraint on adoption.
  {
    id: "seed-sfa-cultivated-chicken-2020",
    stage: "adoption", country: "SG", provenance: "seeded", source: "deployment",
    title: "The Singapore Food Agency clears Eat Just's cell-cultured chicken after a seven-expert safety review, the world's first regulatory approval for cultivated meat",
    org: "Singapore Food Agency", date: "2020-12-01",
    url: "https://www.technologyreview.com/2020/12/01/1012789/cultured-cultivated-meat-just-singapore-approved-food-climate/",
    deploymentStatus: "deployed",
  },
  {
    id: "seed-usda-cultivated-chicken-2023",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "USDA grants UPSIDE Foods and GOOD Meat their final approvals to sell cell-cultivated chicken, the first US cultivated-meat clearances, following FDA no-questions letters in 2022 and 2023",
    org: "U.S. Department of Agriculture", date: "2023-06-21",
    url: "https://gfi.org/press/good-meat-and-upside-foods-approved-to-sell-cultivated-chicken-following-landmark-usda-action/",
    deploymentStatus: "deployed",
  },
  {
    id: "seed-israel-cultivated-beef-2024",
    stage: "adoption", country: "IL", provenance: "seeded", source: "deployment",
    title: "Israel's Ministry of Health issues the world's first regulatory approval for cultivated beef, to Aleph Farms, after reviewing toxicology, allergenicity, nutrition and manufacturing end to end",
    org: "Aleph Farms", date: "2024-01-17",
    url: "https://aleph-farms.com/journals/aleph-farms-granted-worlds-first-regulatory-approval-for-cultivated-beef/",
    deploymentStatus: "deployed",
  },
  {
    id: "seed-singapore-solein-2022",
    stage: "adoption", country: "SG", provenance: "seeded", source: "deployment",
    title: "Singapore grants Solar Foods' Solein its first novel-food approval, clearing a protein grown from carbon dioxide, air and electricity for sale about a year after the dossier was filed",
    org: "Singapore Food Agency", date: "2022-09",
    url: "https://solarfoods.com/solar-foods-receives-novel-food-regulatory-approval/",
    deploymentStatus: "deployed",
  },
  // Gene-edited agriculture — a separate regulatory track from therapeutics,
  // and the one where a country's position can reverse.
  {
    id: "seed-japan-gaba-tomato-2021",
    stage: "adoption", country: "JP", provenance: "seeded", source: "deployment",
    title: "Sanatech Seed begins direct sales of its Sicilian Rouge High GABA tomato, the first CRISPR-edited food sold to consumers anywhere, after Japanese ministries ruled it would not be regulated as a GMO",
    org: "Sanatech Seed", date: "2021-09-15",
    url: "https://www.nature.com/articles/d41587-021-00026-2",
    deploymentStatus: "deployed",
  },
  {
    id: "seed-uk-precision-breeding-regs-2025",
    stage: "adoption", country: "GB", provenance: "seeded", source: "deployment",
    title: "The Genetic Technology (Precision Breeding) Regulations 2025 come into force in England, completing the approval route for precision-bred plants that the 2023 Act created",
    org: "Department for Environment, Food and Rural Affairs", date: "2025-11-13",
    url: "https://www.legislation.gov.uk/ukdsi/2025/9780348269123",
    deploymentStatus: "deployed",
  },
  {
    id: "seed-brazil-ctnbio-rn16-2018",
    stage: "adoption", country: "BR", provenance: "seeded", source: "deployment",
    title: "CTNBio's Normative Resolution 16 lets gene-edited crops carrying no foreign DNA be regulated as conventional in Brazil, decided case by case, after a three-year expert review",
    org: "Comissão Técnica Nacional de Biossegurança", date: "2018-01-15",
    url: "https://www.geneconvenevi.org/articles/the-national-biosafety-technical-commission-ctnbio-normative-resolution-no-16-of-january-15-2018/",
    deploymentStatus: "operating",
  },
  {
    id: "seed-philippines-golden-rice-2024",
    stage: "adoption", country: "PH", provenance: "seeded", source: "deployment",
    title: "The Philippine Court of Appeals halts commercial propagation and field testing of Golden Rice and Bt eggplant on precautionary grounds, three years after the Philippines became the first country to approve Golden Rice for commercial production",
    org: "Court of Appeals of the Philippines", date: "2024-04-17",
    url: "https://www.science.org/content/article/what-philippine-court-ruling-means-transgenic-golden-rice-once-hailed-dietary",
    deploymentStatus: "announced",
  },
  // National strategy and biosecurity policy — the "government has decided
  // this is a strategic sector" signal, which for biotech arrives years
  // before any procurement does.
  {
    id: "seed-india-bioe3-2024",
    stage: "adoption", country: "IN", provenance: "seeded", source: "deployment",
    title: "India's cabinet approves the BioE3 policy, its first dedicated biomanufacturing policy, funding Biomanufacturing and Bio-AI hubs plus a biofoundry across six thematic sectors",
    org: "Department of Biotechnology, Government of India", date: "2024-08-24",
    url: "https://www.pmindia.gov.in/en/news_updates/cabinet-approves-bioe3-biotechnology-for-economy-environment-and-employment-policy-for-fostering-high-performance-biomanufacturing/",
    deploymentStatus: "announced",
  },
  {
    id: "seed-china-bioeconomy-plan-2022",
    stage: "adoption", country: "CN", provenance: "seeded", source: "deployment",
    title: "The NDRC publishes China's first five-year plan for the bioeconomy, targeting a 22-trillion-yuan sector by 2025 with pilot zones in Beijing-Tianjin-Hebei, the Yangtze Delta, the Greater Bay Area and Chengdu-Chongqing",
    org: "National Development and Reform Commission", date: "2022-05-10",
    url: "https://en.ndrc.gov.cn/netcoo/achievements/202205/t20220520_1326683.html",
    deploymentStatus: "announced",
  },
  {
    id: "seed-japan-bioeconomy-strategy-2024",
    stage: "adoption", country: "JP", provenance: "seeded", source: "deployment",
    title: "Japan's Cabinet Office adopts a Bioeconomy Strategy targeting a ¥100 trillion market by 2030, with microbial and cell design platforms and biofoundry infrastructure named as the biomanufacturing pillar",
    org: "Cabinet Office, Government of Japan", date: "2024-06-03",
    url: "https://www8.cao.go.jp/cstp/english/bio/bio_economy_en.pdf",
    deploymentStatus: "announced",
  },
  {
    id: "seed-eu-biotech-act-2025",
    stage: "adoption", country: "BE", provenance: "seeded", source: "deployment",
    title: "The European Commission proposes a European Biotech Act, fast-tracking permits for health-biotech strategic projects to eight or ten months and requiring built-in screening on benchtop nucleic-acid synthesis devices",
    org: "European Commission", date: "2025-12-16",
    url: "https://health.ec.europa.eu/publications/proposal-regulation-establish-measures-strengthen-unions-biotechnology-and-biomanufacturing-sectors_en",
    countryEvidence: "European Commission, seated in Brussels — a supranational body gets the country it physically sits in, never a synthetic regional code",
    deploymentStatus: "announced",
  },
  {
    id: "seed-nsceb-final-report-2025",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "The National Security Commission on Emerging Biotechnology delivers 49 recommendations to Congress and asks for at least $15 billion over five years, including a National Biotechnology Coordination Office",
    org: "National Security Commission on Emerging Biotechnology", date: "2025-04-08",
    url: "https://www.biotech.senate.gov/press-releases/nsceb-publishes-final-report/",
    deploymentStatus: "announced",
  },
  {
    id: "seed-ostp-nucleic-acid-screening-2024",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "OSTP publishes the Framework for Nucleic Acid Synthesis Screening, making compliant sourcing of synthetic DNA and benchtop synthesisers a condition of US federal life-sciences funding from 26 April 2025",
    org: "White House Office of Science and Technology Policy", date: "2024-04-29",
    url: "https://aspr.hhs.gov/S3/Documents/OSTP-Nucleic-Acid-Synthesis-Screening-Framework-Sep2024.pdf",
    deploymentStatus: "operating",
  },
  {
    id: "seed-lifera-saudibio-insulin",
    stage: "adoption", country: "SA", provenance: "seeded", source: "deployment",
    title: "Lifera, the Saudi PIF's biomanufacturing company, signs a seven-year plan with Novo Nordisk through its SaudiBio subsidiary to localise more than half of Saudi Arabia's insulin need, targeting the GCC's first locally-produced innovator biologic insulin by 2027",
    org: "Lifera", date: "2024-10-21",
    url: "https://www.saudigazette.com.sa/article/646400/BUSINESS/Lifera-to-localize-over-50-of-Saudi-Arabias-insulin-needs-with-Novo-Nordisk-Saudi-Arabia",
    deploymentStatus: "procurement",
  },
  // Population genomics — biotech adoption measured in people sequenced
  // rather than products approved, and the one place a small country can
  // credibly lead.
  {
    id: "seed-uae-genome-programme-2025",
    stage: "adoption", country: "AE", provenance: "seeded", source: "deployment",
    title: "The Emirati Genome Programme passes 815,000 collected samples against a citizen population of roughly one million, up from 600,000 the previous June — one of the world's largest population-wide genome programmes",
    org: "Emirati Genome Programme", date: "2025-04",
    url: "https://www.thenationalnews.com/news/uae/2025/04/17/more-than-800000-emiratis-contribute-to-uae-genome-programme-to-boost-health-of-the-nation/",
    deploymentStatus: "operating",
  },
  {
    id: "seed-genomics-england-generation-study-2024",
    stage: "adoption", country: "GB", provenance: "seeded", source: "deployment",
    title: "NHS England begins the Generation Study, sequencing up to 100,000 newborn genomes to screen for more than 200 rare childhood-onset conditions, with results returned within 28 days when a condition is suspected",
    org: "Genomics England / NHS England", date: "2024-10",
    url: "https://www.england.nhs.uk/2024/10/first-newborn-babies-tested-for-over-200-genetic-conditions-as-world-leading-study-begins-in-nhs-hospitals/",
    deploymentStatus: "pilot",
  },
  {
    id: "seed-ec-casgevy-2024",
    stage: "adoption", country: "BE", provenance: "seeded", source: "deployment",
    title: "The European Commission grants Casgevy a conditional marketing authorisation valid across the EU, the first medicine anywhere produced using CRISPR/Cas gene editing to clear the bloc, with more than 8,000 patients potentially eligible",
    org: "European Commission", date: "2024-02-09",
    url: "https://www.ema.europa.eu/en/medicines/human/EPAR/casgevy",
    countryEvidence: "European Commission, seated in Brussels — same convention as the European Biotech Act entry; no synthetic EU code",
    deploymentStatus: "deployed",
  },
  {
    id: "seed-fda-casgevy-age-2-2026",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "The FDA extends Casgevy to patients aged 2 and older, the first gene therapy approved for young children with sickle cell disease, on a trial of 11 patients aged 5 to under 12",
    org: "U.S. Food and Drug Administration", date: "2026-07",
    url: "https://www.fda.gov/news-events/press-announcements/fda-approves-first-gene-therapy-young-children-sickle-cell-disease",
    deploymentStatus: "deployed",
  },
  {
    id: "seed-anvisa-butantan-dengue-2025",
    stage: "adoption", country: "BR", provenance: "seeded", source: "deployment",
    title: "Anvisa approves Butantan-DV for ages 12 to 59, the world's first single-dose dengue vaccine, at 74.7% overall efficacy and 100% against hospitalisation, with more than 30 million doses expected by mid-2026",
    org: "Instituto Butantan", date: "2025-11-26",
    url: "https://agenciabrasil.ebc.com.br/en/saude/noticia/2025-12/registration-brazils-dengue-vaccine-officially-announced",
    deploymentStatus: "deployed",
  },
  {
    id: "seed-korea-cultivated-food-pathway-2024",
    stage: "adoption", country: "KR", provenance: "seeded", source: "deployment",
    title: "South Korea's Ministry of Food and Drug Safety opens an approval pathway for cell-cultured food ingredients, a year after a Food Hygiene Act revision let them out of research-only use",
    org: "Ministry of Food and Drug Safety", date: "2024-02",
    url: "https://www.khlaw.com/insights/korea-releases-application-guidelines-cell-cultured-food",
    deploymentStatus: "announced",
  },
  {
    id: "seed-meatable-eu-tasting-2024",
    stage: "adoption", country: "NL", provenance: "seeded", source: "deployment",
    title: "Meatable holds the first official cultivated-meat tasting in the European Union at Leiden, cleared by an independent expert committee sanctioned by the Dutch government, which had already legalised consumer trials and put €60 million behind the sector",
    org: "Meatable", date: "2024-04-17",
    url: "https://www.meatable.com/releases-announcements/press-release-first-eu-tasting/",
    deploymentStatus: "pilot",
  },
  {
    id: "seed-argentina-hb4-wheat-2020",
    stage: "adoption", country: "AR", provenance: "seeded", source: "deployment",
    title: "Argentina becomes the first country to approve a drought-tolerant genetically modified wheat, Bioceres' HB4, for growth and consumption — commercialisation held contingent on import approval in Brazil, which buys 85% of Argentina's wheat",
    org: "Bioceres Crop Solutions", date: "2020-10-08",
    url: "https://investors.biocerescrops.com/news/news-details/2020/Bioceres-Crop-Solutions-Corp.-Announces-Regulatory-Approval-of-Drought-Tolerant-HB4-Wheat-in-Argentina/default.aspx",
    deploymentStatus: "deployed",
  },

  // ── Stage 04: investment (private capital) ──────────────────────
  // Real, individually-verified private raises. `source: "funding-round"`
  // keeps these OUT of fundingByCountry/periodFunding, which filter to
  // source === "grant" so the Investment KPI stays the NSF/public number —
  // see aggregate.ts and CLAUDE.md's "Private funding rounds" section.
  // Public companies in this vertical's `tickers` list are deliberately
  // excluded: their capital story is the market panel and the R&D chart,
  // not a seeded round. Biotechnology had none of these at launch while
  // quantum had 15 and AI 17, so this is the layer catching up.
  {
    id: "seed-isomorphic-600m-2025",
    stage: "investment", country: "GB", provenance: "seeded", source: "funding-round",
    title: "Isomorphic Labs raises $600 million in its first external round, led by Thrive Capital with GV and existing investor Alphabet, to push its AI drug-design engine toward the clinic",
    org: "Isomorphic Labs", date: "2025-03-31", amountUsd: 600_000_000,
    url: "https://www.isomorphiclabs.com/articles/isomorphic-labs-announces-600m-external-investment-round",
  },
  {
    id: "seed-isomorphic-series-b-2026",
    stage: "investment", country: "GB", provenance: "seeded", source: "funding-round",
    title: "Isomorphic Labs secures a $2.1 billion Series B led by Thrive Capital, joined by Alphabet, GV, MGX, Temasek, CapitalG and the UK Sovereign AI Fund",
    org: "Isomorphic Labs", date: "2026-05-12", amountUsd: 2_100_000_000,
    url: "https://www.isomorphiclabs.com/articles/isomorphic-labs-announces-series-b-investment-round",
  },
  {
    id: "seed-xaira-launch-2024",
    stage: "investment", country: "US", provenance: "seeded", source: "funding-round",
    title: "Xaira Therapeutics launches with more than $1 billion from ARCH Venture Partners and Foresite Labs, ARCH's largest investment in its 39-year history, built around the team behind the RFdiffusion and RFantibody protein-design models",
    org: "Xaira Therapeutics", date: "2024-04-24", amountUsd: 1_000_000_000,
    url: "https://www.fiercebiotech.com/biotech/new-ai-drug-discovery-powerhouse-xaira-rises-1b-funding",
  },
  {
    id: "seed-altos-labs-2022",
    stage: "investment", country: "US", provenance: "seeded", source: "funding-round",
    title: "Altos Labs launches with $3 billion in seed funding for cellular rejuvenation programming, backed by Jeff Bezos, Yuri Milner and ARCH Venture Partners — the largest seed round ever raised",
    org: "Altos Labs", date: "2022-01-19", amountUsd: 3_000_000_000,
    url: "https://cen.acs.org/business/start-ups/Altos-Labs-launches-3-billion/100/i3",
  },
  {
    id: "seed-evolutionaryscale-2024",
    stage: "investment", country: "US", provenance: "seeded", source: "funding-round",
    title: "EvolutionaryScale emerges from stealth with more than $142 million in seed funding and ESM3, a protein language model trained on 2.78 billion proteins that generated a novel green fluorescent protein",
    org: "EvolutionaryScale", date: "2024-06-25", amountUsd: 142_000_000,
    url: "https://www.businesswire.com/news/home/20240625717839/en/EvolutionaryScale-Launches-with-ESM3-A-Milestone-AI-Model-for-Biology",
  },
  {
    id: "seed-dna-script-series-c-2021",
    stage: "investment", country: "FR", provenance: "seeded", source: "funding-round",
    title: "DNA Script raises a $165 million first tranche of an oversubscribed Series C, later closed at $200 million, to commercialise its SYNTAX benchtop enzymatic DNA printer",
    org: "DNA Script", date: "2021-10-26", amountUsd: 165_000_000,
    url: "https://www.dnascript.com/press-releases/dna-script-raises-165m-in-oversubscribed-series-c-financing-to-accelerate-commercialization-of-enzymatic-dna-printing-platform/",
  },
  {
    id: "seed-cradle-series-b-2024",
    stage: "investment", country: "NL", provenance: "seeded", source: "funding-round",
    title: "Cradle raises a $73 million Series B led by IVP for AI protein engineering, taking the Amsterdam and Zürich company past $100 million total",
    org: "Cradle", date: "2024-11-26", amountUsd: 73_000_000,
    url: "https://www.cradle.bio/blog/series-b",
  },
  {
    id: "seed-bota-bio-series-b-2021",
    stage: "investment", country: "CN", provenance: "seeded", source: "funding-round",
    title: "Bota Bio raises a $100 million Series B led by Sequoia Capital China to scale synthetic-biology and enzyme-engineering manufacturing from its Hangzhou base, taking total funding to $145 million",
    org: "Bota Bio", date: "2021-07-29", amountUsd: 100_000_000,
    url: "https://www.prnewswire.com/news-releases/bota-bio-raises-100-million-series-b-financing-to-advance-sustainable-biomanufacturing-301343566.html",
  },
  {
    id: "seed-aleph-farms-series-b-2021",
    stage: "investment", country: "IL", provenance: "seeded", source: "funding-round",
    title: "Aleph Farms closes a $105 million Series B led by L Catterton's Growth Fund and Abu Dhabi's DisruptAD, with Thai Union, BRF, CJ CheilJedang and Cargill participating, three years before its cultivated beef won the world's first regulatory approval",
    org: "Aleph Farms", date: "2021-07-07", amountUsd: 105_000_000,
    url: "https://www.prnewswire.com/il/news-releases/aleph-farms-completes-105-million-series-b-funding-round-301326759.html",
  },
  {
    id: "seed-spiber-2024",
    stage: "investment", country: "JP", provenance: "seeded", source: "funding-round",
    title: "Spiber raises over ¥10 billion (about $65 million) to scale fermentation production of its Brewed Protein materials, taking total funding near $489 million — and entered private liquidation in March 2026, the clearest case in this dataset of capital raised not being capacity delivered",
    org: "Spiber", date: "2024-04-12", amountUsd: 65_000_000,
    url: "https://www.businesswire.com/news/home/20240412872292/en/Spiber-Inc.-Raises-Over-JPY-10-Billion-in-Funding-to-Strengthen-Mass-Production-and-Sales-Initiatives",
  },
];
