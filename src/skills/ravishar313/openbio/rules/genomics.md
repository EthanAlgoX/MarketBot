# Genomics Tools

Access genomics data from Ensembl, ENA, NCBI Gene, GWAS Catalog, and GEO via OpenBio API.

## When to Use

Use genomics tools when:
1. Looking up gene information
2. Getting DNA/protein sequences
3. Annotating genetic variants
4. Finding GWAS associations for diseases
5. Accessing gene expression datasets

## Decision Tree

```
What genomics data do you need?
│
├─ Gene information?
│   ├─ By gene symbol → lookup_gene (Ensembl) or search_gene (NCBI)
│   ├─ Multiple genes → batch_gene_lookup
│   └─ Cross-references → get_cross_references
│
├─ Sequences?
│   ├─ Gene/transcript sequence → get_sequence (Ensembl)
│   ├─ Raw reads (FASTQ) → search_ena_portal + get_ena_file_report
│   └─ Specific accession → get_ena_sequence_fasta
│
├─ Variant annotation?
│   └─ vep_predict (Variant Effect Predictor)
│
├─ Disease associations?
│   ├─ GWAS hits for disease → search_gwas_associations_by_trait
│   ├─ Variants near gene → search_gwas_variants_by_gene
│   └─ Specific variant → search_gwas_associations_by_variant
│
└─ Expression data?
    └─ search_geo_datasets → fetch_geo_summary → download_geo_series
```

## Key Concepts

### Gene Identifiers

| ID Type | Format | Example | Database |
|---------|--------|---------|----------|
| Ensembl Gene | ENSG + 11 digits | ENSG00000139618 | Ensembl |
| Ensembl Transcript | ENST + 11 digits | ENST00000357654 | Ensembl |
| NCBI Gene ID | Numeric | 672 | NCBI Gene |
| HGNC Symbol | Letters/numbers | BRCA1 | HGNC |
| UniProt | Accession | P38398 | UniProt |

**Tip**: Ensembl IDs are stable across versions. Gene symbols can be ambiguous.

### Variant Notation

**HGVS (Human Genome Variation Society)**:
```
NM_000546.5:c.215C>G    # Coding DNA
NP_000537.3:p.Pro72Arg  # Protein
NC_000017.11:g.7673803C>G  # Genomic
```

**VCF-style**:
```
13:32936732:C:T         # chr:pos:ref:alt
```

## Common Mistakes

### Wrong: Using gene symbols without species
```
❌ lookup_gene: "BRCA1"
   → May return wrong species
```

```
✅ Always specify species:
   lookup_gene with species: "human"
   Or use Ensembl ID: ENSG00000012048
```

### Wrong: Assuming one gene = one transcript
```
❌ Taking first transcript as representative
```
**Why wrong**: Most genes have multiple isoforms with different functions.

```
✅ Check:
   - get_sequence for all transcripts
   - Identify canonical transcript (usually longest)
   - Consider tissue-specific isoforms
```

### Wrong: VEP without assembly version
```
❌ vep_predict with positions from unknown assembly
```
**Why wrong**: Position 12345 on GRCh37 ≠ position 12345 on GRCh38.

```
✅ Always specify assembly or ensure consistent coordinates
```

### Wrong: Treating GWAS hits as causal
```
❌ "rs7329174 causes Type 2 diabetes"
```
**Why wrong**: GWAS finds associations, not causation. Variant may be in LD with causal variant.

```
✅ Interpret correctly:
   "rs7329174 is associated with T2D risk"
   Check LD, fine-mapping studies for causal variants
```

## Quality Thresholds

### GWAS Significance

| P-value | Interpretation |
|---------|----------------|
| < 5×10⁻⁸ | Genome-wide significant |
| 5×10⁻⁸ to 10⁻⁵ | Suggestive |
| > 10⁻⁵ | Not significant |

### VEP Impact Categories

| Impact | Examples | Interpretation |
|--------|----------|----------------|
| HIGH | Stop gain, frameshift | Likely deleterious |
| MODERATE | Missense | May affect function |
| LOW | Synonymous | Unlikely functional |
| MODIFIER | Intron, upstream | Usually benign |

