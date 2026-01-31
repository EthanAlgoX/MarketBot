# Pathway Analysis Tools

Analyze biological pathways and protein interactions via KEGG, Reactome, and STRING.

## When to Use

Use pathway analysis tools when:
1. Understanding gene/protein function in context
2. Performing enrichment analysis on gene lists
3. Finding protein-protein interactions
4. Mapping genes to pathways
5. Visualizing biological networks

## Decision Tree

```
What analysis do you need?
│
├─ Pathway information?
│   ├─ Specific pathway details → kegg_get_entry or query_reactome_pathway
│   ├─ Search pathways → kegg_search or search_reactome_pathways
│   └─ Genes in pathway → kegg_link_entries or get_pathway_entities
│
├─ Enrichment analysis (have gene list)?
│   ├─ GO/KEGG terms → analyze_string_enrichment
│   └─ Reactome pathways → analyze_gene_list
│
├─ Protein interactions?
│   ├─ Get network → get_string_network
│   ├─ Find interactors → get_interaction_partners
│   └─ Visualize → get_string_network_image
│
└─ Drug-pathway relationships?
    └─ kegg_drug_interactions
```

## Enrichment Analysis Best Practices

### Input Requirements

| Requirement | Good Practice |
|-------------|---------------|
| Gene list size | 10-500 genes (5 minimum) |
| Gene format | Official symbols (HGNC for human) |
| Background | Use expressed genes, not whole genome |

### Interpreting Results

**P-value thresholds**:
| P-value | FDR | Interpretation |
|---------|-----|----------------|
| < 0.001 | < 0.01 | Strong enrichment |
| 0.001-0.01 | 0.01-0.05 | Significant |
| 0.01-0.05 | 0.05-0.1 | Suggestive |
| > 0.05 | > 0.1 | Not significant |

**Rule**: Always use FDR-corrected p-values when testing multiple pathways.

### Common Pitfalls

```
❌ Too few genes
   "Enrichment with 3 genes" → Not meaningful

✅ Need at least 5-10 genes for reliable enrichment
```

```
❌ Redundant pathways
   "Cell cycle" and "Mitotic cell cycle" both significant

✅ Group related terms, report most specific
```

```
❌ Ignoring background
   Testing against all 20,000 genes when only 8,000 expressed

✅ Use appropriate background (expressed genes in your experiment)
```

## STRING Confidence Scores

| Score | Confidence | Use For |
|-------|------------|---------|
| > 900 | Highest | High-confidence core network |
| 700-900 | High | Standard analysis |
| 400-700 | Medium | Exploratory, may have false positives |
| < 400 | Low | Only if seeking novel interactions |

**Recommendation**: Start with score ≥ 700, lower only if network too sparse.

## Tools Reference

### KEGG Pathways

**kegg_search** - Find pathways
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=kegg_search" \
  -F 'params={"database": "pathway", "query": "apoptosis"}'
```

**kegg_get_entry** - Get pathway details
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=kegg_get_entry" \
  -F 'params={"entry_id": "hsa04210"}'
```

**kegg_link_entries** - Find genes in pathway
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=kegg_link_entries" \
  -F 'params={"source": "pathway", "target": "hsa", "entry_ids": ["hsa04210"]}'
```

### Reactome

**analyze_gene_list** - Pathway enrichment
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=analyze_gene_list" \
  -F 'params={
    "genes": ["TP53", "BRCA1", "BRCA2", "ATM", "CHEK2", "MDM2", "CDK2"],
    "species": "Homo sapiens"
  }'
```

**search_reactome_pathways** - Find pathways
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=search_reactome_pathways" \
  -F 'params={"query": "DNA repair", "species": "Homo sapiens"}'
```

### STRING Interactions

**get_string_network** - Get interaction network
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=get_string_network" \
  -F 'params={
    "identifiers": ["TP53", "BRCA1", "MDM2", "ATM", "CHEK2"],
    "species": 9606,
    "required_score": 700
  }'
```

**analyze_string_enrichment** - GO/KEGG enrichment
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=analyze_string_enrichment" \
  -F 'params={
    "identifiers": ["TP53", "BRCA1", "BRCA2", "ATM", "CHEK2"],
    "species": 9606
  }'
```

**get_interaction_partners** - Find interactors
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=get_interaction_partners" \
  -F 'params={
    "identifiers": ["TP53"],
    "species": 9606,
    "limit": 20
  }'
```

**get_string_network_image** - Visualize network
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=get_string_network_image" \
  -F 'params={
    "identifiers": ["TP53", "BRCA1", "MDM2"],
    "species": 9606
  }'
```

## Common Workflows

### Workflow 1: Interpret differentially expressed genes

```
1. Prepare gene list
   → Use significant DEGs (FDR < 0.05)
   → Convert to gene symbols
   
2. Run enrichment analysis
   → analyze_gene_list (Reactome)
   → analyze_string_enrichment (GO/KEGG)
   
3. Interpret results
   → Sort by FDR
   → Group related terms
   → Focus on specific pathways over generic
   
4. Visualize key pathway
   → get_string_network_image for genes in top pathway
```

### Workflow 2: Explore protein's functional context

```
1. Find interaction partners
   → get_interaction_partners for your protein
   → Use high confidence (score > 700)
   
2. Build network
   → get_string_network with partners
   
3. Run enrichment on network
   → analyze_string_enrichment
   → What functions are enriched?
   
4. Map to pathways
   → analyze_gene_list (Reactome)
   → Which pathways involve this network?
```

### Workflow 3: Compare pathways between conditions

```
1. Get gene lists for each condition
   
2. Run enrichment separately
   → analyze_gene_list for condition A
   → analyze_gene_list for condition B
   
3. Compare enriched pathways
   → Common pathways = shared biology
   → Unique pathways = condition-specific
```

## KEGG Organism Codes

| Code | Organism |
|------|----------|
| hsa | Homo sapiens |
| mmu | Mus musculus |
| rno | Rattus norvegicus |
| dme | Drosophila melanogaster |
| sce | Saccharomyces cerevisiae |
| eco | Escherichia coli |

## STRING Species Taxonomy IDs

| Taxon ID | Organism |
|----------|----------|
| 9606 | Human |
| 10090 | Mouse |
| 10116 | Rat |
| 7227 | Fruit fly |
| 6239 | C. elegans |
| 4932 | Yeast |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| No enrichment found | Too few genes | Need 5+ genes minimum |
| Too many significant terms | Too many genes | Consider stricter FDR, use specific terms |
| Gene not found in STRING | Wrong identifier | Use official gene symbols |
| Empty network | Score too high | Lower required_score to 400 |

---

**Note**: KEGG is for academic use only. For commercial use, check licensing.
