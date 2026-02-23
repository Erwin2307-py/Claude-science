# Novogenia Scientific Assistant

Web-Interface für Claude mit 139+ wissenschaftlichen Skills für Bioinformatik, NGS-Pipelines, Pharmakogenomik, Cheminformatik und mehr.

## Features

- **139+ Scientific Skills** in 16 Kategorien (Bioinformatik, Genomik, ML, Cheminformatik, etc.)
- **PaperQA System** - Automatisierte Literaturrecherche mit 9+ Datenquellen
- **VCF Creator** - IDAT→GTC→VCF Pipeline mit Beagle Imputation und PharmCAT
- **Code Execution** - Server-side Python-Code-Ausführung für Analysen
- **Zero-Build Architecture** - Kein Build-Step, keine npm Dependencies im Core

## Quick Start

```bash
# 1. Server starten
npm start
# oder
node server.js

# 2. Browser öffnen
http://localhost:3000

# 3. API-Key eingeben (Settings Button)
# Claude API Key von console.anthropic.com
```

## Installation

### Core Installation (Minimal)

```bash
# Keine npm install nötig - zero dependencies!
# Python muss installiert sein
python --version  # Sollte 3.7+ sein
```

### Erweiterte Installation (Für vollständige PaperQA-Funktionalität)

#### 1. Python-Bibliotheken

```bash
# Core (erforderlich für PDF-Extraktion)
pip install PyPDF2

# Google Scholar Suche (optional, stark empfohlen)
pip install scholarly

# Multi-Source Scraper (optional, für BioRxiv/MedRxiv)
pip install requests beautifulsoup4

# Advanced Paper Download (optional, erhöht Erfolgsrate auf ~90%)
pip install scihub scidownl

# Alternative für maximale Abdeckung:
pip install scihub-api libgen-cli
```

**Empfohlenes Setup für maximale Paper-Download-Rate:**
```bash
pip install PyPDF2 scholarly requests beautifulsoup4 scihub scidownl
```

**Download-Methoden nach Installation:**
- Basis: PMC API, Unpaywall, Sci-Hub Mirrors (~60%)
- + scihub/scidownl: ~75% Erfolgsrate
- + Puppeteer: ~85% Erfolgsrate
- Alle zusammen: **~90% Erfolgsrate**

#### 2. Node.js Puppeteer (Optional)

```bash
# Für Browser-basiertes PDF-Download
npm install puppeteer

# Unter Linux zusätzlich erforderlich:
sudo apt-get install -y chromium-browser
```

## PaperQA System - Erweiterte Literatursuche

Das PaperQA-System durchsucht **9+ wissenschaftliche Datenbanken** parallel:

### Datenquellen

1. **PubMed/PMC/Europe PMC** - Biomedizinische Literatur mit automatischem Full-Text-Download
2. **Google Scholar** - Breiteste akademische Abdeckung (benötigt `pip install scholarly`)
3. **ArXiv** - Preprints mit direktem PDF-Download
4. **HuggingFace Daily Papers** - Aktuelle ML/AI-Papers
5. **BioRxiv/MedRxiv** - Biologie/Medizin Preprints via Scraper
6. **GWAS Catalog** - Genetische Assoziationsstudien
7. **ClinVar** - Klinische Varianten
8. **PharmGKB** - Pharmakogenetik
9. **Ensembl** - Variant Effect Predictor

### Paper-Download-Methoden (Kaskadierende Fallbacks)

Das System versucht automatisch mehrere Methoden für vollständigen Text-Download:

1. **ArXiv Direct** - Direkte PDF-Downloads von ArXiv-Preprints
2. **PMC Full-Text API** - Kostenlose Volltexte über NCBI
3. **Unpaywall** - Open-Access-Versionen von Publishern
4. **Sci-Hub** - Mehrere Mirror-Fallbacks (10+ Server)
5. **Browser PDF Capture** - Puppeteer-basiertes PDF-Rendering

**Erfolgsrate**: 60-80% der Papers mit Volltext je nach Datenquelle.

### 3 Analyse-Modi

1. **SNPs Given** - Analysiere Literatur für bekannte SNPs (rs-IDs)
2. **Search SNPs** - AI entdeckt SNPs für ein Gen, analysiert dann Literatur
3. **Discover Genes/SNPs** - Vollständige Gen/SNP-Discovery für eine Forschungsfrage

### Features

- Multi-Tab UI (Input, Log, Results, Report)
- SNP-File-Upload (.txt, .csv)
- Erweiterte Filter (Meta-Studien, große Kohorten, Ethnien)
- Export: Excel, PDF-Report, Clipboard
- Echtzeit-Logging der Analyse

