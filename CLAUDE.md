# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Novogenia Scientific Assistant — a zero-build, zero-dependency web interface for Claude with 139+ scientific skills across 16 categories (bioinformatics, NGS, PGx, cheminformatics, clinical research, ML, etc.). German-language UI, English/German Claude responses based on settings.

## Commands

```bash
npm start          # Start server on http://localhost:3000
node server.js     # Alternative direct start
start.bat          # Windows: Start with console window
```

No build step, no test suite, no linter. All frontend code is vanilla JS loaded directly by the browser.

## Architecture

**Frontend (Browser SPA, no framework):**
- `index.html` → main shell with sidebar, chat, VCF Creator overlay
- `app.js` (~6000 lines) → single `ClaudeScientificApp` class managing all state and UI
- `skills.js` → `SCIENTIFIC_SKILLS` object (16 categories) + `SYSTEM_PROMPTS`
- `skill-ui.js` → `SKILL_UI_TEMPLATES` + `SKILL_TO_TEMPLATE` mapping
- `styles.css` → light theme with orange accents

**Backend:**
- `server.js` (~3680 lines) → Node.js using only built-ins (`http`, `https`, `fs`, `child_process`, `os`). Single monolithic file handling:
  - Static file serving (lines 3623-3647)
  - Claude API proxy with SSE streaming (`/api/chat`, line 89)
  - Python code execution (`/api/execute`, line 728, 2-min timeout)
  - IDAT→VCF genomics pipeline (`/api/create-vcf`, line 921, 1-hour timeout)
  - Scientific database proxies: dbSNP, ClinVar, PubMed/PMC, GWAS, PharmGKB, Ensembl (lines 176-726)
  - Paper search: Google Scholar, ArXiv, HuggingFace, Crawly/BioRxiv (lines 1677-2018)
  - Paper download with 8-method cascading fallback (lines 2220-3615)
  - Paper collection CRUD (`paper_collections/` directory, lines 2021-2240)
  - SNP discovery by gene/phenotype (lines 1356-1676)

**Runtime directories:**
- `temp_papers/` → temporary PDF downloads, auto-cleaned
- `paper_collections/` → persisted paper collection JSON files

**Key data flows:**
1. **Chat:** `sendMessage()` → `callClaudeAPI()` → `handleStreamingResponse()` → `formatMessage()` → UI
2. **Code execution:** Run button → `executeCode()` → `/api/execute` → `detectAndOfferSequenceSave()`
3. **PaperQA:** `startPaperqaAnalysis()` → Claude finds SNPs → `queryAllDatabases()` (11 APIs) → `buildEnhancedPaperqaPrompt()` → Claude analysis → results display
4. **VCF pipeline:** `createVcfFromIdat()` → `/api/create-vcf` → optional Beagle → optional PharmCAT
5. **Skill selection:** Click → `selectSkill()` → `renderSkillUI()` → form → augmented prompt to Claude

## app.js Major Sections

| Section | Lines | Key Methods |
|---------|-------|-------------|
| Init & sidebar | 1-240 | `constructor()`, `init()`, `generateSkillsSidebar()`, `bindElements()` |
| Skill UI rendering | 243-859 | `selectSkill()`, `renderSkillUI()`, `submitSkillUIForm()` |
| Chat & streaming | 866-1047 | `sendMessage()`, `callClaudeAPI()`, `handleStreamingResponse()` |
| Message formatting | 1081-1398 | `formatMessage()` (base64 code blocks, markdown, Run buttons) |
| Code execution | 1285-1398 | `executeCode()` (decodes base64, injects sequences, calls `/api/execute`) |
| Sequence library | 1536-1720 | `addSequence()`, `updateSequenceLibraryUI()` |
| VCF Creator | 2085-2400 | `createVcfFromIdat()`, `scanIdatFiles()` |
| Sequence detection | 2401-2533 | `detectAndOfferSequenceSave()` (6 pattern detectors) |
| PaperQA queries | 3472-3553 | `queryAllDatabases()` (11 parallel DB calls, NCBI staggered) |
| PaperQA analysis | 4434-4866 | `startPaperqaAnalysis()`, `runGeneDiscoveryMode()` |
| Prompt building | 5053-5289 | `buildEnhancedPaperqaPrompt()` |
| Paper downloads | 5626-5672 | `downloadPaperScihub()` (cascading fallback) |
| Paper collections | 5673-5950 | `updatePaperLibraryUI()`, `extractPaperText()` |

