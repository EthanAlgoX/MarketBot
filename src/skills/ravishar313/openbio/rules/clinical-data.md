# Clinical Data Tools

Access clinical trials, variant pathogenicity, FDA data, and drug-target associations.

## When to Use

Use clinical data tools when:
1. Finding clinical trials for a condition
2. Checking variant pathogenicity (ClinVar)
3. Investigating drug safety (FDA adverse events)
4. Finding drugs for a disease target
5. Understanding drug-target relationships

## Decision Tree

```
What clinical information do you need?
│
├─ Clinical trials?
│   ├─ By condition → search_clinical_trials with condition
│   ├─ By drug → search_clinical_trials with intervention
│   └─ Specific trial → get_clinical_trial_details with NCT ID
│
├─ Variant pathogenicity?
│   ├─ By gene → search_clinvar with "GENE[gene]"
│   ├─ By position → search_by_position
│   └─ Specific variant → get_variant_details
│
├─ Drug safety?
│   ├─ Adverse events → search_drug_adverse_events
│   ├─ Drug labeling → get_drug_label
│   └─ Recalls → search_drug_recalls
│
└─ Drug discovery?
    ├─ Drugs for disease → get_known_drugs_for_disease
    ├─ Target validation → get_target_disease_evidence
    └─ Target info → get_target_info
```

## ClinVar Interpretation

### Clinical Significance Categories

| Classification | Meaning | Action |
|---------------|---------|--------|
| Pathogenic | Disease-causing | Report to clinician |
| Likely pathogenic | Probably disease-causing | Report with caveat |
| Uncertain significance (VUS) | Unknown | Do not use clinically |
| Likely benign | Probably harmless | Generally ignore |
| Benign | Harmless | Ignore |

### Review Status (Star Rating)

| Stars | Meaning | Confidence |
|-------|---------|------------|
| ⭐⭐⭐⭐ | Expert panel reviewed | Highest |
| ⭐⭐⭐ | Multiple submitters, no conflict | High |
| ⭐⭐ | Multiple submitters, some conflict | Moderate |
| ⭐ | Single submitter | Lower |
| No stars | No assertion criteria | Lowest |

**Rule**: For clinical decisions, prioritize variants with ≥ 2 stars.

## Common Mistakes

### Wrong: Treating VUS as pathogenic
```
❌ "ClinVar says VUS, so it might cause disease"
```
**Why wrong**: VUS means we don't know. Cannot be used for clinical decisions.

```
✅ Interpretation:
   - Pathogenic/Likely pathogenic → Clinically relevant
   - VUS → Uncertain, needs more evidence
   - Benign/Likely benign → Not clinically relevant
```

### Wrong: Single adverse event = causation
```
❌ "Patient had X after taking drug Y, so Y causes X"
```
**Why wrong**: FAERS is spontaneous reports, not controlled data.

```
✅ Correct interpretation:
   - Multiple reports = potential signal
   - PRR/ROR statistics for proper analysis
   - Correlation ≠ causation
```

### Wrong: Ignoring trial phase
```
❌ Citing Phase 1 results as efficacy evidence
```
**Why wrong**: Phase 1 is primarily safety/dosing, not efficacy.

```
✅ Understand phases:
   - Phase 1: Safety, dosing (20-80 patients)
   - Phase 2: Efficacy signal (100-300 patients)
   - Phase 3: Confirmatory efficacy (1000+ patients)
   - Phase 4: Post-marketing surveillance
```

### Wrong: Conflating association with causation (Open Targets)
```
❌ "Open Targets shows score 0.7, so this target causes the disease"
```

```
✅ Open Targets score reflects:
   - Multiple lines of evidence
   - Genetic associations
   - Expression data
   - Known drugs
   
   High score = good target candidate, not proof of causation
```

## Tools Reference

### Clinical Trials

**search_clinical_trials** - Find trials
```bash
# By condition
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=search_clinical_trials" \
  -F 'params={
    "condition": "breast cancer",
    "status": ["RECRUITING"],
    "phase": ["PHASE3"],
    "max_results": 20
  }'

# By intervention
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=search_clinical_trials" \
  -F 'params={
    "intervention": "pembrolizumab",
    "status": ["RECRUITING", "ACTIVE_NOT_RECRUITING"],
    "max_results": 20
  }'
```

