# Cheminformatics Tools

Analyze small molecules using RDKit, PubChem, and ChEMBL via OpenBio API.

## When to Use

Use cheminformatics tools when:
1. Checking if a compound is drug-like
2. Calculating molecular properties (MW, LogP, etc.)
3. Finding similar compounds in databases
4. Checking for problematic structural features (PAINS)
5. Estimating synthetic accessibility

## Decision Tree

```
What do you need?
│
├─ Check drug-likeness?
│   └─ calculate_molecular_properties → check Lipinski rules
│
├─ Find compound info?
│   ├─ Have name → search_pubchem or search_chembl_by_name
│   ├─ Have SMILES → chembl_similarity_search_by_smiles
│   └─ Have ChEMBL ID → get_chembl_molecule_by_id
│
├─ Check compound quality?
│   ├─ PAINS/promiscuous? → get_structural_alerts_from_smiles
│   └─ Synthesizable? → calculate_sa_score
│
├─ Compare compounds?
│   └─ calculate_fingerprint_similarity (Tanimoto)
│
└─ Validate SMILES?
    └─ validate_and_canonicalize_smiles
```

## Quality Thresholds

### Drug-Likeness (Lipinski's Rule of 5)

| Property | Rule | Oral Drug Range |
|----------|------|-----------------|
| Molecular Weight | ≤ 500 Da | 200-500 Da |
| LogP | ≤ 5 | 1-3 (optimal) |
| H-bond Donors | ≤ 5 | 0-3 |
| H-bond Acceptors | ≤ 10 | 2-7 |

**Rule**: 1 violation acceptable, 2+ = poor oral bioavailability likely.

### Beyond Rule of 5 (for complex targets)

| Property | Extended Range | Notes |
|----------|---------------|-------|
| MW | ≤ 700 Da | PPI inhibitors, macrocycles |
| TPSA | < 140 Å² | CNS drugs need < 90 Å² |
| Rotatable bonds | < 10 | Rigidity helps binding |

### Synthetic Accessibility Score

| SA Score | Interpretation | Action |
|----------|----------------|--------|
| 1-3 | Easy to synthesize | Proceed |
| 3-5 | Moderate difficulty | Consider alternatives |
| 5-7 | Difficult | May need custom synthesis |
| 7-10 | Very difficult | Redesign compound |

### Similarity Thresholds

| Tanimoto | Interpretation |
|----------|----------------|
| > 0.85 | Very similar (likely same scaffold) |
| 0.7-0.85 | Similar (may share activity) |
| 0.5-0.7 | Moderate similarity |
| < 0.5 | Different compounds |

## Common Mistakes

### Wrong: Ignoring PAINS alerts
```
❌ Proceeding with compound showing PAINS alert
```
**Why wrong**: PAINS compounds often show false positive activity in assays.

```
✅ Always check: get_structural_alerts_from_smiles
   If alerts found → investigate mechanism or choose different scaffold
```

### Wrong: Trusting LogP without context
```
❌ "LogP is 4.5, within Rule of 5, so it's fine"
```
**Why wrong**: High LogP causes solubility issues, metabolic instability.

```
✅ Optimal LogP: 1-3
   LogP > 4: Expect solubility issues
   LogP > 5: High metabolic clearance likely
```

### Wrong: Not canonicalizing SMILES
```
❌ Comparing SMILES strings directly
   "c1ccccc1" vs "C1=CC=CC=C1" → appear different
```

```
✅ Always canonicalize first:
   validate_and_canonicalize_smiles
   Then compare canonical forms
```

### Wrong: Using MW as only filter
```
❌ Rejecting 550 Da compound automatically
```
**Why wrong**: Natural products, PPI inhibitors routinely exceed 500 Da.

```
✅ Consider target class:
   - Standard targets: Lipinski rules
   - PPIs, macrocycles: Extended rules (bRo5)
   - CNS: Stricter (MW < 400, TPSA < 90)
```

## Tools Reference

### Property Calculation

