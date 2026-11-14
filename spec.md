# Project Specification: BIOGREEN Sustainability Assessment Platform & Desktop App

## 1. Objective & Context
Build the official software implementation for the **BIOGREEN** quantitative green chemistry metric introduced in the attached manuscript (`Paper_Review_Reestruturado_v1.pdf`). 

The system must satisfy three core deliverables:
1. **Interactive Web Application:** Built with **Astro + React + TypeScript + Tailwind CSS**, deployable statically (`output: 'static'`) on **Vercel** at zero cost.
2. **Cross-Platform Desktop Executables (`.exe` & `.dmg`):** Packaged from the exact same frontend codebase using **Tauri v2**, with a GitHub Actions CI/CD workflow to compile Windows and macOS binaries automatically on git tags.
3. **Standalone Python Reference Engine (`python/biogreen_engine.py`):** A clean, self-contained, zero-dependency (standard library only) Python script with unit tests (`test_biogreen.py`) to be included in the manuscript's Supporting Information.

---

## 2. UI/UX Design Direction (Modern Scientific Precision)
Avoid the dated "academic Tkinter/Windows 95" look of legacy tools like AGREE. Design an interface inspired by modern scientific software (Linear / Vercel / AI4Green):
- **Color Palette & Typography:** Crisp neutral slate/off-white background (`#F8FAFC`), pure white elevated cards (`#FFFFFF`) with subtle `1px solid #E2E8F0` borders, deep slate typography (`#0F172A`), tabular numbers (`font-variant-numeric: tabular-nums`) for all scores and weights, and semantic traffic-light colors reserved strictly for the BIOGREEN pictogram and status badges.
- **Split-Screen Workspace Layout:**
  - **Top Header:** Project title ("BIOGREEN — Circular Bioeconomy Material Metric"), Preset Loader dropdown (pre-populated with benchmark studies from the paper so reviewers can test immediately), "Reset", and "Download Desktop App (Windows / macOS)" link.
  - **Left Column (60% width): Route Input Workspace:**
    - Top segmented control switching between **Route A: Proposed Synthesis ($S_{\text{proposed}}$)** and **Route B: Baseline Reference ($S_{\text{baseline}}$)**, plus a utility button `"Copy Proposed → Baseline"` to speed up comparative entry.
    - Accordion/grouped cards organized into the 3 Axes (**Axis A: Feedstock & WEF Nexus**, **Axis B: Reaction & Process**, **Axis C: Material Performance & End-of-Life**).
  - **Right Column (40% width, Sticky): Live Results & Pictogram Panel:**
    - Real-time SVG **12-Petal BIOGREEN Radar Pictogram** that updates instantaneously on every input change.
    - Prominent KPI readout showing $S_{\text{proposed}}$, $S_{\text{baseline}}$, and the comparative net delta $\Delta S = S_{\text{proposed}} - S_{\text{baseline}}$ with clear visual indicator (e.g., green badge for $\Delta S > 0$).
    - **Export Toolbar:**
      - `Export SVG` (clean vector graphic for journal figures)
      - `Export 300-DPI PNG` (renders SVG to high-res canvas)
      - `Export PDF / Printable Report` (clean multi-criterion breakdown table with justifications)
      - `Export / Import JSON` (allows researchers to save/load evaluations)

---

## 3. Exact Mathematical & Domain Rules (From Manuscript Section 3.3)

### 3.1 Scoring Scale, Weights, and Special Flags
- Each criterion $i \in \{1, \dots, 12\}$ evaluates on a continuous scale $S_i \in [-1.00, +1.00]$.
- Each criterion has a fixed pillar weight $W_i \in \{1.0, 2.0, 3.0\}$:
  - Environmental pillar: $W_i = 3.0$
  - Social pillar: $W_i = 2.0$
  - Economic pillar: $W_i = 1.0$
- Every criterion input card MUST provide a 3-state mode toggle:
  1. **`VALID` (Measured / Applicable):** Uses the selected/calculated score $S_i \in [-1.00, +1.00]$ and full weight $W_i$.
  2. **`N/A` (Not Applicable):** Sets $W_i = 0$ and excludes criterion $i$ from both numerator and denominator.
  3. **`A-NC` (Applies, but Cannot be Calculated / Unreported):** Forces $S_i = -0.25$ and retains the full weight $W_i$ to penalize unreported data.
- **Global Score Formula:**
  $$S_{\text{global}} = \frac{\sum_{i \in V} (S_i \cdot W_i)}{\sum_{i \in V} W_i}$$
  where $V$ is the set of non-$N/A$ criteria. Guard against division by zero if all 12 criteria are set to $N/A$ (return `0.00` with a warning banner).
- **Comparative Delta Formula:**
  $$\Delta S = S_{\text{proposed}} - S_{\text{baseline}}$$

### 3.2 Complete 12-Criterion Rubric & Input Specifications
For all discrete categorical criteria, render radio cards/select options with the exact manuscript anchor labels AND provide an optional `"Custom / Intermediate Score"` slider (`-1.00` to `+1.00`, step `0.05`) + optional `"Justification / Reference Note"` input field for edge cases.