**get_clinical_trial_details** - Get full trial info
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=get_clinical_trial_details" \
  -F 'params={"nct_id": "NCT04379596"}'
```

### ClinVar Variants

**search_clinvar** - Search variants
```bash
# By gene
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=search_clinvar" \
  -F 'params={"query": "BRCA1[gene] AND pathogenic[clinsig]", "max_results": 20}'

# By condition
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=search_clinvar" \
  -F 'params={"query": "hereditary breast cancer", "max_results": 20}'
```

**search_by_position** - Search by genomic coordinates
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=search_by_position" \
  -F 'params={
    "chromosome": "17",
    "start": 43044295,
    "stop": 43170245,
    "assembly": "GRCh38"
  }'
```

### FDA Data

**search_drug_adverse_events** - Query FAERS
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=search_drug_adverse_events" \
  -F 'params={
    "drug_name": "ibuprofen",
    "reaction": "liver injury",
    "limit": 20
  }'
```

**get_drug_label** - Get prescribing information
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=get_drug_label" \
  -F 'params={"drug_name": "metformin"}'
```

### Open Targets

**get_known_drugs_for_disease** - Find approved/trial drugs
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=get_known_drugs_for_disease" \
  -F 'params={"disease_id": "EFO_0000311"}'
```

**get_target_disease_evidence** - Get association evidence
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=get_target_disease_evidence" \
  -F 'params={
    "target_id": "ENSG00000146648",
    "disease_id": "EFO_0001071"
  }'
```

**get_target_associations** - All diseases for a target
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=get_target_associations" \
  -F 'params={"target_id": "ENSG00000146648", "size": 20}'
```

## Common Workflows

### Workflow 1: Assess variant pathogenicity

```
1. Search ClinVar
   → search_clinvar with gene + variant
   
2. Check classification
   → Pathogenic/Likely pathogenic = clinically significant
   → VUS = uncertain
   
3. Check review status
   → ≥ 2 stars = higher confidence
   
4. Get details if needed
   → get_variant_details for full evidence
```

### Workflow 2: Find treatments for a disease

```
1. Get Open Targets disease ID
   → search_opentargets with disease name
   
2. Find known drugs
   → get_known_drugs_for_disease
   → Filter by clinical phase
   
3. Check clinical trials
   → search_clinical_trials for the disease
   → Focus on Phase 2/3 for efficacy data
   
4. Verify drug safety
   → search_drug_adverse_events
   → get_drug_label for warnings
```

### Workflow 3: Validate drug target

```
1. Get target evidence
   → get_target_disease_evidence
   → Check genetic, expression, literature evidence
   
2. Check existing drugs
   → get_known_drugs_for_disease
   → Are there approved drugs for this target?
   
3. Review clinical trials
   → search_clinical_trials with target-directed drugs
   → What's the clinical success rate?
```

## Trial Status Values

| Status | Meaning |
|--------|---------|
| NOT_YET_RECRUITING | Approved but not yet enrolling |
| RECRUITING | Actively enrolling |
| ACTIVE_NOT_RECRUITING | Ongoing, enrollment closed |
| COMPLETED | Study finished |
| TERMINATED | Ended early (check reasons) |
| WITHDRAWN | Never started |
| SUSPENDED | Temporarily halted |

## Open Targets Evidence Types

| Evidence | Description |
|----------|-------------|
| Genetic association | GWAS, Mendelian disease |
| Somatic mutation | Cancer mutations |
| Known drug | Approved drugs, clinical trials |
| Expression | Differential expression |
| Literature | Text mining |
| Animal models | Knockout phenotypes |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| No ClinVar results | Novel variant | May not be in database yet |
| No trials found | Rare disease | Try broader search terms |
| FAERS empty | Drug name variant | Try generic name, brand name |
| Open Targets no hits | Wrong ID | Use Ensembl gene ID (ENSG...) |

---

**Important**: ClinVar and FDA data are for research. Clinical decisions require medical expertise.