## Token-Reduktion (Lokale ML-Services)

Zwei optionale Python-Services reduzieren den Token-Verbrauch der PaperQA-Analyse um **~60%**:

| Service | Datei | Port | Modell | RAM |
|---------|-------|------|--------|-----|
| Abstract-Summarizer | `summarizer_service.py` | 8020 | Falconsai/text_summarization | ~250MB |
| Relevanz-Ranker | `relevance_service.py` | 8021 | cross-encoder/ms-marco-MiniLM-L-6-v2 | ~80MB |

### Installation & Start

```bash
# 1. Abhängigkeiten installieren (einmalig)
pip install transformers sentence-transformers torch

# 2. Services starten (jeweils eigenes Terminal)
python summarizer_service.py    # Port 8020
python relevance_service.py     # Port 8021

# 3. Health-Check
curl http://localhost:8020/health
curl http://localhost:8021/health
```

### Wie es funktioniert

1. **Relevanz-Ranker**: Bewertet alle gefundenen Papers nach Relevanz zur Forschungsfrage, behält nur die Top-10 (statt 20-40)
2. **Abstract-Summarizer**: Komprimiert Paper-Abstracts von ~400 auf ~80 Tokens
3. **Prompt-Komprimierung**: Analyse-Instruktionen von 67 auf 25 Zeilen gestrafft

**Fallback**: Wenn die Services nicht laufen, funktioniert PaperQA wie bisher mit allen Original-Abstracts.

### Token-Ersparnis

| Maßnahme | Ersparnis |
|----------|-----------|
| Relevanz-Filter (20→10 Papers) | ~4.000 Tokens |
| Abstract-Summarizer | ~6.400 Tokens |
| Prompt-Komprimierung | ~500 Tokens |
| **Gesamt** | **~10.900 Tokens (~64%)** |

Status der Services ist in den **Settings** sichtbar (Summarizer/Ranker Online/Offline).

## VCF Creator

Konvertiert IDAT-Files (Illumina Microarrays) zu VCF mit optionaler Imputation:

```
IDAT → GTC → VCF → Beagle Imputation → PharmCAT
```

- **Chromosomen-Auswahl**: 1-22, X, Y
- **Beagle Imputation**: Via Docker (erwin23071975/beagle-imputation-v3:latest)
- **PharmCAT**: Automatische pharmakogenetische Analyse

## Technische Details

### Zero-Dependency-Architektur

- **Frontend**: Vanilla JavaScript, kein Build-Step
- **Backend**: Node.js Built-ins nur (http, https, fs, child_process)
- **Optional Dependencies**: puppeteer (für Browser-PDF-Download)

### Datenverwaltung

- **localStorage**: API-Key, Model, Language, VCF Libraries
- **Session-only**: Sequence Library, Messages, Attached Files
- **Temp Files**: PDFs in `temp_papers/`, automatisch bereinigt

### API-Endpoints

Siehe CLAUDE.md für vollständige API-Dokumentation.

## Entwicklung

### Neue Skills hinzufügen

Siehe CLAUDE.md → "Adding New Skills" Sektion.

### Debugging

```bash
# Browser Console
- DevTools → Console für Frontend-Logs
- DevTools → Network für API-Calls
- localStorage für gespeicherte Daten

# Server Console
- Python stdout/stderr wird erfasst
- API-Requests mit Timestamps
```

## Troubleshooting

### PaperQA: "No papers found"

**Lösung 1 - Google Scholar installieren:**
```bash
pip install scholarly
```

**Lösung 2 - Alternativen aktivieren:**
- ArXiv (funktioniert ohne Dependencies)
- Europe PMC (bereits integriert)
- Crawly Scraper (benötigt beautifulsoup4)

### Browser-PDF-Download schlägt fehl

```bash
# Puppeteer installieren
npm install puppeteer

# Linux: Chrome dependencies
sudo apt-get install -y chromium-browser
```

### Code Execution: "Python not found"

```bash
# Python zu PATH hinzufügen (Windows)
# System Properties → Environment Variables → PATH

# Oder voller Pfad in server.js:
const pythonProcess = spawn('C:\\Python39\\python.exe', ...)
```

## Systemanforderungen

- **OS**: Windows, Linux, macOS
- **Node.js**: 12+
- **Python**: 3.7+
- **RAM**: 4GB+ (8GB empfohlen für VCF-Imputation)
- **Disk**: 10GB+ (für temp PDFs und VCF-Files)
- **Docker**: Optional, für Beagle Imputation

## Lizenz

MIT License

## Support

Für Bugs und Feature-Requests siehe CLAUDE.md Dokumentation.