#### Axis A: Feedstock Sourcing & WEF Nexus (Criteria 1–3)
- **Criterion 1: Feedstock origin and land-use conflict ($W_1 = 3.0$)**
  - `+1.00`: Real agricultural, forestry, or industrial waste/passives.
  - `+0.75`: Non-terrestrial (algae) or invasive/exotic species.
  - `+0.25`: Smallholder polyculture/sustainable farming.
  - `-0.75`: Intensive monoculture biomass.
  - `-1.00`: Dedicated food crops or destructive wild harvesting.
- **Criterion 2: Water footprint and transport logistics ($W_2 = 2.0$)** — *Dual quantitative input*:
  - **Transport distance $d$ (km, numeric $\ge 0$):**
    - If $d \le 0$: clamp $S_{\text{trans}} = +1.00$.
    - Otherwise: $S_{\text{trans}} = \text{clamp}(-0.246 \cdot \ln(d) + 1.42,\ -1.00,\ +1.00)$.
  - **Water footprint ($\text{L kg}^{-1}$, numeric or tier selector):**
    - $< 10\text{ L kg}^{-1} \rightarrow +1.00$
    - $10\text{–}100\text{ L kg}^{-1} \rightarrow +0.50$
    - $101\text{–}1000\text{ L kg}^{-1} \rightarrow 0.00$ *(explicitly provide intermediate tier between 100 and 1000)*
    - $> 1000\text{ L kg}^{-1} \rightarrow -1.00$
  - **Combined Score:** $S_2 = \frac{S_{\text{trans}} + S_{\text{water}}}{2}$ (display live sub-scores $S_{\text{trans}}$ and $S_{\text{water}}$ in the UI card).
- **Criterion 3: Biomass pretreatment burden ($W_3 = 3.0$)**
  - `+1.00`: Zero pretreatment required.
  - `+0.75`: Physical/mechanical methods only (milling, solar drying).
  - `+0.50`: Biological/enzymatic or mild green chemical treatment.
  - `0.00`: Moderate chemical treatment.
  - `-0.75`: Concentrated strong acids/bases.
  - `-1.00`: High-temperature calcination or energy-intensive oven drying (> 12 h).

#### Axis B: Reaction, Preparation & Transformation (Criteria 4–7)
- **Criterion 4: Solvent selection and reaction media ($W_4 = 3.0$)**
  - `+1.00`: Solvent-free or water-only media.
  - `+0.50`: Recommended green solvents (ethanol, glycerol, bio-DES, DMC).
  - `0.00`: Problematic solvents (acetone, THF, toluene).
  - `-1.00`: Hazardous/restricted solvents (DMF, DMAC, NMP, CHCl₃, DCM).
- **Criterion 5: Energy efficiency and grid origin ($W_5 = 3.0$)**
  - `+1.00`: Ambient temperature (25 °C) or direct solar thermal/photovoltaic energy.
  - `+0.50`: Intensified methods (microwaves, mechanochemistry, ultrasound) powered by 100% renewable grid.
  - `0.00`: Mild heating ($\le 120^\circ\text{C}$) using high-consumption equipment.
  - `-1.00`: High-temperature pyrolysis/activation ($> 400^\circ\text{C}$ for > 4 h) on fossil-heavy grid.
- **Criterion 6: Auxiliaries, catalysts and reagents ($W_6 = 2.0$)**
  - `+1.00`: Biocatalysts or recyclable bio-derived heterogeneous catalysts and reagents.
  - `+0.50`: Low-toxicity recyclable synthetic heterogeneous catalysts and reagents.
  - `-0.50`: Unrecoverable homogeneous catalysts and reagents.
  - `-1.00`: Toxic heavy metals, corrosive activators (KOH, ZnCl₂), or excessive stoichiometric reagents without recovery.
- **Criterion 7: Process scalability and mode of operation ($W_7 = 1.0$)**
  - `+1.00`: Continuous-flow, automated, highly reproducible process.
  - `+0.50`: Semi-continuous flow.
  - `0.00`: Fast batch process with short reaction times.
  - `-1.00`: Slow, non-reproducible multi-step batch process.

#### Axis C: Material Performance, Stability & Passives (Criteria 8–12)
- **Criterion 8: Mass efficiency metrics (E-Factor) ($W_8 = 3.0$)** — *Numeric input or mass calculator*:
  - Allow user to enter **E-Factor** directly OR toggle a helper to enter `Total Waste Mass (kg)` and `Final Product Mass (kg)` ($\text{E-factor} = \text{Waste} / \text{Product}$):
    - $\text{E-factor} \le 1.0 \rightarrow +1.00$
    - $1.1 \le \text{E-factor} \le 5.0 \rightarrow +0.50$
    - $5.1 \le \text{E-factor} \le 25.0 \rightarrow 0.00$
    - $\text{E-factor} > 25.0 \rightarrow -1.00$
