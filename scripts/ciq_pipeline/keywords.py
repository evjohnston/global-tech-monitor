"""Per-field keyword dictionaries and semantic seed phrases for the CapIQ
Transactions classification pipeline (pipeline.py).

STRONG terms below are extracted verbatim from each export's own real
"Screening Criteria" sheet (the Deal Summary / Business Description
keyword search each of the 10 ciq_data/*.xlsx files was actually built
from) — confirmed by hand, 2026-07-25, not retyped from memory. These are
real, already-vetted search terms, not a guess.

CONTEXTUAL, KILL, and *_SEEDS are NOT extracted from anything — the
exports only carry a flat OR list, no tiering and no semantic seeds — so
these are my own reasoned additions, same spirit as the original QUANTUM
example. Review and adjust them; they're a reasonable first pass, not
ground truth the way STRONG is.

Each field needs:
  1. A tiered keyword dict: {"strong": [...], "contextual": [...], "kill": [...]}
     - strong: one hit alone means "likely", two or more means "strong".
       Matched as whole words/phrases (word-boundary regex), case-insensitive.
     - contextual: terms too generic to mean anything alone — only counted
       as evidence when at least one strong term also matched.
     - kill: terms that force "drop" unconditionally, even over a strong
       match — mainly guards against a company NAME collision (e.g. a
       real-estate fund literally named "Quantum Realty") rather than the
       technology itself.
  2. A short list of seed phrases describing the real technology in plain
     language, for semantic (embedding) similarity scoring.
"""

# Generic company-name collision risk, real across every field (a fund or
# holding company whose NAME happens to contain a field's term) — same
# base list the original QUANTUM example used, reused everywhere rather
# than retyped per field.
_BASE_KILL = [
    "immobilien", "realty", "real estate", "apartment", "residential", "rental",
    "lifecycle partners", "mining pool",
]

QUANTUM = {
    "strong": [
        "trapped ion", "ion trap", "neutral atom", "quantum computing", "quantum computer",
        "quantum processor", "quantum annealing", "quantum error correction", "quantum sensing",
        "quantum sensor", "quantum key distribution", "post-quantum", "quantum communication",
        "quantum network", "quantum simulation", "qubit", "qkd",
    ],
    "contextual": [
        "photonic", "photonics", "single photon", "quantum dot", "superconducting",
        "cryogenic", "dilution refrigerator",
    ],
    "kill": [*_BASE_KILL],
}
QUANTUM_SEEDS = [
    "a company building quantum computing hardware such as superconducting, trapped-ion, "
    "photonic, or neutral-atom quantum processors",
    "a company developing quantum computing software, algorithms, or error-correction",
    "a company building quantum sensing, quantum communication, or quantum key distribution systems",
    "a company developing post-quantum cryptography to defend against future quantum computers",
]

AI = {
    "strong": [
        "large language model", "foundation model", "generative ai", "computer vision",
        "natural language processing", "reinforcement learning", "neural network", "deep learning",
        "inference engine", "training cluster", "autonomous agent", "speech recognition",
        "diffusion model", "multimodal model",
    ],
    "contextual": [
        "artificial intelligence", "machine learning", "transformer model", "chatbot",
        "gpu cluster", "model fine-tuning", "prompt engineering", "vector database",
    ],
    "kill": [*_BASE_KILL, "ai (ticker)"],
}
AI_SEEDS = [
    "a company building large language models or generative AI foundation models",
    "a company providing AI infrastructure such as training clusters or inference hardware",
    "a company applying computer vision, NLP, or reinforcement learning to a real product",
    "a company building autonomous AI agents or AI-native application software",
]

