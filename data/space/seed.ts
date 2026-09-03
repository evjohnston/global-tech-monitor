import type { Entry } from "../../src/lib/types.ts";

// Hand-curated entries for the pipeline stages that have no clean live feed.
// Production/scaling milestones and adoption events are reported in press
// releases, launch webcasts, contract announcements and national policy
// documents, not a queryable API. Add, remove, or correct entries here —
// each is one object. Keep `provenance` as "seeded" so the UI labels them
// correctly. `date` may be YYYY-MM.
//
// Every entry below was fetched and confirmed against its source URL before
// being added — the figure, the date and any "first" claim each read off
// the source rather than recalled. Don't add an entry you haven't verified
// the same way; a wrong one here is presented as curated fact.
//
// SCOPE, stated once so it doesn't drift. This vertical tracks space
// TECHNOLOGY — launch, propulsion, spacecraft, satellites and their
// communications, on-orbit operations, space traffic — and the policy and
// procurement around it. It does NOT track astronomy or planetary science,
// which are science ABOUT space. A telescope's cosmological result is not a
// scaling milestone here; the telescope reaching orbit on a new launcher
// is. Same call the OpenAlex filter in verticals.ts makes, and the same
// kind of call biotechnology makes in excluding clinical medicine.
//
// `country` conventions, matching data/biotech/seed.ts:
//   - A launch or facility gets the country it physically happens in —
//     Ariane 6 flies from Kourou, which is France.
//   - A supranational body gets the country it physically sits in. The
//     European Commission is BE. Nothing is bucketed into an "EU" code.