## server.js API Endpoints (all POST except where noted)

| Endpoint | Line | Purpose |
|----------|------|---------|
| `/api/chat` | 89 | Claude API proxy with SSE streaming |
| `/api/dbsnp` | 176 | NCBI dbSNP variant lookup (with HTML/retry) |
| `/api/pubmed` | 227 | PubMed + Europe PMC search |
| `/api/clinvar` | 504 | ClinVar clinical significance (with HTML/retry) |
| `/api/gwas` | 587 | GWAS Catalog associations |
| `/api/pharmgkb` | 633 | PharmGKB pharmacogenomics |
| `/api/ensembl` | 686 | Ensembl VEP data |
| `/api/execute` | 728 | Python code execution (2-min timeout) |
| `/api/scan-idat` | 846 | Scan folder for IDAT files |
| `/api/create-vcf` | 921 | IDAT→GTC→VCF pipeline (1-hour timeout) |
| `/api/search-snps-by-gene` | 1356 | SNP discovery by gene name |
| `/api/discover-snps-by-phenotype` | 1465 | SNP discovery by phenotype |
| `/api/arxiv` | 1677 | ArXiv preprint search |
| `/api/huggingface-papers` | 1766 | HuggingFace paper search |
| `/api/crawly-scraper` | 1853 | BioRxiv/MedRxiv scraper |
| `/api/paper-collections` | 2021 | **GET** - List paper collections |
| `/api/save-paper-to-collection` | 2078 | Save paper to collection |
| `/api/open-folder` | 2151 | Open folder in file explorer |
| `/api/delete-paper-collection` | 2186 | Delete paper collection |
| `/api/download-arxiv-pdf` | 2221 | ArXiv PDF direct download |
| `/api/google-scholar` | 2293 | Google Scholar search |
| `/api/unpaywall` | 2417 | Unpaywall OA lookup |
| `/api/download-paper-browser` | 2481 | Browser-based PDF download |
| `/api/download-paper-advanced` | 2628 | Advanced 8-method fallback |
| `/api/scihub-topic-search` | 2940 | Sci-Hub topic search |
| `/api/download-paper-scihub-browser` | 3197 | Sci-Hub via Puppeteer |
| `/api/download-paper-scihub` | 3370 | Direct Sci-Hub download |
| `/api/pmc-fulltext` | 3543 | PMC full-text retrieval |
| `/api/local-models/summarize` | 3935 | Proxy to local summarizer (port 8020) |
| `/api/local-models/rank` | 3968 | Proxy to local relevance ranker (port 8021) |

## Token Reduction Services

Two optional Python services reduce PaperQA input tokens by ~60%:

| Service | File | Port | Model | Size |
|---------|------|------|-------|------|
| Summarizer | `summarizer_service.py` | 8020 | Falconsai/text_summarization | ~250MB |
| Ranker | `relevance_service.py` | 8021 | cross-encoder/ms-marco-MiniLM-L-6-v2 | ~80MB |

**Start:** `python summarizer_service.py` and `python relevance_service.py`
**Integration:** `queryAllDatabases()` calls `rankPapersByRelevance()` then `summarizeAbstracts()` with graceful fallback.

## server.js Helper Functions (lines 15-61)

- `httpsGetFollowRedirects(url, options, maxRedirects)` — Node.js `https.get` does NOT follow redirects natively; this handles 301/302/303/307/308
- `collectResponseBuffer(res)` — Promise-based Buffer collection from streams
- `isValidPdf(buffer)` — Checks `%PDF-` magic bytes and minimum length >100

## NCBI Rate Limiting

NCBI allows ~3 req/sec without API key. When rate-limited, NCBI returns HTML error pages instead of JSON, which crashes `JSON.parse`.

**server.js mitigations:**
- **dbSNP** (line 176): HTML detection (starts with `<` or `<!DOCTYPE`) + retry up to 3x with 1s delay
- **ClinVar** (line 504): HTML detection on both esearch and esummary + 400ms delay between calls
- **PubMed** (line 227): Sequential calls with 400ms delays

**app.js mitigation (`queryAllDatabases`, line ~3472):**
- Non-NCBI APIs (Ensembl, GWAS, Scholar, ArXiv, HF, Crawly, Sci-Hub, PharmGKB): all parallel
- NCBI APIs (dbSNP, PubMed, ClinVar): staggered at 0ms, 400ms, 800ms via `setTimeout`

