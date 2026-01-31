# Molecular Biology Tools

Design and simulate DNA manipulation: PCR, primers, restriction digests, and assembly.

## When to Use

Use molecular biology tools when:
1. Designing primers for PCR
2. Planning restriction digests
3. Simulating Gibson or Golden Gate assembly
4. Planning cloning workflows
5. Predicting gel electrophoresis patterns

## Decision Tree

```
What molecular biology task?
│
├─ Need to amplify DNA?
│   ├─ Design primers → design_primers
│   ├─ Evaluate primers → evaluate_primers
│   └─ Simulate PCR → run_pcr
│
├─ Working with restriction enzymes?
│   ├─ Find sites → restriction_find_sites
│   ├─ Simulate digest → restriction_digest
│   ├─ Find unique cutters → restriction_suggest_cutters
│   └─ Get enzyme info → restriction_enzyme_info
│
├─ Assembling DNA?
│   ├─ Homology-based (seamless) → assemble_gibson
│   ├─ Type IIS enzymes (modular) → assemble_golden_gate
│   └─ Standard ligation → simulate_ligation
│
└─ Verify results?
    └─ Simulate gel → simulate_gel
```

## Primer Design Guidelines

### Optimal Parameters

| Parameter | Ideal | Acceptable | Avoid |
|-----------|-------|------------|-------|
| Length | 18-22 bp | 15-30 bp | < 15 or > 35 bp |
| Tm | 55-65°C | 50-70°C | < 50 or > 72°C |
| GC content | 40-60% | 35-65% | < 30 or > 70% |
| Tm difference | < 2°C | < 5°C | > 5°C |
| 3' end | G or C | Any | Runs of same base |

### GC Clamp Rule
```
✅ End with G or C (1-2 bases)
   → ATGCATGCATGC (ends in GC)

❌ End with multiple A/T
   → ATGCATGCATAAA (weak 3' end)
```

### Avoid in Primers

| Issue | Problem | Solution |
|-------|---------|----------|
| Hairpins | Self-annealing | Check ΔG > -2 kcal/mol |
| Primer dimers | Primers bind each other | Check 3' complementarity |
| Poly-X runs | AAAA, CCCC, etc. | Keep runs < 4 bases |
| Repetitive sequences | Mispriming | Avoid if possible |

## Assembly Method Comparison

| Method | Overlap | Scarless | Parts | Best For |
|--------|---------|----------|-------|----------|
| Gibson | 15-40 bp homology | Yes | 2-6 | General cloning |
| Golden Gate | 4 bp overhangs | Yes | 2-15+ | Modular, combinatorial |
| Traditional | RE sites + ligation | No (adds sites) | 2 | Simple insertions |

### When to Use Each

```
Gibson Assembly:
✅ Few parts (2-6)
✅ Any sequence (no BsaI sites needed)
✅ Quick, one-step reaction
❌ Not great for many parts (recombination drops)

Golden Gate:
✅ Many parts (4+)
✅ Combinatorial libraries
✅ Standardized parts (MoClo, etc.)
❌ Requires removal of internal BsaI/BbsI sites

Traditional Cloning:
✅ Simple insert into vector
✅ Well-characterized system
❌ Leaves restriction site scar
❌ Limited by available RE sites
```

## Common Mistakes

### Wrong: Tm calculation method mismatch
```
❌ Mixing Tm from different calculators
   → Primers designed with different methods
```
**Why wrong**: Tm formulas vary (nearest-neighbor vs. %GC method).

```
✅ Use same method consistently
   evaluate_primers uses nearest-neighbor with salt correction
```

### Wrong: Ignoring secondary structure
```
❌ Long primer with GGGCCC = hairpin formation
```

```
✅ Check with evaluate_primers
   Will report hairpin ΔG
   Redesign if ΔG < -3 kcal/mol
```

### Wrong: Gibson overlaps too short
```
❌ 10 bp overlaps "should be enough"
```
**Why wrong**: Short overlaps = low efficiency, especially with GC-poor regions.

```
✅ Overlap guidelines:
   - Minimum: 15 bp
   - Recommended: 20-25 bp
   - GC-poor regions: 30-40 bp
```

### Wrong: Not checking for internal enzyme sites
```
❌ Designing Golden Gate with BsaI site inside your gene
```

```
✅ Before assembly:
   restriction_find_sites for Type IIS enzyme
   Remove internal sites by synonymous mutations
```

## Tools Reference

### Primer Design

**design_primers** - Design PCR primers
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=design_primers" \
  -F 'params={
    "sequence": "ATGCGATCGATCGATCG...",
    "target_start": 100,
    "target_end": 500,
    "primer_length_range": [18, 25],
    "tm_range": [55, 65]
  }'
