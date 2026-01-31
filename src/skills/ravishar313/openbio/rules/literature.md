# Literature Search Tools

Search scientific literature across PubMed, arXiv, bioRxiv, and OpenAlex via OpenBio API.

## When to Use

Use literature tools when:
1. Finding papers on a research topic
2. Getting abstracts for specific papers
3. Tracking recent preprints in a field
4. Finding publications by an author
5. Building reference lists for proposals

## Decision Tree

```
What literature do you need?
│
├─ Peer-reviewed biomedical papers?
│   └─ search_pubmed (25M+ papers, MeSH indexed)
│
├─ Recent preprints (not yet peer-reviewed)?
│   ├─ Biology/life sciences → biorxiv_search_keywords
│   ├─ Computational/physics/math → arxiv_search
│   └─ Last week's papers → biorxiv_recent_papers
│
├─ Comprehensive search (any field)?
│   └─ search_literature (OpenAlex, 240M+ works)
│
├─ Find papers by author?
│   ├─ Biomedical → search_pubmed with author query
│   ├─ Preprints → biorxiv_search_author
│   └─ Any field → search_authors + get_author_works
│
└─ Get specific paper details?
    ├─ Have PubMed ID → fetch_abstract
    ├─ Have DOI → get_paper (OpenAlex)
    └─ Want full text → fetch_full_text (if available)
```

## Search Strategy

### PubMed Query Construction

**Basic search**: Terms ANDed automatically
```
"CRISPR gene editing cancer"
→ Finds papers containing all three concepts
```

**Boolean operators**:
```
(CRISPR OR "gene editing") AND cancer AND therapy
→ Explicit control over logic
```

**Field-specific search**:
```
Smith J[Author]           # Author search
Nature[Journal]           # Journal filter
2023[pdat]                # Publication date
review[pt]                # Publication type
"breast cancer"[MeSH]     # MeSH term (controlled vocabulary)
```

**Date ranges**:
```
2020:2024[pdat]           # Range
"last 5 years"[pdat]      # Relative
```

### Query Quality Tips

| Goal | Query Strategy |
|------|----------------|
| High precision | Use MeSH terms, narrow date range |
| High recall | Use synonyms with OR, broader terms |
| Recent advances | Filter by date, check preprints too |
| Specific protein | Include gene names AND protein names |

## Common Mistakes

### Wrong: Overly broad queries
```
❌ search_pubmed: "cancer"
   → Returns millions of results, unhelpful
```

```
✅ Be specific:
   "EGFR inhibitor resistance lung cancer 2020:2024[pdat]"
   → Focused, recent, actionable results
```

### Wrong: Missing synonyms
```
❌ Searching only "Alzheimer's disease"
   → Misses papers using "Alzheimer disease" (no apostrophe)
```

```
✅ Use OR for synonyms:
   ("Alzheimer's disease" OR "Alzheimer disease" OR AD)
   Or use MeSH: "Alzheimer Disease"[MeSH]
```

### Wrong: Ignoring preprints for fast-moving fields
```
❌ Only searching PubMed for AI/ML in biology
   → Missing 3-6 months of recent work
```

```
✅ For rapidly evolving fields:
   1. search_pubmed for established work
   2. biorxiv_recent_papers for last 30 days
   3. arxiv_search for computational methods
```

### Wrong: Not using MeSH terms
```
❌ "heart attack" (colloquial)
   → Inconsistent indexing
```

```
✅ "Myocardial Infarction"[MeSH]
   → Standardized term, better recall
```

## Tools Reference

### PubMed Search

**search_pubmed** - Search with query
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=search_pubmed" \
  -F 'params={"query": "CRISPR gene editing 2024", "max_results": 10}'
```

**fetch_abstract** - Get specific paper
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=fetch_abstract" \
  -F 'params={"pubmed_id": "36812345"}'
```

**fetch_full_text** - Get full text (if available via PMC)
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=fetch_full_text" \
  -F 'params={"pubmed_id": "36812345"}'
```

### Preprint Search

**biorxiv_search_keywords** - Search bioRxiv
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=biorxiv_search_keywords" \
  -F 'params={"keywords": "protein folding deep learning", "max_results": 10}'
```

**biorxiv_recent_papers** - Get recent preprints
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=biorxiv_recent_papers" \
  -F 'params={"server": "biorxiv", "days": 7}'
```

**arxiv_search** - Search arXiv
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=arxiv_search" \
  -F 'params={"query": "machine learning protein structure", "max_results": 10}'
```

### OpenAlex (Comprehensive)

**search_literature** - Search 240M+ works
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=search_literature" \
  -F 'params={"query": "deep learning drug discovery", "per_page": 25}'
```

**get_paper** - Get paper by DOI
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=get_paper" \
  -F 'params={"identifier": "10.1038/s41586-021-03819-2"}'
```

**search_authors** - Find researchers
```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=search_authors" \
  -F 'params={"query": "Jennifer Doudna"}'
```

## Common Workflows

### Workflow 1: Literature review on a topic

```
1. Start with PubMed for established work
   → search_pubmed with MeSH terms + date filter
   → Get 20-50 relevant papers
   
2. Check recent preprints
   → biorxiv_search_keywords (last 6 months)
   → May find unpublished advances
   
3. Identify key authors
   → Note frequently appearing names
   → search_authors to find their full output
   
4. Get full abstracts for key papers
   → fetch_abstract for top candidates
   → fetch_full_text if available
```

### Workflow 2: Track field developments

```
1. Weekly preprint check
   → biorxiv_recent_papers (days: 7)
   → Filter by keywords in results
   
2. Monthly PubMed check
   → search_pubmed with date filter
   → Look for newly published work
   
3. Alert on key authors
   → get_author_works for leaders in field
   → Check for new publications
```

### Workflow 3: Find methods papers

```
For computational biology methods:

1. arXiv first
   → arxiv_search: "method name algorithm"
   → Often published here before journal
   
2. Then bioRxiv
   → biorxiv_search_keywords
   → Biology-focused methods
   
3. Finally PubMed
   → For peer-reviewed version
   → May be 6-12 months behind preprints
```

## Tool Comparison

| Tool | Coverage | Best For |
|------|----------|----------|
| PubMed | 35M biomedical papers | Clinical, biomedical research |
| bioRxiv | Life sciences preprints | Recent biology discoveries |
| arXiv | Physics, CS, math preprints | ML/AI methods |
| OpenAlex | 240M+ all fields | Comprehensive, citation data |

## Response Data

PubMed results include:
- `pubmed_id` - PMID for retrieval
- `title` - Paper title
- `abstract` - Full abstract text
- `authors` - Author list
- `journal` - Publication venue
- `publication_date` - When published
- `doi` - Digital Object Identifier
- `pmc_id` - PubMed Central ID (if open access)
- `mesh_terms` - MeSH subject headings

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Too many results | Query too broad | Add more specific terms, date filter |
| Too few results | Query too narrow | Use synonyms with OR, remove filters |
| No full text | Not in PMC | Check publisher site directly |
| Preprint not found | Posted to different server | Try both bioRxiv and arXiv |

---

**Tip**: Use `pubmed_query_helper` tool if you're unsure how to construct an effective PubMed query.