## State Management

**localStorage (persisted):** `claude_api_key`, `claude_model` (default: `claude-sonnet-4-20250514`), `claude_language` (default: `de`), `vcf_library`, `vcf_imputed_library`, `paper_library`

**In-memory (session only):** `sequenceLibrary`, `messages`, `attachedFiles`

## Adding New Skills

1. Add skill object to category in `skills.js` → `SCIENTIFIC_SKILLS`: `{ id, name, prompt, examples }`
2. Map skill ID in `skill-ui.js` → `SKILL_TO_TEMPLATE` (available templates: `sequence`, `molecule`, `dataAnalysis`, `clinical`, `general`)
3. Skill appears automatically in sidebar

## Python Code Generation Gotchas

These cause frequent runtime errors when generating Python for users:

- **Biopython (v1.86+):** Use `gc_fraction()` not `GC()`. Molecular weight needs unique ATGC only. Trim sequences to multiple of 3 before translation. Remove stop codons: `.replace('*', '')`
- **Scanpy:** Use `.n_vars` not `.n_genes`. Use `n_genes_by_counts` for QC.
- **Sequences:** Always wrap output at 70-80 chars. Use triple-quoted strings for long sequences. Output complete sequences in FASTA format for library detection.
- Sequence detection thresholds: DNA/RNA >100bp, Protein >70aa

## Known Pitfalls When Editing

- **PMID validation** (server.js ~line 315): Threshold is `numId < 50000000` — must be raised as PMIDs grow past this number (~42M in 2026)
- **PMC fulltext** (server.js ~line 3543): API returns Array, code must handle `Array.isArray()` check
- **Paper download Python scripts**: `__file__` resolves to OS temp dir, not project dir — inject absolute path via `PROJECT_DIR` variable
- **scidownl**: Use `sh.fetch()` not `sh.download()` (API changed)
- **LibGen/Sci-Hub SSL**: Use `verify=False` in requests; all domains DNS-blocked on Cisco Umbrella networks
- **index.html**: Has cache-busting via `document.write()` for CSS — `styles.css?v=timestamp`

## VCF Creator

Fullscreen overlay (z-index 10000, outside `app-container`) for IDAT→GTC→VCF pipeline:
- Uses `array-analysis-cli.exe` for conversion (hardcoded Windows paths in `server.js`)
- Optional Beagle imputation via Docker (`erwin23071975/beagle-imputation-v3:latest`)
- Optional PharmCAT analysis via Java JAR
- Chromosome selection: 1-22, X, Y with select-all/indeterminate state

## Tool Paths (Windows, hardcoded in server.js)

```
array-analysis-cli: C:\Users\ErwinSchimak\Desktop\idat\need\array-analysis-cli\array-analysis-cli.exe
BPM Manifest:      C:\Users\ErwinSchimak\Desktop\idat\need\Manifest\NovoScreen01_20032937X376089_A2.bpm
CSV Manifest:      C:\Users\ErwinSchimak\Desktop\idat\need\Manifest\NovoScreen01_20032937X376089_A2.bpm.csv
Cluster File:      C:\Users\ErwinSchimak\Desktop\idat\need\clusterfile\Clusterfile_Final_V137.egt
hg38 FASTA:        C:\Users\ErwinSchimak\Desktop\idat\need\hg38\hg38.fa
Beagle JAR:        C:\Users\ErwinSchimak\Desktop\idat\beagle5.jar
PharmCAT JAR:      C:\Users\ErwinSchimak\Desktop\idat\pharmcat-3.0.0-all.jar
```

## Implementation Details

- Code blocks use base64 encoding to preserve special characters, are protected with placeholders during markdown rendering, then restored with syntax highlighting
- SSE streaming: `data: {"type": "content_block_delta", "delta": {"text": "..."}}` chunks
- `/api/execute` runs arbitrary Python via `spawn` — no sandboxing, trusted environment only
- Version tracking: check browser console for version string from `app.js` line 2-3
- Server binds to `0.0.0.0` and displays local IP on startup
- `formatLongSequences()` auto-wraps biological sequences >70 chars in execution output

## Prerequisites

- **Node.js** 12+, **Python** 3.7+ in PATH
- **Docker** for Beagle imputation, **Java** for Beagle/PharmCAT JARs
- Optional: `npm install puppeteer` (improves paper download to ~85%)
- Optional: `pip install PyPDF2 scholarly requests beautifulsoup4` (full PaperQA)