export const SEED: Entry[] = [
  // ── Stage 02: production / scaling ──────────────────────────────
  // Launch and vehicle capability. The closest thing this field has to
  // quantum's qubit count is a vehicle doing something for the first time,
  // and — increasingly — doing it repeatedly and cheaply.
  {
    id: "seed-falcon9-first-landing-2015",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "SpaceX lands a Falcon 9 first stage at Cape Canaveral after delivering 11 Orbcomm satellites to orbit — the first time an orbital-class rocket's first stage returned from a real payload mission and landed vertically",
    org: "SpaceX", date: "2015-12-21",
    url: "https://www.space.com/31420-spacex-rocket-landing-success.html",
  },
  {
    id: "seed-rocketlab-still-testing-2018",
    stage: "scaling", country: "NZ", provenance: "seeded", source: "milestone",
    title: "Rocket Lab's Electron reaches orbit on its second flight from Māhia Peninsula, carrying Planet and Spire cubesats — the first orbital-class rocket launched from a privately owned spaceport",
    org: "Rocket Lab", date: "2018-01-21",
    url: "https://rocketlabcorp.com/missions/launches/its-a-test/",
  },
  {
    id: "seed-nuri-kslv2-2022",
    stage: "scaling", country: "KR", provenance: "seeded", source: "milestone",
    title: "South Korea's Nuri (KSLV-II) reaches a 700 km orbit from Naro Space Center on its second flight, making Korea the seventh country able to launch a one-tonne satellite on its own technology and the first Korean vehicle with entirely domestic engines on all three stages",
    org: "Korea Aerospace Research Institute", date: "2022-06-21",
    url: "https://www.koreatimes.co.kr/www/tech/2022/06/133_331368.html",
  },
  {
    id: "seed-ariane6-first-flight-2024",
    stage: "scaling", country: "FR", provenance: "seeded", source: "milestone",
    title: "Ariane 6 flies for the first time from Kourou on mission VA262, restoring Europe's independent access to space a year after Ariane 5's retirement left it unable to launch large satellites on a homegrown rocket",
    org: "European Space Agency / ArianeGroup", date: "2024-07-09",
    url: "https://www.esa.int/Enabling_Support/Space_Transportation/Ariane/Europe_s_new_Ariane_6_rocket_powers_into_space",
  },
  // Destination capability — landing, orbiting, operating somewhere other
  // than low Earth orbit. This is where the set of capable countries is
  // still small enough to name.
  {
    id: "seed-uae-hope-mars-2021",
    stage: "scaling", country: "AE", provenance: "seeded", source: "milestone",
    title: "The UAE's Hope probe completes a 27-minute burn into Mars orbit after a 204-day cruise, making the Emirates the fifth entity ever to reach Mars and the first West Asian, Arab or Muslim-majority country to fly an interplanetary mission",
    org: "Mohammed bin Rashid Space Centre", date: "2021-02-09",
    url: "https://www.space.com/uae-hope-mars-mission-orbit-insertion-success",
  },
  {
    id: "seed-chandrayaan3-2023",
    stage: "scaling", country: "IN", provenance: "seeded", source: "milestone",
    title: "ISRO's Chandrayaan-3 lands Vikram at 69°S on the Moon, making India the fourth country to land on the lunar surface and the first to land near a lunar pole, where shadowed craters are thought to hold water ice",
    org: "Indian Space Research Organisation", date: "2023-08-23",
    url: "https://www.science.org/content/article/india-makes-history-landing-spacecraft-near-moon-s-south-pole",
  },
  {
    id: "seed-intuitive-machines-im1-2024",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "Intuitive Machines' Odysseus touches down near Malapert-A under NASA's Commercial Lunar Payload Services programme — the first lunar soft landing by a private company and the first US soft landing since Apollo 17 in 1972, though the lander tipped to about 30 degrees",
    org: "Intuitive Machines", date: "2024-02-22",
    url: "https://spacenews.com/intuitive-machines-and-nasa-call-im-1-lunar-lander-a-success-as-mission-winds-down/",
  },
  // Constellation buildout — the defining industrial activity of this
  // decade in space, and the clearest place where the US/China contest is
  // measured in hardware rather than rhetoric.
  {
    id: "seed-qianfan-first-launch-2024",
    stage: "scaling", country: "CN", provenance: "seeded", source: "milestone",
    title: "China launches the first 18 flat-panel Qianfan satellites on a Long March 6A, opening a constellation planned at 1,296 satellites in phase one and more than 15,000 at completion",
    org: "Shanghai Spacecom Satellite Technology", date: "2024-08-06",
    url: "https://www.cnn.com/2024/08/09/china/china-satellite-qianfan-g60-starlink-intl-hnk",
  },
  {
    id: "seed-guowang-first-launch-2024",
    stage: "scaling", country: "CN", provenance: "seeded", source: "milestone",
    title: "A Long March 5B lofts the first 10 satellites of Guowang, China's state broadband megaconstellation, planned at more than 13,000 satellites",
    org: "China SatNet", date: "2024-12-16",
    url: "https://spacenews.com/china-kicks-off-guowang-megaconstellation-with-long-march-5b-launch/",
  },

  // ── Stage 03: adoption ──────────────────────────────────────────
  // For space, adoption is a government committing money, standing up an
  // institution, or writing a rule that lets somebody build. Contract
  // awards live here too, and the live USASpending feed supplies those —
  // these are the structural decisions underneath them.
  {
    id: "seed-us-space-force-2019",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "The FY2020 National Defense Authorization Act establishes the United States Space Force within the Department of the Air Force, the sixth armed service and the first new US military branch in more than 70 years",
    org: "United States Space Force", date: "2019-12-20",
    url: "https://www.af.mil/News/Article-Display/Article/2046061/with-the-stroke-of-a-pen-us-space-force-becomes-a-reality/",
    deploymentStatus: "operating",
  },
  {
    id: "seed-luxembourg-space-resources-2017",
    stage: "adoption", country: "LU", provenance: "seeded", source: "deployment",
    title: "Luxembourg's space resources law takes effect, passed 55 votes to 2, making it the first European country to guarantee private companies ownership of resources they extract in space, backed by a €200 million commitment to its SpaceResources.lu initiative",
    org: "Government of Luxembourg", date: "2017-08-01",
    url: "https://www.mining.com/luxembourg-becomes-first-european-country-pass-space-mining-law/",
    deploymentStatus: "operating",
  },
  {
    id: "seed-india-space-fdi-2024",
    stage: "adoption", country: "IN", provenance: "seeded", source: "deployment",
    title: "India's cabinet liberalises space-sector foreign investment on a three-tier split — 100% automatic for components and ground segment, 74% for satellite manufacturing and operation, 49% for launch vehicles and spaceports",
    org: "Government of India", date: "2024-02-21",
    url: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2007876",
    deploymentStatus: "operating",
  },
  {
    id: "seed-japan-space-strategy-fund-2024",
    stage: "adoption", country: "JP", provenance: "seeded", source: "deployment",
    title: "Japan begins soliciting against its ¥1 trillion, ten-year Space Strategy Fund, run by JAXA on behalf of three ministries across satellites, exploration and space transportation, against a government target of doubling the domestic space market to ¥8 trillion by the early 2030s",
    org: "JAXA", date: "2024-07",
    url: "https://spacenews.com/japan-creates-multibillion-dollar-space-strategic-fund-to-boost-space-industry/",
    deploymentStatus: "operating",
  },
  {
    id: "seed-eu-iris2-contract-2024",
    stage: "adoption", country: "BE", provenance: "seeded", source: "deployment",
    title: "The European Commission signs a €10.6 billion, 12-year concession with the SpaceRISE consortium of Eutelsat, SES and Hispasat to build IRIS², funded 60% public and 40% industry — a public-private structure new to European space at this scale",
    org: "European Commission", date: "2024-12-16",
    url: "https://www.esa.int/Applications/Connectivity_and_Secure_Communications/IRIS2_reinforced_and_accelerated_as_implementation_advances",
    countryEvidence: "European Commission, seated in Brussels — a supranational body gets the country it physically sits in, never a synthetic regional code",
    deploymentStatus: "procurement",
  },
  {
    id: "seed-artemis-accords-2026",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "The Artemis Accords reach 71 signatories with Turkey's accession — 32 in Europe, 17 in Asia, 8 in South America, 7 in Africa, 5 in North America and 2 in Oceania — making the US-drafted framework the largest bloc in space governance, with China and Russia outside it",
    org: "NASA / U.S. Department of State", date: "2026-08-31",
    url: "https://www.nasa.gov/artemis-accords/",
    deploymentStatus: "operating",
  },
];