BIOTECH = {
    "strong": [
        "synthetic biology", "gene editing", "genome engineering", "cell therapy", "gene therapy",
        "mrna", "monoclonal antibody", "directed evolution", "metabolic engineering",
        "dna synthesis", "protein engineering", "engineered cells", "molecular biology",
        "crispr", "bioreactor", "biomanufacturing",
    ],
    "contextual": [
        "biotechnology", "genomics", "recombinant protein", "cell line", "vector design",
        "fermentation", "biologics",
    ],
    "kill": [*_BASE_KILL, "agricultural land", "farmland"],
}
BIOTECH_SEEDS = [
    "a company doing synthetic biology, genetic engineering, or gene/cell therapy",
    "a company manufacturing biologics, engineered proteins, or engineered cell lines",
    "a company developing CRISPR-based or other genome-editing technology",
]

CRYPTOGRAPHY = {
    "strong": [
        "post-quantum cryptography", "homomorphic encryption", "zero-knowledge proof",
        "zero knowledge", "end-to-end encryption", "public key infrastructure",
        "secure multiparty computation", "lattice-based", "encryption algorithm",
        "key management", "digital signature", "confidential computing", "cryptography",
        "cryptographic",
    ],
    "contextual": [
        "encryption", "data security", "secure enclave", "trusted execution environment",
        "identity verification",
    ],
    # cryptocurrency/crypto-trading is the real, likely false-positive risk
    # for this field specifically — "crypto" alone is not in the strong
    # list, but these guard against a strong term appearing incidentally
    # in a crypto-exchange company's boilerplate security-marketing copy.
    "kill": [*_BASE_KILL, "cryptocurrency exchange", "bitcoin mining", "crypto trading", "digital asset exchange", "nft marketplace"],
}
CRYPTOGRAPHY_SEEDS = [
    "a company building encryption technology such as homomorphic encryption or zero-knowledge proofs",
    "a company developing post-quantum cryptography or lattice-based cryptographic algorithms",
    "a company providing key management, digital signature, or confidential computing infrastructure",
]

ENERGY = {
    "strong": [
        "grid-scale battery", "solid-state battery", "lithium-ion", "green hydrogen", "fuel cell",
        "small modular reactor", "nuclear fusion", "fusion energy", "carbon capture", "geothermal",
        "grid interconnection", "electrolyzer", "photovoltaic",
    ],
    "contextual": [
        "battery storage", "renewable energy", "clean energy", "hydrogen production",
        "energy storage", "grid modernization",
    ],
    "kill": [*_BASE_KILL, "gas station", "fuel retailer", "home heating oil"],
}
ENERGY_SEEDS = [
    "a company building next-generation battery storage or grid-scale energy storage",
    "a company developing nuclear fusion, small modular reactors, or advanced nuclear power",
    "a company producing green hydrogen, fuel cells, or carbon capture technology",
]

MATERIALS = {
    "strong": [
        "advanced materials", "nanomaterial", "carbon nanotube", "metamaterial",
        "composite material", "additive manufacturing", "2d material", "solid-state electrolyte",
        "rare earth", "high-entropy alloy", "thin film", "materials science", "novel material",
        "graphene", "perovskite",
    ],
    "contextual": [
        "nanotechnology", "coating technology", "polymer science", "material properties",
        "3d printing",
    ],
    "kill": [*_BASE_KILL, "raw materials trading", "commodity trading", "building materials retailer"],
}
MATERIALS_SEEDS = [
    "a company developing advanced or novel materials such as graphene, nanomaterials, or metamaterials",
    "a company doing additive manufacturing or advanced materials-science R&D",
    "a company developing next-generation battery materials like solid-state electrolytes",
]

NEUROSCIENCE = {
    "strong": [
        "brain-computer interface", "brain computer interface", "neural interface",
        "neural implant", "deep brain stimulation", "neural prosthetic", "neuroscience",
        "neurotechnology", "neuroimaging", "neurostimulation", "electroencephalography", "eeg",
        "neuromodulation", "connectome", "optogenetics",
    ],
    "contextual": [
        "neurology", "cognitive science", "brain mapping", "neural signal", "implantable device",
    ],
    "kill": [*_BASE_KILL],
}
NEUROSCIENCE_SEEDS = [
    "a company building brain-computer interfaces or implantable neural devices",
    "a company developing neurostimulation, neuromodulation, or deep brain stimulation technology",
    "a company doing neuroimaging or neuroscience research and diagnostics",
]