**calculate_molecular_properties** - Get drug-like properties
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=calculate_molecular_properties" \
  -F 'params={"smiles": "CC(=O)Oc1ccccc1C(=O)O"}'
```

Returns: MW, LogP, TPSA, HBD, HBA, rotatable bonds, etc.

**calculate_sa_score** - Synthetic accessibility
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=calculate_sa_score" \
  -F 'params={"smiles": "CC(=O)Oc1ccccc1C(=O)O"}'
```

### Quality Checks

**get_structural_alerts_from_smiles** - Check for PAINS/alerts
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=get_structural_alerts_from_smiles" \
  -F 'params={"smiles": "CC(=O)Oc1ccccc1C(=O)O"}'
```

**validate_and_canonicalize_smiles** - Validate and standardize
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=validate_and_canonicalize_smiles" \
  -F 'params={"smiles": "c1ccccc1"}'
```

### Database Search

**search_pubchem** - Search by name
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=search_pubchem" \
  -F 'params={"query": "aspirin"}'
```

**chembl_similarity_search_by_smiles** - Find similar compounds
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=chembl_similarity_search_by_smiles" \
  -F 'params={"smiles": "CC(=O)Oc1ccccc1C(=O)O", "similarity": 70}'
```

**Tip**: similarity parameter is percentage (70 = Tanimoto ≥ 0.7)

### Similarity Calculation

**calculate_fingerprint_similarity** - Compare two molecules
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=calculate_fingerprint_similarity" \
  -F 'params={"smiles1": "CC(=O)Oc1ccccc1C(=O)O", "smiles2": "CC(=O)Nc1ccc(O)cc1"}'
```

## Common Workflows

### Workflow 1: Evaluate hit compound

```
1. Validate SMILES
   → validate_and_canonicalize_smiles
   
2. Check drug-likeness
   → calculate_molecular_properties
   → Verify Lipinski compliance
   
3. Check for PAINS
   → get_structural_alerts_from_smiles
   → If alerts: investigate or deprioritize
   
4. Assess synthesizability
   → calculate_sa_score
   → SA > 6: consider analogs
   
5. Find similar known compounds
   → chembl_similarity_search_by_smiles
   → Check if similar compounds have known issues
```

### Workflow 2: Compare compound series

```
1. Canonicalize all SMILES
   → validate_and_canonicalize_smiles for each
   
2. Calculate properties for all
   → calculate_molecular_properties for each
   
3. Calculate pairwise similarity
   → calculate_fingerprint_similarity
   
4. Identify property trends
   → Compare MW, LogP progression
   → Flag outliers
```

### Workflow 3: CNS drug assessment

```
Stricter criteria for blood-brain barrier:

1. Check properties:
   - MW < 400 Da (ideally < 350)
   - LogP: 1-3 (not too polar, not too lipophilic)
   - TPSA < 90 Å² (must cross BBB)
   - HBD ≤ 3
   - No PAINS alerts
   
2. Red flags:
   - TPSA > 90 → won't cross BBB
   - LogP < 0 → too polar
   - LogP > 4 → P-gp efflux substrate likely
```

## SMILES Quick Reference

| Symbol | Meaning |
|--------|---------|
| C, N, O, S | Atoms (uppercase = aliphatic) |
| c, n, o, s | Aromatic atoms (lowercase) |
| = | Double bond |
| # | Triple bond |
| () | Branch |
| 1,2,3... | Ring closure |
| [NH2] | Explicit H atoms |
| @ | Stereochemistry |

Examples:
- Benzene: `c1ccccc1`
- Aspirin: `CC(=O)Oc1ccccc1C(=O)O`
- Caffeine: `Cn1cnc2c1c(=O)n(c(=O)n2C)C`

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| SMILES invalid | Syntax error | Check ring closures, branches balanced |
| Properties differ from literature | Different salt form | Use neutral form for comparison |
| No ChEMBL results | Novel compound | Expected for new scaffolds |
| High SA score | Complex structure | Consider simpler analogs |

---

**Tip**: Always start with `validate_and_canonicalize_smiles` to catch SMILES errors early.