- **Criterion 9: Application stability and leaching liabilities ($W_9 = 3.0$)**
  - `+1.00`: Stable performance over $\ge 5$ reuse cycles with zero detectable contaminant leaching.
  - `0.00`: Slight performance drop ($\le 10\%$) or vestigial leaching ($\le 5\%$).
  - `-1.00`: Structural breakdown, severe leaching (metal ions, organic carbon), or regeneration requiring concentrated acid/base washing.
- **Criterion 10: Material safety and ecotoxicity ($W_{10} = 2.0$)**
  - `+1.00`: Non-toxic, non-flammable, bio-compatible, non-bioaccumulative.
  - `0.00`: Mild controllable handling hazards.
  - `-1.00`: High aquatic/terrestrial ecotoxicity, carcinogenic, or mutagenic risks.
- **Criterion 11: Design for degradation and end-of-life ($W_{11} = 3.0$)**
  - `+1.00`: Fully biodegradable in natural soil/water or 100% closed-loop monomer chemical recycling.
  - `0.00`: Partially degradable.
  - `-1.00`: Recalcitrant, microplastic-generating, or toxic residue persistent in nature.
- **Criterion 12: Effluent management and biorefinery integration ($W_{12} = 1.0$)**
  - `+1.00`: Fully integrated zero-waste biorefinery (effluents serve as feedstocks for secondary cycles).
  - `+0.50`: Readily biodegradable effluents treated via standard municipal systems.
  - `0.00`: Effluents requiring complex advanced oxidation.
  - `-1.00`: Untreated hazardous effluent discharge.

---

## 4. SVG 12-Petal Radar Pictogram Specification (Section 3.3.4)
Build a bespoke, pure SVG component (`BiogreenPictogram.tsx`)—do not use generic chart libraries that distort radial sectors:
- **Geometry:**
  - 12 radial donut sectors arranged clockwise starting from top-center (12 o'clock), numbered `1` through `12` outside the perimeter.
  - **Angular Width:** Proportional to weight $W_i$ (e.g., $W_i=3.0$ sectors are wider than $W_i=2.0$ and $W_i=1.0$ sectors; if $N/A$, render with nominal fixed angular width in translucent gray so the 12-sector ring structure stays intact).
  - Outer subtle grouping arcs indicating **Axis A (1–3)**, **Axis B (4–7)**, and **Axis C (8–12)**.
- **Color Traffic-Light Mapping:**
  - `+0.50` to `+1.00`: Smooth interpolation from Light Green (`#4ADE80`) to Dark Emerald Green (`#15803D`)
  - `0.00` to `+0.49`: Smooth interpolation from Amber/Orange (`#F59E0B`) to Yellow-Green (`#A3E635`)
  - `-1.00` to `-0.01`: Smooth interpolation from Crimson Red (`#B91C1C`) to Coral Red (`#F87171`)
  - `N/A`: Translucent Light Gray (`#E2E8F0` with dashed stroke)
  - `A-NC`: Solid Dark Slate Gray (`#475569`)
- **Central Hub:**
  - Colored dynamically according to $S_{\text{proposed}}$ using the exact same color scale.
  - Displays $S_{\text{proposed}}$ in large bold typography (2 decimal places, e.g., `+0.54`), and directly beneath it displays $\Delta S$ (e.g., `ΔS = +0.82`).
  - Hovering over any sector displays a clean tooltip with the criterion title, weight, status, and exact score.

---

## 5. Folder Structure & Deliverables to Generate
Generate the complete project scaffold cleanly:
```text
biogreen-platform/
├── astro.config.mjs              # Static output + @astrojs/react + @astrojs/tailwind
├── package.json
├── src/
│   ├── types/biogreen.ts         # Strict TypeScript interfaces for Criteria, Routes, Presets
│   ├── data/criteriaConfig.ts    # Exact 12 criteria definitions, weights, anchor options, and 2 built-in presets
│   ├── utils/calculator.ts       # Pure math functions (S_trans, E-factor bucket, S_global, deltaS)
│   ├── utils/exporters.ts        # SVG download, 300-DPI PNG canvas rasterizer, JSON export/import
│   ├── components/
│   │   ├── BiogreenApp.tsx       # Main split-screen workspace state manager
│   │   ├── CriterionCard.tsx     # Interactive card with VALID / N/A / A-NC toggle & custom slider
│   │   ├── BiogreenPictogram.tsx # Custom weighted 12-sector SVG radar chart
│   │   └── ComparisonTable.tsx   # Side-by-side breakdown of Proposed vs Baseline per criterion
│   └── pages/
│       └── index.astro           # SEO-ready landing + embedded interactive calculator
├── src-tauri/                    # Tauri v2 desktop wrapper config pointing to ../dist
│   └── tauri.conf.json
├── .github/
│   └── workflows/
│       └── release.yml           # Matrix build for windows-latest (.exe) & macos-latest (.dmg)
└── python/
    ├── biogreen_engine.py        # Self-contained Python 3 reference implementation for paper SI
    └── test_biogreen.py          # Pytest/unittest suite validating N/A, A-NC, and delta edge cases
```

Please implement all files completely without placeholders or `TODO` comments. Ensure `npm run build` compiles cleanly for Vercel static hosting and `python python/test_biogreen.py` passes 100%.