ROBOTICS = {
    "strong": [
        "autonomous robot", "industrial robot", "humanoid robot", "robotic arm",
        "collaborative robot", "autonomous mobile robot", "robotic automation",
        "warehouse automation", "surgical robot", "legged locomotion", "robot manipulation",
        "cobot", "manipulation", "teleoperation",
    ],
    "contextual": [
        "robotics", "automation hardware", "actuator", "motion control", "grasping",
    ],
    # "manipulation" alone (a bare strong term from the real query) risks
    # matching "market manipulation" / financial-fraud language — kill
    # guards specifically against that collision.
    "kill": [*_BASE_KILL, "market manipulation", "stock manipulation", "price manipulation"],
}
ROBOTICS_SEEDS = [
    "a company building autonomous or industrial robots, robotic arms, or humanoid robots",
    "a company developing warehouse automation or robotic process automation hardware",
    "a company building surgical robots or robots with legged locomotion and manipulation",
]

SEMICONDUCTORS = {
    "strong": [
        "semiconductors", "chip design", "integrated circuit", "wafer fabrication",
        "advanced packaging", "gallium nitride", "silicon carbide", "system-on-chip", "chiplet",
        "fabless", "compound semiconductor",
    ],
    "contextual": [
        "semiconductor", "foundry", "lithography", "chip manufacturing", "eda tools",
        "power electronics",
    ],
    "kill": [*_BASE_KILL, "semiconductor etf", "chip stock index"],
}
SEMICONDUCTORS_SEEDS = [
    "a company designing or fabricating semiconductor chips, including fabless chip design",
    "a company doing advanced chip packaging, wafer fabrication, or compound semiconductor R&D",
    "a company developing system-on-chip or chiplet-based semiconductor products",
]

SPACE = {
    "strong": [
        "space launch", "small satellite", "launch vehicle", "in-orbit", "earth observation",
        "space station", "reusable rocket", "propulsion system", "space situational awareness",
        "orbital", "constellation", "satellite", "smallsat", "cubesat", "spacecraft",
    ],
    "contextual": [
        "aerospace", "rocket", "orbit", "space industry", "satellite constellation",
        "in-space manufacturing",
    ],
    # "satellite" alone is a real, common non-space false-positive risk
    # (satellite TV, satellite office, satellite radio, satellite campus).
    "kill": [*_BASE_KILL, "satellite tv", "satellite radio", "satellite office", "satellite campus"],
}
SPACE_SEEDS = [
    "a company building rockets, launch vehicles, or reusable space launch systems",
    "a company building small satellites, satellite constellations, or earth observation systems",
    "a company developing in-orbit servicing, space station modules, or spacecraft propulsion",
]

# Field name -> (keyword dict, seed phrases). pipeline.py looks up both by
# the field key it's given on the command line.
KEYWORDS_BY_FIELD = {
    "quantum": QUANTUM,
    "ai": AI,
    "biotech": BIOTECH,
    "cryptography": CRYPTOGRAPHY,
    "energy": ENERGY,
    "materials": MATERIALS,
    "neuroscience": NEUROSCIENCE,
    "robotics": ROBOTICS,
    "semiconductors": SEMICONDUCTORS,
    "space": SPACE,
}
SEEDS_BY_FIELD = {
    "quantum": QUANTUM_SEEDS,
    "ai": AI_SEEDS,
    "biotech": BIOTECH_SEEDS,
    "cryptography": CRYPTOGRAPHY_SEEDS,
    "energy": ENERGY_SEEDS,
    "materials": MATERIALS_SEEDS,
    "neuroscience": NEUROSCIENCE_SEEDS,
    "robotics": ROBOTICS_SEEDS,
    "semiconductors": SEMICONDUCTORS_SEEDS,
    "space": SPACE_SEEDS,
}
