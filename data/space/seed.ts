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
// `country` conventions. The rule is: attribute to whatever the milestone
// is ABOUT, and say so in countryEvidence when the answer isn't obvious.
// Space breaks a simple "where did it physically happen" rule more than
// biotech did, because launch sites are routinely in a different country
// from whoever built the vehicle:
//   - A milestone about a VEHICLE goes to whoever built it. Isar
//     Aerospace's Spectrum is DE even though it flew from Andøya in
//     Norway — Norway did not build Spectrum, and "which countries can
//     build and fly a rocket" is the question a policy reader is asking.
//   - A milestone about a SITE goes to the site. Rocket Lab's first
//     orbital flight is logged to NZ because the milestone is the private
//     spaceport, and SaxaVord's licence is GB for the same reason.
//   - Where both coincide, no ambiguity: Ariane 6 is French-built and
//     flies from Kourou, which is France.
//   - A supranational body gets the country it physically sits in. The
//     European Commission is BE. Nothing is bucketed into an "EU" code.
//   - A state that no longer exists goes to its successor. Sputnik and
//     Vostok 1 are RU. This is forced as much as chosen — ISO 3166-1
//     retired SU, so countryName() hands back the bare string "SU", and
//     this app renders full country names rather than dead codes. The
//     pad being in Kazakhstan is noted in countryEvidence, not encoded.
//   - A MULTILATERAL instrument gets null, not a member state. The Outer
//     Space Treaty has three depositary governments and 100-plus parties;
//     naming one would misrepresent it. Note this is the opposite call
//     from the European Commission case above, and the distinction is
//     real — the Commission ACTS as a procurer with a seat, while a
//     treaty is an agreement AMONG states with no single author. null
//     here means "correctly not one country's," not "unknown."
//
// Failed attempts belong here. Two of the launch entries below are
// failures, stated as such — a seed set containing only successes would
// misrepresent how hard orbital launch actually is, and the first attempt
// is the real national milestone either way.
//
// A contested case, flagged rather than resolved quietly. ISS Zarya is
// logged to RU because Khrunichev built it in Moscow and a Russian Proton
// flew it, though the United States paid for it and owns it. Both readings
// are defensible; the vehicle-over-funder rule above is what decides it,
// and countryEvidence says so on the entry so a reader can disagree.