```

**evaluate_primers** - Check primer quality
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=evaluate_primers" \
  -F 'params={
    "forward_primer": "ATGCGATCGATCGATCG",
    "reverse_primer": "CTAGCTAGCTAGCTAG",
    "template": "..."
  }'
```

Returns: Tm, GC%, hairpin ΔG, dimer ΔG, product size.

### PCR Simulation

**run_pcr** - Simulate PCR
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=run_pcr" \
  -F 'params={
    "template": "ATGCGATCG...CGATCGCAT",
    "forward_primer": "ATGCGATCG",
    "reverse_primer": "ATGCGATCG"
  }'
```

### Restriction Analysis

**restriction_find_sites** - Find cut sites
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=restriction_find_sites" \
  -F 'params={
    "sequence": "ATGAATTCGATCGGATCCGATC...",
    "enzymes": ["EcoRI", "BamHI", "HindIII", "NotI"]
  }'
```

**restriction_digest** - Simulate digest
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=restriction_digest" \
  -F 'params={
    "sequence": "ATGAATTCGATCGGATCCGATC...",
    "enzymes": ["EcoRI", "BamHI"],
    "circular": true
  }'
```

**restriction_suggest_cutters** - Find unique cutters
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=restriction_suggest_cutters" \
  -F 'params={
    "sequence": "...",
    "target_cuts": 1
  }'
```

### Assembly

**assemble_gibson** - Gibson assembly
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=assemble_gibson" \
  -F 'params={
    "fragments": ["ATGC...", "GCTA...", "TACG..."],
    "overlap_length": 25
  }'
```

**assemble_golden_gate** - Golden Gate assembly
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=assemble_golden_gate" \
  -F 'params={
    "parts": [
      {"sequence": "...", "entry_overhang": "GGAG", "exit_overhang": "AATG"},
      {"sequence": "...", "entry_overhang": "AATG", "exit_overhang": "GCTT"}
    ],
    "enzyme": "BsaI"
  }'
```

### Gel Simulation

**simulate_gel** - Predict gel pattern
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=simulate_gel" \
  -F 'params={
    "fragments": [500, 1000, 2000, 5000],
    "ladder": "1kb",
    "gel_percent": 1.0
  }'
```

## Common Workflows

### Workflow 1: Clone gene into vector

```
1. Design PCR primers for gene
   → design_primers with Gibson overhangs added
   
2. Verify primers
   → evaluate_primers
   → Check Tm, dimers, hairpins
   
3. Simulate PCR
   → run_pcr to confirm product
   
4. Linearize vector
   → restriction_find_sites for unique site
   → restriction_digest to linearize
   
5. Simulate assembly
   → assemble_gibson with insert + linearized vector
   
6. Verify expected product
   → restriction_digest of final construct
   → simulate_gel to predict pattern
```

### Workflow 2: Golden Gate multi-part assembly

```
1. Check parts for internal BsaI sites
   → restriction_find_sites for each part
   → Remove if found
   
2. Design overhangs
   → Unique 4 bp for each junction
   → No palindromes
   
3. Simulate assembly
   → assemble_golden_gate
   → Verify correct order
   
4. Verify construct
   → restriction_digest with diagnostic enzymes
```

## Common Restriction Enzymes

| Enzyme | Recognition | Cut | Notes |
|--------|-------------|-----|-------|
| EcoRI | G↓AATTC | 5' overhang | Common, inexpensive |
| BamHI | G↓GATCC | 5' overhang | Compatible with BglII |
| HindIII | A↓AGCTT | 5' overhang | |
| NotI | GC↓GGCCGC | 5' overhang | 8-cutter, rare |
| XhoI | C↓TCGAG | 5' overhang | |
| BsaI | GGTCTC(N)↓ | Type IIS | Golden Gate |
| BbsI | GAAGAC(N)↓ | Type IIS | MoClo |

## Gel Percentage Guide

| Fragment Size | Gel % | Notes |
|--------------|-------|-------|
| > 5 kb | 0.5-0.8% | Large fragments |
| 1-5 kb | 0.8-1.0% | Standard |
| 500 bp - 1 kb | 1.0-1.5% | |
| 200-500 bp | 1.5-2.0% | |
| < 200 bp | 2.0-3.0% | Small fragments |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| No PCR product | Primers don't match template | Check primer binding sites |
| Multiple bands | Non-specific amplification | Increase annealing temp |
| Gibson fails | Overlaps too short | Use 25+ bp overlaps |
| Golden Gate low yield | Internal enzyme sites | Remove BsaI sites from parts |

---

**Tip**: Always simulate your cloning strategy before ordering primers or starting experiments.
