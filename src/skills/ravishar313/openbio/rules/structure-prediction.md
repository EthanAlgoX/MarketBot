# Structure Prediction Tools

Run ML-based structure prediction and protein design via OpenBio API.

## When to Use

Use structure prediction tools when:
1. Validating designed protein sequences (does it fold?)
2. Predicting protein-protein complex structures
3. Predicting protein-ligand binding poses
4. Designing new sequences for a backbone (inverse folding)
5. Optimizing protein stability

## Decision Tree

```
What do you need?
│
├─ Predict structure from sequence?
│   ├─ Single protein → submit_boltz_prediction or submit_chai_prediction
│   ├─ Protein complex → submit_boltz_prediction (multi-chain FASTA)
│   └─ Protein + ligand → submit_chai_prediction (supports SMILES)
│
├─ Design sequence for backbone?
│   ├─ No ligand in binding site → submit_proteinmpnn_prediction
│   ├─ Ligand present → submit_ligandmpnn_prediction
│   └─ Need thermostability → submit_thermompnn_prediction
│
├─ Dock ligand to protein?
│   └─ submit_geodock_prediction
│
└─ De novo protein design?
    └─ submit_pinal_text_design or submit_pinal_structure_design
```

## Quality Thresholds

### Structure Prediction (Boltz/Chai)

| Metric | Excellent | Good | Poor |
|--------|-----------|------|------|
| pTM | > 0.8 | 0.6-0.8 | < 0.6 |
| ipTM (interface) | > 0.7 | 0.5-0.7 | < 0.5 |
| pLDDT (per-residue) | > 85 | 70-85 | < 70 |

**Interpretation**:
- **pTM > 0.8**: High confidence in overall fold
- **ipTM > 0.7**: Confident protein-protein interface
- **pLDDT > 85**: Confident local structure

**Rule**: Don't trust predictions with pTM < 0.5. Redesign or get experimental data.

### Sequence Design (ProteinMPNN/LigandMPNN)

| Metric | Good | Acceptable | Investigate |
|--------|------|------------|-------------|
| Score (negative log-likelihood) | < 1.5 | 1.5-2.5 | > 2.5 |
| Sequence recovery | 0.3-0.5 (de novo) | 0.5-0.7 | > 0.8 (too conservative) |

**Rule**: Low diversity (all sequences identical) = temperature too low. Increase to 0.2-0.3.

## Common Mistakes

### Wrong: Not checking prediction confidence
```
❌ Using predicted structure without checking pTM/pLDDT
```

```
✅ Always check confidence in job results:
   - pTM < 0.5 → prediction unreliable
   - pLDDT < 50 in a region → likely disordered
```

### Wrong: Using ProteinMPNN when ligand is present
```
❌ Designing binding site with ProteinMPNN when ligand matters
```
**Why wrong**: ProteinMPNN doesn't see the ligand, may design residues that clash.

```
✅ Use LigandMPNN for ligand-aware design:
   submit_ligandmpnn_prediction with ligand_chain specified
```

### Wrong: Temperature too low for exploration
```
❌ Using temperature 0.01 for initial design exploration
```
**Why wrong**: Generates nearly identical sequences, misses diversity.

```
✅ Temperature guide:
   - 0.1: Production (low diversity, high quality)
   - 0.2: Default (balanced)
   - 0.3: Exploration (higher diversity)
```

### Wrong: Not fixing important residues
```
❌ Redesigning entire protein including catalytic residues
```

```
✅ Use fixed_positions to preserve:
   - Catalytic residues
   - Disulfide cysteines
   - Known functional residues
   
   params: {"fixed_positions": "A:1-10,A:50-55"}
```

## Tools Reference

### Structure Prediction

**submit_boltz_prediction** - Predict structure with Boltz
```bash
# Get tool info first (always do this!)
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=get_boltz_tool_info" \
  -F 'params={}'

# Submit prediction
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=submit_boltz_prediction" \
  -F 'params={
    "sequences": [
      {"type": "protein", "sequence": "MVLSPADKTNVK..."}
    ],
    "recycling_steps": 3,
    "sampling_steps": 200
  }'
```