## Tools Reference

### Gene Lookup

**lookup_gene** - Find gene by symbol or ID (Ensembl)
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=lookup_gene" \
  -F 'params={"id": "BRCA1", "species": "human"}'
```

**search_gene** - Search NCBI Gene
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=search_gene" \
  -F 'params={"query": "BRCA1 human", "max_results": 5}'
```

**batch_gene_lookup** - Multiple genes at once
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=batch_gene_lookup" \
  -F 'params={"gene_ids": ["672", "675", "7157"]}'
```

### Sequences

**get_sequence** - Get DNA or protein sequence
```bash
# Genomic DNA
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=get_sequence" \
  -F 'params={"id": "ENSG00000139618", "type": "genomic"}'

# Protein sequence
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=get_sequence" \
  -F 'params={"id": "ENSP00000418960", "type": "protein"}'
```

### Variant Annotation

**vep_predict** - Variant Effect Predictor
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=vep_predict" \
  -F 'params={"variants": ["13:32936732:C:T", "17:43044295:G:A"], "species": "human"}'
```

Returns: gene impact, protein change, consequences, SIFT/PolyPhen scores.

### GWAS Catalog

**search_gwas_associations_by_trait** - Find variants for disease
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=search_gwas_associations_by_trait" \
  -F 'params={"trait": "EFO_0000384"}'
```

**search_gwas_variants_by_gene** - Variants near a gene
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=search_gwas_variants_by_gene" \
  -F 'params={"gene": "APOE"}'
```

### Expression Data (GEO)

**search_geo_datasets** - Find expression datasets
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=search_geo_datasets" \
  -F 'params={"query": "breast cancer RNA-seq human", "max_results": 10}'
```

**download_geo_series** - Get expression matrix
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=download_geo_series" \
  -F 'params={"accession": "GSE12345"}'
```

## Common Workflows

### Workflow 1: Characterize a gene

```
1. Get gene information
   → lookup_gene with symbol + species
   
2. Get cross-references
   → get_cross_references for UniProt, RefSeq links
   
3. Find GWAS associations
   → search_gwas_variants_by_gene
   → Note disease associations
   
4. Check expression patterns
   → search_geo_datasets for your gene
   → Look at tissue expression
```

### Workflow 2: Annotate variants from sequencing

```
1. Format variants as VCF-style
   → chr:pos:ref:alt
   
2. Run VEP annotation
   → vep_predict with variant list
   
3. Prioritize by impact
   → HIGH impact first
   → Check SIFT/PolyPhen for missense
   
4. Cross-reference with GWAS
   → search_gwas_associations_by_variant
   → Any known associations?
```

### Workflow 3: Find disease-related genes

```
1. Get GWAS hits for disease
   → search_gwas_associations_by_trait with EFO ID
   
2. Map variants to genes
   → Note reported genes
   
3. Prioritize genes
   → Multiple variants = stronger evidence
   → Check if gene function relates to disease
   
4. Get detailed gene info
   → lookup_gene for top candidates
```

## EFO (Experimental Factor Ontology) Common IDs

| EFO ID | Disease/Trait |
|--------|---------------|
| EFO_0000384 | Crohn's disease |
| EFO_0000685 | Rheumatoid arthritis |
| EFO_0000384 | Type 2 diabetes |
| EFO_0001359 | Breast cancer |
| EFO_0004838 | Coronary artery disease |

Find EFO IDs at: https://www.ebi.ac.uk/ols/ontologies/efo

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Gene not found | Symbol ambiguous | Use Ensembl ID or specify species |
| VEP returns no results | Wrong coordinate format | Use chr:pos:ref:alt format |
| GWAS returns no hits | Rare disease | May not have GWAS studies yet |
| GEO dataset too large | Many samples | Download in chunks or use specific samples |

---

**Tip**: When working with coordinates, always know if they're GRCh37 (hg19) or GRCh38 (hg38). Mixing assemblies causes errors.