export const SEED: Entry[] = [
  // ── Stage 02: production / scaling ──────────────────────────────
  // ── Historical anchors ─────────────────────────────────────────
  // Added 2026-09-03. The set opened at 2015 and could not show a decade
  // of anything, let alone the six that matter here — see CLAUDE.md's
  // "Seed history" note on recency bias, which is the easiest gap to miss
  // because researching what is happening now feels like thoroughness.
  // These are the events every later entry is implicitly measured against.
  {
    id: "seed-sputnik1-1957",
    stage: "scaling", country: "RU", provenance: "seeded", source: "milestone",
    title: "The Soviet Union puts Sputnik 1 into orbit on an R-7, the first artificial satellite — 184 pounds carrying nothing but a radio transmitter, launched from the site now known as Baikonur Cosmodrome in Soviet Kazakhstan",
    org: "OKB-1", date: "1957-10-04",
    url: "https://www.nasa.gov/history/65-years-ago-sputnik-ushers-in-the-space-age/",
    countryEvidence: "Logged to Russia as the successor state to the Soviet Union, which built and flew the vehicle. ISO 3166-1 retired SU and this app renders full country names rather than dead codes, so RU is the only value that reads correctly; note the pad itself is in Kazakhstan",
  },
  {
    id: "seed-vostok1-1961",
    stage: "scaling", country: "RU", provenance: "seeded", source: "milestone",
    title: "Yuri Gagarin reaches orbit aboard Vostok 1, launched from Baikonur Site No. 1 at 06:07 UTC — the first human spaceflight, three and a half years after the first satellite",
    org: "OKB-1", date: "1961-04-12",
    url: "https://www.esa.int/About_Us/50_years_of_ESA/50_years_of_humans_in_space/The_flight_of_Vostok_1",
    countryEvidence: "Same successor-state reasoning as the Sputnik entry — Soviet-built vehicle, Soviet programme, logged to RU because SU no longer resolves to a country name",
  },
  {
    id: "seed-asterix-1965",
    stage: "scaling", country: "FR", provenance: "seeded", source: "milestone",
    title: "France orbits Astérix on a Diamant-A from Hammaguir, becoming in CNES's own words \"la 3e puissance spatiale, derrière l'URSS et les États-Unis\" — the first country other than those two to reach orbit on a rocket it built itself",
    org: "CNES", date: "1965-11-26",
    url: "https://cnes.fr/actualites/y-60-ans-lavenement-de-france-spatiale-diamant-asterix",
    countryEvidence: "Logged to France, which built Diamant-A and ran the programme, rather than Algeria, where the Hammaguir range sits — the same vehicle-over-pad rule Isar Aerospace's Spectrum gets below",
  },
  {
    id: "seed-apollo11-1969",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "Apollo 11 lands the Eagle on the Moon with Neil Armstrong and Buzz Aldrin aboard, four days after launching on 16 July, while Michael Collins stays in lunar orbit — the first crewed landing on another body, and still the reference point every lunar programme since is compared against",
    org: "NASA", date: "1969-07-20",
    url: "https://www.nasa.gov/mission/apollo-11/",
  },
  {
    id: "seed-ohsumi-1970",
    stage: "scaling", country: "JP", provenance: "seeded", source: "milestone",
    title: "Japan's first satellite reaches orbit as ISAS launches Ohsumi on an L-4S-5 from Kagoshima, 24 kg once the fourth motor had burned out — a university institute, not a national agency, putting a country into space",
    org: "Institute of Space and Aeronautical Science, University of Tokyo", date: "1970-02-11",
    url: "https://www.isas.jaxa.jp/en/missions/spacecraft/past/ohsumi.html",
  },
  {
    id: "seed-dongfanghong1-1970",
    stage: "scaling", country: "CN", provenance: "seeded", source: "milestone",
    title: "China orbits the 173 kg Dong Fang Hong 1 on a Long March 1, becoming the fifth nation to launch a satellite on its own rocket — ten weeks after Japan became the fourth",
    org: "China Academy of Space Technology", date: "1970-04-24",
    url: "https://www.satellitetoday.com/uncategorized/2010/03/11/sspi-timeline-1970-dong-fang-hong-1/",
  },
  {
    id: "seed-ariane1-l01-1979",
    stage: "scaling", country: "FR", provenance: "seeded", source: "milestone",
    title: "Ariane flight L01 lifts off from Kourou at 14:14 local time and, as ESA puts it, \"Europe's independent adventure in space had begun\" — the start of the launcher line that still carries European payloads today",
    org: "European Space Agency", date: "1979-12-24",
    url: "https://www.esa.int/About_Us/50_years_of_ESA/History_Ariane_L01_1979",
    countryEvidence: "Logged to France, the same attribution the Ariane 6 entry below gets — Kourou is French Guiana and ESA is seated in Paris, so both readings land on FR",
  },
  {
    id: "seed-rohini-rs1-1980",
    stage: "scaling", country: "IN", provenance: "seeded", source: "milestone",
    title: "ISRO places the 35 kg Rohini RS-1 in orbit on SLV-3 from Sriharikota, India's first satellite carried by an Indian vehicle and the capability every later ISRO programme is built on, Chandrayaan included",
    org: "ISRO", date: "1980-07-18",
    url: "https://www.isro.gov.in/RohiniSatellite_RS_1.html",
  },
  {
    id: "seed-sts1-1981",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "Columbia flies STS-1 with John Young and Robert Crippen aboard, completing 37 revolutions before landing on 14 April — the first orbital flight of the Space Shuttle programme, and the beginning of a thirty-year argument about whether reusability actually lowers cost",
    org: "NASA", date: "1981-04-12",
    url: "https://www.nasa.gov/mission/sts-1/",
  },
  {
    id: "seed-ofeq1-1988",
    stage: "scaling", country: "IL", provenance: "seeded", source: "milestone",
    title: "Israel launches Ofek 1 on a Shavit from Palmachim Air Base at 11:32, becoming the eighth country to put an object in orbit — footage of it stayed classified for thirty years",
    org: "Israel Aerospace Industries", date: "1988-09-19",
    url: "https://www.timesofisrael.com/30-years-later-israel-declassifies-footage-of-its-first-satellite-launch/",
  },
  {
    id: "seed-iss-zarya-1998",
    stage: "scaling", country: "RU", provenance: "seeded", source: "milestone",
    title: "Zarya launches on a Russian Proton from Baikonur as the first element of the International Space Station, supplying the battery power, fuel storage and docking capability the early assembly flights ran on",
    org: "Khrunichev State Research and Production Space Center", date: "1998-11-20",
    url: "https://issnationallab.org/iss360/celebrating-the-20th-anniversary-of-the-first-international-space-station-module/",
    countryEvidence: "A genuinely contested case, logged to Russia because Khrunichev built the module in Moscow and a Russian Proton flew it, even though the United States financed and owns it. Stated rather than smoothed over — this is the file's vehicle-over-funder rule doing real work rather than an obvious call",
  },

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
  {
    id: "seed-starship-booster-catch-2024",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "SpaceX catches a returning Super Heavy booster in the launch tower's arms on Starship's fifth flight, the first time a booster of that size has been recovered without landing legs or a pad, while the upper stage reached 212 km and splashed down on target in the Indian Ocean",
    org: "SpaceX", date: "2024-10-13",
    url: "https://www.space.com/spacex-starship-flight-5-launch-super-heavy-booster-catch-success-video",
  },
  {
    id: "seed-isar-spectrum-first-flight-2025",
    stage: "scaling", country: "DE", provenance: "seeded", source: "milestone",
    title: "Isar Aerospace flies Spectrum from Andøya, the first orbital launch attempt by a European commercial company from continental Europe — terminated about 30 seconds in after a vent valve opened unintentionally and the vehicle lost attitude control during its roll manoeuvre",
    org: "Isar Aerospace", date: "2025-03-30",
    url: "https://isaraerospace.com/press/isar-aerospace-lifts-off-successfully-during-first-test-flight-of-orbital-launch-vehicle",
    countryEvidence: "Logged to Germany, where Isar Aerospace built the vehicle, rather than Norway, where Andøya Spaceport sits — the milestone is a European company's launch capability, not the pad",
  },
  {
    id: "seed-gilmour-eris-2025",
    stage: "scaling", country: "AU", provenance: "seeded", source: "milestone",
    title: "Gilmour Space flies Eris from its own Bowen Orbital Spaceport in Queensland, the first orbital launch attempt by an Australian-built rocket and the first use of Australia's first commercial orbital launch site — the hybrid-propulsion vehicle lost thrust and crashed 14 seconds in",
    org: "Gilmour Space Technologies", date: "2025-07-29",
    url: "https://www.abc.net.au/news/2025-07-30/gilmour-space-technologies-launch-orbital-rocket-bowen/105470024",
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

  {
    id: "seed-iceye-production-2026",
    stage: "scaling", country: "FI", provenance: "seeded", source: "milestone",
    title: "ICEYE doubles radar-satellite production from 50 a year toward a target of 100 annually by 2028, with a matching launch cadence — a rate that used to describe a national programme rather than one company in Espoo",
    org: "ICEYE", date: "2026-06",
    url: "https://www.iceye.com/newsroom/press-releases/iceye-leads-a-new-era-of-sovereign-intelligence-from-space-with-1b-funding-round",
  },

  // ── Stage 03: adoption ──────────────────────────────────────────
  {
    id: "seed-outer-space-treaty-1967",
    stage: "adoption", country: null, provenance: "seeded", source: "milestone",
    title: "The Outer Space Treaty opens for signature simultaneously at Moscow, London and Washington, establishing that outer space \"is not subject to national appropriation by claim of sovereignty, by means of use or occupation, or by any other means\" and barring nuclear weapons and other weapons of mass destruction from orbit — the frame every national space law since has been written inside",
    org: "United Nations", date: "1967-01-27",
    url: "https://www.nasa.gov/history/SP-4225/documentation/cooperation/treaty.htm",
    countryEvidence: "Deliberately left unattributed. This is an agreement among states rather than an act by one, with three depositary governments in the United Kingdom, the Soviet Union and the United States, so naming any single country would misrepresent it. Different from the IRIS² entry below, where the European Commission is itself the actor",
  },
  {
    id: "seed-fcc-five-year-deorbit-2022",
    stage: "adoption", country: "US", provenance: "seeded", source: "milestone",
    title: "The FCC cuts the decades-old 25-year deorbit guideline to five years for satellites ending their mission in or passing through low Earth orbit below 2,000 km, calling it \"the first concrete rule on this topic, replacing a long-standing guideline\" — a recommended practice becoming a licence condition, with a two-year transition for operators",
    org: "Federal Communications Commission", date: "2022-09-29",
    url: "https://docs.fcc.gov/public/attachments/DOC-387720A1.pdf",
  },

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
    id: "seed-saxavord-licence-2023",
    stage: "adoption", country: "GB", provenance: "seeded", source: "deployment",
    title: "The UK Civil Aviation Authority licenses SaxaVord on Unst in Shetland for up to 30 launches a year, making it the UK's first licensed vertical-launch spaceport and the first fully licensed one in Western Europe, with a range licence for the sea and airspace to its north following in April 2024",
    org: "UK Civil Aviation Authority", date: "2023-12-17",
    url: "https://www.caa.co.uk/newsroom/news/saxavord-granted-spaceport-licence-by-uk-civil-aviation-authority/",
    // No deploymentStatus: none of the five real values honestly describes
    // "a regulator licensed a facility that hasn't launched yet".
    // "announced" understates a granted licence and "operating" overstates
    // it, since no orbital launch has flown from SaxaVord. Entry.
    // deploymentStatus's own rule is to omit rather than guess.
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

  // ── Stage 04: investment (private capital) ─────────────────────
  // Real disclosed private rounds, individually verified against the
  // announcement, same standard as data/quantum/seed.ts's. Excludes any
  // company in this vertical's `tickers` list — a public company's capital
  // story is the markets panel and the R&D chart, not a seeded entry. Added
  // 2026-09-03; the stage had no seeded entries at all before that, which
  // left the NSF grant data carrying it alone in a field where NSF is the
  // wrong instrument (see data/space/notes.ts's investment note).
  {
    id: "seed-sierraspace-seriesa-2021",
    stage: "investment", country: "US", provenance: "seeded", source: "funding-round",
    title: "Sierra Space raises a $1.4 billion Series A led by General Atlantic, Coatue and Moore Strategic Ventures at a $4.5 billion valuation, which the company calls the \"largest aerospace and defense capital raise globally in 2021\"",
    org: "Sierra Space", date: "2021-11-19",
    url: "https://www.sierraspace.com/press-releases/sierra-space-secures-record-1-4-billion-series-a-growth-investment-and-achieves-4-5-billion-valuation/",
    amountUsd: 1400000000,
  },
  {
    id: "seed-skyroot-seriesc-2026",
    stage: "investment", country: "IN", provenance: "seeded", source: "funding-round",
    title: "Skyroot Aerospace raises $60 million led by GIC and Sherpalo Ventures at a $1.1 billion valuation, India's first space-technology unicorn, taking it to $160 million raised since 2018 — with its Vikram-1 vehicle still unflown at the time of the round",
    org: "Skyroot Aerospace", date: "2026-05-07",
    url: "https://www.satellitetoday.com/finance/2026/05/07/skyroot-secures-60m-in-funding-becoming-indias-first-space-unicorn/",
    amountUsd: 60000000,
  },
  {
    id: "seed-iceye-seriesf-2026",
    stage: "investment", country: "FI", provenance: "seeded", source: "funding-round",
    title: "ICEYE raises a €450 million ($520 million) primary Series F led by General Atlantic at a valuation above €10 billion, past €1 billion once a secondary placement is counted, with Nokia, the Qatar Investment Authority, TCV, Solidium, Tesi, Varma, Ilmarinen and Lifeline Ventures participating — seven European governments had bought sovereign satellite systems from the company by then",
    org: "ICEYE", date: "2026-06-09",
    url: "https://www.iceye.com/newsroom/press-releases/iceye-leads-a-new-era-of-sovereign-intelligence-from-space-with-1b-funding-round",
    amountUsd: 520000000,
  },
];