**submit_chai_prediction** - Predict with Chai (supports ligands)
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=submit_chai_prediction" \
  -F 'params={
    "fasta_string": ">protein\nMVLSPADKTNVK...",
    "ligand_smiles": "CC(=O)Oc1ccccc1C(=O)O"
  }'
```

### Sequence Design

**submit_proteinmpnn_prediction** - Design sequences for backbone
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=submit_proteinmpnn_prediction" \
  -F 'params={
    "pdb_path": "path/to/backbone.pdb",
    "num_sequences": 8,
    "temperature": 0.1,
    "fixed_positions": "A:1-10"
  }'
```

**submit_ligandmpnn_prediction** - Ligand-aware design
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=submit_ligandmpnn_prediction" \
  -F 'params={
    "pdb_path": "path/to/complex.pdb",
    "num_sequences": 8,
    "temperature": 0.1,
    "design_chains": ["A"],
    "ligand_chain": "X"
  }'
```

### Job Management

All prediction tools return a `job_id`. Poll for completion:

```bash
# Check status
curl -X GET "https://openbio-api.fly.dev/api/v1/jobs/{job_id}/status" \
  -H "X-API-Key: $OPENBIO_API_KEY"

# Get results with download URLs
curl -X GET "https://openbio-api.fly.dev/api/v1/jobs/{job_id}" \
  -H "X-API-Key: $OPENBIO_API_KEY"
```

Download files using `output_files_signed_urls` (valid 1 hour).

## Common Workflows

### Workflow 1: Validate designed binder

```
1. Design binder sequences
   → submit_proteinmpnn_prediction (8-16 sequences)
   
2. Predict complex structure for each
   → submit_boltz_prediction with binder + target
   
3. Filter by confidence
   → Keep predictions with ipTM > 0.6
   
4. Analyze interfaces
   → Check pLDDT at interface residues
   → Discard if interface pLDDT < 70
```

### Workflow 2: Design enzyme with bound substrate

```
1. Start with enzyme-substrate complex PDB
   
2. Design with ligand awareness
   → submit_ligandmpnn_prediction
   → Set design_chains to enzyme, ligand_chain to substrate
   
3. Validate designs
   → submit_chai_prediction for each designed sequence
   → Include substrate SMILES
   
4. Rank by:
   → ipTM (binding confidence)
   → pLDDT at active site
```

### Workflow 3: Improve thermostability

```
1. Get starting structure
   
2. Design thermostable variants
   → submit_thermompnn_prediction
   → Set target_temperature higher than current Tm
   
3. Validate fold is maintained
   → submit_boltz_prediction for each variant
   → Confirm pTM > 0.8
```

## Tool Comparison

| Tool | Input | Output | Best For |
|------|-------|--------|----------|
| Boltz | Sequences | Structure | General prediction, complexes |
| Chai | Sequences + ligand SMILES | Structure | Protein-ligand complexes |
| GeoDock | Structure + ligand | Docked poses | Binding pose prediction |
| ProteinMPNN | Backbone PDB | Sequences | Fixed-backbone design |
| LigandMPNN | Complex PDB | Sequences | Ligand-aware design |
| ThermoMPNN | Structure | Sequences | Thermostability optimization |
| Pinal | Text or structure | Sequences + structures | De novo design from description |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| pTM < 0.5 | Unreliable prediction | Sequence may not fold well, redesign |
| ipTM < 0.4 | Interface not confident | Complex may not form, check sequences |
| All sequences identical | Temperature too low | Increase to 0.2-0.3 |
| Job stuck "running" | Large complex | Wait longer, or simplify input |
| OOM error | Sequence too long | Split into domains |

## Typical Performance

| Job Type | Time | Notes |
|----------|------|-------|
| Boltz (single chain) | 1-3 min | ~300 residues |
| Boltz (complex) | 3-10 min | Depends on size |
| ProteinMPNN (8 seqs) | 30-60 sec | Fast |
| LigandMPNN (8 seqs) | 1-2 min | Slightly slower |

---

**Important**: Always use the `get_*_tool_info` tool first to understand parameters and limits for each prediction tool.
