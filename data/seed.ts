import type { Entry } from "../src/lib/types.ts";

// Hand-curated entries for the pipeline stages that have no clean live feed.
// This is the honest layer: production/scaling milestones and adoption events
// are reported in press releases and roadmaps, not a queryable API. Add,
// remove, or correct entries here — each is one object. Keep `provenance`
// as "seeded" so the UI labels them correctly. `date` may be YYYY-MM.
//
// `country` is the real ISO 3166-1 alpha-2 code for where the org is based —
// every entry gets its actual country, never a regional bucket.
//
// Every entry below was fetched and confirmed against its source URL before
// being added (specific claim checked, not just "the domain resolves").
// Don't add an entry you haven't verified the same way — a wrong one here is
// presented as curated fact, not a live feed that can just be re-fetched.
//
// To add a new entry: copy a block, change the fields, give it a unique id.

export const SEED: Entry[] = [
  // ── Stage 02: production / scaling ──────────────────────────────
  {
    id: "seed-ibm-roadmap-2025",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "IBM outlines Kookaburra / Blue Jay path toward 100k+ physical qubits",
    org: "IBM Quantum", date: "2025-11",
    url: "https://www.ibm.com/quantum/roadmap",
  },
  {
    id: "seed-quantinuum-h2-2024",
    stage: "scaling", country: "GB", provenance: "seeded", source: "milestone",
    title: "Quantinuum H2 trapped-ion system passes 56 physical qubits at high fidelity",
    org: "Quantinuum", date: "2024-06",
    url: "https://www.quantinuum.com/",
  },
  {
    id: "seed-ibm-heron-2023",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "IBM debuts its 133-qubit Heron processor and Quantum System Two, its first modular quantum computer",
    org: "IBM Quantum", date: "2023-12",
    url: "https://newsroom.ibm.com/2023-12-04-IBM-Debuts-Next-Generation-Quantum-Processor-IBM-Quantum-System-Two,-Extends-Roadmap-to-Advance-Era-of-Quantum-Utility",
  },
  {
    id: "seed-atom-computing-1180-2023",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "Atom Computing unveils a 1,225-site neutral-atom array populated with 1,180 qubits, the first gate-based system to exceed 1,000 qubits",
    org: "Atom Computing", date: "2023-10",
    url: "https://www.forbes.com/sites/moorinsights/2023/10/24/atom-computing-announces-record-breaking-1225-qubit-quantum-computer/",
  },
  {
    id: "seed-harvard-quera-logical-2023",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "Harvard, QuEra, MIT and NIST/University of Maryland run error-corrected algorithms on 48 logical qubits using a 280-atom neutral-atom array",
    org: "Harvard / QuEra Computing", date: "2023-12",
    url: "https://www.quera.com/press-releases/harvard-quera-mit-and-the-nist-university-of-maryland-usher-in-new-era-of-quantum-computing-by-performing-complex-error-corrected-quantum-algorithms-on-48-logical-qubits0",
  },
  {
    id: "seed-google-willow-2024",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "Google's 105-qubit Willow chip demonstrates error correction below the surface-code threshold, with logical error rates falling as qubit count scales up",
    org: "Google Quantum AI", date: "2024-12",
    url: "https://blog.google/innovation-and-ai/technology/research/google-willow-quantum-chip/",
  },
  {
    id: "seed-microsoft-majorana1-2025",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "Microsoft unveils Majorana 1, its first quantum processor built with topological qubits, with 8 qubits on a chip designed to scale to one million",
    org: "Microsoft", date: "2025-02",
    url: "https://news.microsoft.com/source/features/innovation/microsofts-majorana-1-chip-carves-new-path-for-quantum-computing/",
  },
  {
    id: "seed-psiquantum-omega-2025",
    stage: "scaling", country: "US", provenance: "seeded", source: "milestone",
    title: "PsiQuantum unveils Omega, a photonic quantum computing chipset manufactured at a GlobalFoundries commercial semiconductor fab in New York",
    org: "PsiQuantum", date: "2025-02",
    url: "https://www.psiquantum.com/news-import/omega",
  },
  {
    id: "seed-ustc-jiuzhang3-2023",
    stage: "scaling", country: "CN", provenance: "seeded", source: "milestone",
    title: "USTC's Jiuzhang 3.0 photonic quantum computer detects 255 photons in a Gaussian boson sampling experiment, claiming an advantage over classical supercomputers",
    org: "USTC / Hefei", date: "2023-10",
    url: "http://english.www.gov.cn/news/202310/12/content_WS6527a0f0c6d0868f4e8e0292.html",
  },
  {
    id: "seed-origin-wukong-launch-2024",
    stage: "scaling", country: "CN", provenance: "seeded", source: "milestone",
    title: "Origin Quantum launches Wukong, China's first homegrown 72-qubit superconducting quantum computer, for public cloud access",
    org: "Origin Quantum / Hefei", date: "2024-01",
    url: "https://thequantuminsider.com/2024/01/06/reports-origin-quantum-computing-launches-72-qubit-quantum-computer/",
  },
  {
    id: "seed-anhui-production-line-2024",
    stage: "scaling", country: "CN", provenance: "seeded", source: "milestone",
    title: "China's Hefei-based superconducting quantum computer production line expands capacity to assemble 8 devices simultaneously, up from 5",
    org: "Anhui Quantum Computing Engineering Research Center", date: "2024-10",
    url: "https://thequantuminsider.com/2024/10/08/china-expands-quantum-computing-production-line-can-now-build-8-devices-at-once/",
  },
  {
    id: "seed-tianyan504-2024",
    stage: "scaling", country: "CN", provenance: "seeded", source: "milestone",
    title: "China Telecom, CAS and QuantumCTek unveil Tianyan-504, a quantum computer powered by the 504-qubit Xiaohong superconducting chip",
    org: "China Telecom Quantum Group", date: "2024-12",
    url: "https://thequantuminsider.com/2024/12/06/china-introduces-504-qubit-superconducting-chip/",
  },
  {
    id: "seed-ustc-zuchongzhi3-2025",
    stage: "scaling", country: "CN", provenance: "seeded", source: "milestone",
    title: "USTC's 105-qubit Zuchongzhi-3 processor claims a random circuit sampling speed roughly a quadrillion times faster than the fastest supercomputer",
    org: "USTC / Hefei", date: "2025-03",
    url: "https://english.cas.cn/head/202503/t20250305_903086.shtml",
  },
  {
    id: "seed-oqc-toshiko-2023",
    stage: "scaling", country: "GB", provenance: "seeded", source: "milestone",
    title: "Oxford Quantum Circuits launches Toshiko, a 32-qubit platform deployed directly inside a commercial data centre",
    org: "Oxford Quantum Circuits", date: "2023-11",
    url: "https://oqc.tech/company/newsroom/toshiko-the-worlds-first-enterprise-ready-quantum-platform/",
  },
  {
    id: "seed-iqm-radiance-2023",
    stage: "scaling", country: "FI", provenance: "seeded", source: "milestone",
    title: "IQM announces its Radiance roadmap, targeting a 150-qubit quantum computer for enterprise and HPC customers",
    org: "IQM Quantum Computers", date: "2023-11",
    url: "https://www.prnewswire.com/apac/news-releases/iqm-quantum-computers-launches-iqm-radiance--a-150-qubit-system-paving-the-way-to-quantum-advantage-301981384.html",
  },
  {
    id: "seed-pasqal-1000atoms-2024",
    stage: "scaling", country: "FR", provenance: "seeded", source: "milestone",
    title: "Pasqal loads more than 1,000 rubidium atoms in a single shot in its neutral-atom quantum processor",
    org: "Pasqal", date: "2024-06",
    url: "https://www.pasqal.com/newsroom/pasqal-exceeds-1000-atoms-in-quantum-processor/",
  },
  {
    id: "seed-vtt-iqm-50qubit-2025",
    stage: "scaling", country: "FI", provenance: "seeded", source: "milestone",
    title: "VTT and IQM launch Europe's first 50-qubit superconducting quantum computer at Micronova in Espoo, Finland",
    org: "VTT / IQM Quantum Computers", date: "2025-03",
    url: "https://www.vttresearch.com/en/news-and-ideas/vtt-and-iqm-launch-first-50-qubit-quantum-computer-developed-europe",
  },
  {
    id: "seed-aliceandbob-catqubit-2025",
    stage: "scaling", country: "FR", provenance: "seeded", source: "milestone",
    title: "Alice & Bob reports cat-qubit bit-flip lifetimes exceeding one hour, up from its prior 430-second record on the Boson 4 chip",
    org: "Alice & Bob", date: "2025-09",
    url: "https://alice-bob.com/newsroom/alice-bob-surpasses-bit-flip-stability-record/",
  },
  {
    id: "seed-fujitsu-riken-256qubit-2025",
    stage: "scaling", country: "JP", provenance: "seeded", source: "milestone",
    title: "Fujitsu and RIKEN unveil a 256-qubit superconducting quantum computer, quadrupling qubit density within the same dilution refrigerator as their 64-qubit predecessor",
    org: "Fujitsu / RIKEN", date: "2025-04",
    url: "https://www.riken.jp/en/news_pubs/news/2025/20250422_1/index.html",
  },
  {
    id: "seed-xanadu-aurora-2025",
    stage: "scaling", country: "CA", provenance: "seeded", source: "milestone",
    title: "Xanadu's Aurora photonic quantum computer networks 35 photonic chips across four server racks using 13 km of fiber optics at room temperature",
    org: "Xanadu", date: "2025-01",
    url: "https://thequantuminsider.com/2025/01/22/xanadu-announces-aurora-a-universal-photonic-quantum-computer/",
  },
  {
    id: "seed-dwave-advantage2-2024",
    stage: "scaling", country: "CA", provenance: "seeded", source: "milestone",
    title: "D-Wave completes calibration and benchmarking of its 4,400-plus-qubit Advantage2 annealing quantum processor",
    org: "D-Wave", date: "2024-11",
    url: "https://www.dwavequantum.com/company/newsroom/press-release/d-wave-achieves-significant-milestone-with-calibration-of-4-400-qubit-advantage2-processor/",
  },
  {
    id: "seed-qpiai-indus-2025",
    stage: "scaling", country: "IN", provenance: "seeded", source: "milestone",
    title: "QpiAI launches QpiAI-Indus, India's first full-stack 25-qubit superconducting quantum computer, under India's National Quantum Mission",
    org: "QpiAI", date: "2025-04",
    url: "https://thequantuminsider.com/2025/04/15/qpiai-launches-25-qubit-superconducting-system-under-indias-national-quantum-mission/",
  },
  {
    id: "seed-sqc-silicon-2025",
    stage: "scaling", country: "AU", provenance: "seeded", source: "milestone",
    title: "Silicon Quantum Computing publishes an 11-qubit silicon processor in Nature with two-qubit gate fidelities up to 99.99% that improve as qubit count scales",
    org: "Silicon Quantum Computing", date: "2025-12",
    url: "https://thequantuminsider.com/2025/12/17/sqc-study-shows-silicon-based-quantum-processor-can-scale-without-loss-of-fidelity/",
  },

  // ── Stage 03: adoption ──────────────────────────────────────────
  {
    id: "seed-aws-braket-2025",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "AWS Braket adds new hardware backends for on-demand access",
    org: "Amazon Web Services", date: "2025-09",
    url: "https://aws.amazon.com/braket/",
  },
  {
    id: "seed-ionq-afrl-2024",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "IonQ signs a $54.5 million contract with the Air Force Research Laboratory for quantum networking research, its largest 2024 US quantum award",
    org: "IonQ", date: "2024-09",
    url: "https://www.ionq.com/news/ionq-announces-largest-2024-u-s-quantum-contract-award-of-usd54-5m-with",
  },
  {
    id: "seed-quantinuum-darpa-stagea-2025",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "DARPA selects Quantinuum to advance to Stage A of its Quantum Benchmarking Initiative",
    org: "Quantinuum / DARPA", date: "2025-04",
    url: "https://www.quantinuum.com/press-releases/quantinuum-selected-by-darpa-to-advance-to-first-stage-of-quantum-benchmarking-initiative",
  },
  {
    id: "seed-nersc-ibm-cloud-2025",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "NERSC at Lawrence Berkeley National Laboratory opens cloud access to IBM quantum computers through a new Quantum Innovation Center",
    org: "NERSC / Lawrence Berkeley National Laboratory", date: "2025-01",
    url: "https://thequantuminsider.com/2025/01/24/nersc-opens-access-to-ibm-quantum-computers-through-quantum-innovation-center/",
  },
  {
    id: "seed-darpa-qbi-stageb-2025",
    stage: "adoption", country: "US", provenance: "seeded", source: "deployment",
    title: "DARPA advances 11 companies, including IBM, IonQ and Quantinuum, to Stage B of its Quantum Benchmarking Initiative",
    org: "DARPA", date: "2025-11",
    url: "https://www.darpa.mil/research/programs/quantum-benchmarking-initiative/stage-b-selection",
  },
  {
    id: "seed-quantumctek-504chip-2024",
    stage: "adoption", country: "CN", provenance: "seeded", source: "deployment",
    title: "Chinese Academy of Sciences researchers deliver a 504-qubit superconducting chip to QuantumCTek to build a cloud-accessible quantum computer with China Telecom",
    org: "QuantumCTek / CAS", date: "2024-04",
    url: "https://thequantuminsider.com/2024/04/27/chinese-researchers-develop-504-qubit-superconducting-qc-chip-build-partnership-for-cloud-access/",
  },
  {
    id: "seed-origin-20mvisits-2025",
    stage: "adoption", country: "CN", provenance: "seeded", source: "deployment",
    title: "Origin Quantum's Wukong computer surpasses 20 million cumulative remote visits from users in 139 countries since its January 2024 launch",
    org: "Origin Quantum / Hefei", date: "2025-02",
    url: "https://english.www.gov.cn/news/202502/16/content_WS67b1d60cc6d0868f4e8efaf2.html",
  },
  {
    id: "seed-tianyan-commercial-2025",
    stage: "adoption", country: "CN", provenance: "seeded", source: "deployment",
    title: "China Telecom Quantum Group and QuantumCTek put the Zuchongzhi superconducting quantum computer into commercial operation via the Tianyan cloud platform",
    org: "China Telecom Quantum Group", date: "2025-10",
    url: "https://thequantuminsider.com/2025/10/14/china-opens-its-superconducting-quantum-computer-for-commercial-use/",
  },
  {
    id: "seed-origin-wukong180-2026",
    stage: "adoption", country: "CN", provenance: "seeded", source: "deployment",
    title: "Origin Quantum unveils its fourth-generation Wukong-180 quantum computer, after its predecessor logged about 50 million cloud accesses from over 160 countries",
    org: "Origin Quantum / Hefei", date: "2026-05",
    url: "https://thequantuminsider.com/2026/05/15/origin-quantum-wukong-180/",
  },
  {
    id: "seed-pasqal-hpcqs-2023",
    stage: "adoption", country: "FR", provenance: "seeded", source: "deployment",
    title: "Pasqal delivers two 100+-qubit neutral-atom quantum computers to GENCI/CEA in France and FZJ in Germany under the EuroHPC-funded HPCQS project",
    org: "Pasqal", date: "2023-11",
    url: "https://www.pasqal.com/newsroom/genci-cea-fzj-and-pasqal-announce-significant-milestone-in-hybrid-computing/",
  },
  {
    id: "seed-iqm-munich-datacentre-2024",
    stage: "adoption", country: "DE", provenance: "seeded", source: "deployment",
    title: "IQM opens its first quantum data centre in Munich, Germany, with plans to host up to 12 quantum computers for industry customers",
    org: "IQM Quantum Computers", date: "2024-06",
    url: "https://iqm.tech/press-releases/iqm-quantum-computers-opens-quantum-data-centre-in-germany-to-support-industry-applications/",
  },
  {
    id: "seed-eurohpc-euroqexa-2024",
    stage: "adoption", country: "DE", provenance: "seeded", source: "deployment",
    title: "EuroHPC JU and IQM sign a procurement contract for the Euro-Q-Exa superconducting quantum computer to be hosted in Germany",
    org: "EuroHPC JU", date: "2024-10",
    url: "https://www.eurohpc-ju.europa.eu/signature-procurement-contract-eurohpc-quantum-computer-located-germany-2024-10-15_en",
  },
  {
    id: "seed-eurohpc-marenostrum-2025",
    stage: "adoption", country: "ES", provenance: "seeded", source: "deployment",
    title: "EuroHPC JU and Qilimanjaro Quantum Tech sign a procurement contract for the MareNostrum Ona quantum annealer to be hosted in Spain",
    org: "EuroHPC JU", date: "2025-01",
    url: "https://www.eurohpc-ju.europa.eu/signature-procurement-contract-eurohpc-quantum-computer-located-spain-2025-01-28_en",
  },
  {
    id: "seed-nqcc-testbeds-2025",
    stage: "adoption", country: "GB", provenance: "seeded", source: "deployment",
    title: "UK's National Quantum Computing Centre awards contracts to seven companies to deliver quantum computing testbeds under a £30 million programme",
    org: "National Quantum Computing Centre (UK)", date: "2025-02",
    url: "https://www.nqcc.ac.uk/updates/science-minister-andrew-griffith-announces-the-results-of-the-30m-quantum-computing-testbed-competition/",
  },
  {
    id: "seed-psiquantum-australia-2024",
    stage: "adoption", country: "AU", provenance: "seeded", source: "deployment",
    title: "Australian and Queensland governments commit $940 million AUD to PsiQuantum to build a utility-scale fault-tolerant quantum computer near Brisbane",
    org: "PsiQuantum", date: "2024-04",
    url: "https://www.psiquantum.com/news-import/psiquantum-to-build-worlds-first-utility-scale-fault-tolerant-quantum-computer-in-australia",
  },
  {
    id: "seed-fujitsu-aist-order-2024",
    stage: "adoption", country: "JP", provenance: "seeded", source: "deployment",
    title: "Fujitsu receives an order for a gate-based superconducting quantum computer from Japan's National Institute of Advanced Industrial Science and Technology",
    org: "Fujitsu", date: "2024-05",
    url: "https://info.archives.global.fujitsu/global/about/resources/news/press-releases/2024/0618-01.html",
  },
  {
    id: "seed-yonsei-ibm-korea-2024",
    stage: "adoption", country: "KR", provenance: "seeded", source: "deployment",
    title: "Yonsei University deploys the first IBM Quantum System One in South Korea, only the second such system on a university campus worldwide",
    org: "Yonsei University", date: "2024-11",
    url: "https://newsroom.ibm.com/2024-11-19-yonsei-deploys-first-ibm-quantum-system-one-in-the-republic-of-korea",
  },
  {
    id: "seed-ibm-riken-kobe-2025",
    stage: "adoption", country: "JP", provenance: "seeded", source: "deployment",
    title: "IBM and RIKEN unveil the first IBM Quantum System Two deployed outside the United States, co-located with the Fugaku supercomputer in Kobe, Japan",
    org: "IBM / RIKEN", date: "2025-06",
    url: "https://newsroom.ibm.com/2025-06-23-ibm-and-riken-unveil-first-ibm-quantum-system-two-outside-of-the-u-s",
  },
  {
    id: "seed-xanadu-canada-2025",
    stage: "adoption", country: "CA", provenance: "seeded", source: "deployment",
    title: "Xanadu is selected for Canada's Quantum Champions Program and will receive up to CAD $23 million in federal funding",
    org: "Xanadu", date: "2025-12",
    url: "https://thequantuminsider.com/2025/12/15/xanadu-23m-quantum-champions-canada/",
  },
];
