# Protein Structure Tools

Query protein structures from PDB, PDBe, AlphaFold, and UniProt via OpenBio API.

## When to Use

Use protein structure tools when:
1. Finding experimental structures for a protein
2. Getting AlphaFold predictions for proteins without crystal structures
3. Analyzing binding sites and protein-ligand interactions
4. Finding structurally similar proteins
5. Mapping between databases (PDB ↔ UniProt)

## Decision Tree

```
Need protein structure?
│
├─ Have PDB ID?
│   └─ Yes → fetch_pdb_metadata (get structure details)
│
├─ Have UniProt ID?
│   ├─ Want experimental structure? → get_best_structures_for_uniprot_id
│   └─ No experimental exists? → get_alphafold_prediction
│
├─ Have sequence only?
│   └─ run_seq_similarity_query (find similar structures)
│
├─ Searching by text?
│   └─ run_text_query ("kinase inhibitor", organism, etc.)
│
└─ Analyzing binding sites?
    └─ get_binding_site_residues + get_interactions
```

## Quality Thresholds

### Experimental Structures (PDB)
| Metric | Good | Acceptable | Poor |
|--------|------|------------|------|
| Resolution | < 2.0 Å | 2.0-3.0 Å | > 3.0 Å |
| R-free | < 0.25 | 0.25-0.30 | > 0.30 |

**Rule**: For drug design, prefer resolution < 2.5 Å. For general analysis, < 3.0 Å is acceptable.

### AlphaFold Predictions
| pLDDT Score | Interpretation | Use For |
|-------------|----------------|---------|
| > 90 | Very high confidence | Drug design, detailed analysis |
| 70-90 | Confident | General structure analysis |
| 50-70 | Low confidence | Fold topology only |
| < 50 | Very low | Likely disordered, avoid |

**Rule**: Don't trust binding site details if pLDDT < 70 in that region.

### Interface Predictions (ipTM)
| ipTM | Interpretation |
|------|----------------|
| > 0.8 | High confidence interface |
| 0.6-0.8 | Moderate confidence |
| < 0.6 | Low confidence, verify experimentally |

## Common Mistakes

### Wrong: Using AlphaFold for everything
```
❌ Get AlphaFold prediction for well-studied protein like EGFR
```
**Why wrong**: EGFR has 100+ crystal structures with ligands. AlphaFold won't show ligand-induced conformations.

```
✅ First check: get_best_structures_for_uniprot_id
   If no good structures → get_alphafold_prediction
```

### Wrong: Ignoring resolution
```
❌ Using 4.5 Å structure for binding site analysis
```
**Why wrong**: At > 3.5 Å, side chain positions are unreliable.

```
✅ Filter by resolution in search:
   search_for_attributes with resolution_max: 2.5
```

### Wrong: Not checking chain coverage
```
❌ Assuming PDB structure covers full protein
```
**Why wrong**: Many structures are fragments or domains only.

```
✅ Check polymer_entities in fetch_pdb_metadata response
   Compare residue range to UniProt full length
```

## Tools Reference

### Primary Structure Lookup

**fetch_pdb_metadata** - Get structure metadata
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=fetch_pdb_metadata" \
  -F 'params={"pdb_ids": ["1MBO", "3HTB"]}'
```

**get_best_structures_for_uniprot_id** - Find best PDB for a protein
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=get_best_structures_for_uniprot_id" \
  -F 'params={"uniprot_accession": "P00533"}'
```

Returns structures ranked by: resolution, coverage, and ligand presence.

**get_alphafold_prediction** - Get predicted structure
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=get_alphafold_prediction" \
  -F 'params={"uniprot_accession": "P00533"}'
```

### Search Tools

**run_text_query** - Search by keywords
```bash
# Find kinase structures from human
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=run_text_query" \
  -F 'params={"query": "kinase Homo sapiens", "return_type": "entry", "max_results": 20}'
```

**run_seq_similarity_query** - Find similar structures by sequence
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=run_seq_similarity_query" \
  -F 'params={"sequence": "MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFL...", "identity_cutoff": 0.7}'
```

**Tip**: Use identity_cutoff 0.3-0.5 for remote homologs, 0.7+ for close homologs.

### Binding Site Analysis

**get_binding_site_residues** - Get residues in binding site
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=get_binding_site_residues" \
  -F 'params={"pdb_id": "3HTB"}'
```

**get_interactions** - Get protein-ligand interactions
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=get_interactions" \
  -F 'params={"pdb_id": "3HTB"}'
```

## Common Workflows

### Workflow 1: Find structure for a gene

```
1. Get UniProt ID for gene
   → search_uniprot with gene name
   
2. Check for experimental structures
   → get_best_structures_for_uniprot_id
   
3. If no good structures (resolution > 3.0 or no coverage):
   → get_alphafold_prediction
   
4. Verify quality:
   - Experimental: check resolution, R-free
   - AlphaFold: check pLDDT scores
```

### Workflow 2: Analyze drug binding site

```
1. Get structure with drug bound
   → run_text_query: "PROTEIN_NAME inhibitor"
   
2. Filter for good resolution
   → Select structures with resolution < 2.5 Å
   
3. Get binding site details
   → get_binding_site_residues
   → get_interactions
   
4. Cross-reference with AlphaFold
   → Check pLDDT of binding site residues
   → Low pLDDT = flexible region, may adopt different conformations
```

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| No structures found | Protein not crystallized | Use AlphaFold prediction |
| Low resolution only | Difficult target | Consider cryo-EM structures (may be lower res) |
| Multiple chains | Biological assembly | Check which chain is your target |
| Missing residues | Disordered regions | Normal for flexible loops, check AlphaFold pLDDT |

## Tool Comparison

| Tool | Use When | Returns |
|------|----------|---------|
| `fetch_pdb_metadata` | Have PDB ID | Full metadata, resolution, ligands |
| `get_best_structures_for_uniprot_id` | Have UniProt, want best PDB | Ranked structure list |
| `get_alphafold_prediction` | No experimental structure | Predicted structure + confidence |
| `run_text_query` | Searching by keywords | PDB ID list |
| `run_seq_similarity_query` | Have sequence, find homologs | Similar structures |
| `get_binding_site_residues` | Analyzing interactions | Binding site residues |

---

**Tip**: Always check tool schema first with `GET /api/v1/tools/{tool_name}` to see exact parameter names.
