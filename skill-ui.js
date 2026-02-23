// Skill UI Configurations - Professional WordPress-like interfaces
// Novogenia Scientific Assistant

const SKILL_UI_TEMPLATES = {
    // Sequence Input Template
    sequence: {
        icon: "🧬",
        title: "Sequenzanalyse",
        description: "Gib deine biologische Sequenz ein und wähle die Analyseparameter.",
        sections: [
            {
                title: "Sequenzeingabe",
                icon: "📋",
                fields: [
                    { type: "textarea", id: "sequence", label: "Sequenz", placeholder: ">header\nATGCGATCGATCG...\n\noder direkt: ATGCGATCGATCG...", rows: 8, icon: "dna" },
                    { type: "select", id: "seqType", label: "Sequenztyp", options: ["Auto-Erkennung", "DNA", "RNA", "Protein"], icon: "type" }
                ]
            },
            {
                title: "Analyse-Optionen",
                icon: "⚙️",
                fields: [
                    { type: "select", id: "analysis", label: "Analyseart", options: ["Basis-Statistik", "Motiv-Suche", "Alignment", "Translation", "Struktur-Vorhersage"], icon: "analysis" },
                    { type: "text", id: "parameters", label: "Zusätzliche Parameter", placeholder: "z.B. E-value=0.001, gap_penalty=-2", icon: "settings" }
                ]
            }
        ],
        quickActions: [
            { label: "DNA-Beispiel", icon: "🧬", action: "load-dna" },
            { label: "Protein-Beispiel", icon: "🔬", action: "load-protein" },
            { label: "FASTA-Format", icon: "📄", action: "format-info" }
        ],
        tips: ["Unterstützt FASTA-Format mit Header", "Automatische Erkennung des Sequenztyps", "Maximale Länge: 100.000 Zeichen"]
    },

    // Molecule/Chemical Input Template
    molecule: {
        icon: "⚗️",
        title: "Molekülanalyse",
        description: "Analysiere chemische Verbindungen und berechne molekulare Eigenschaften.",
        sections: [
            {
                title: "Molekül-Eingabe",
                icon: "🧪",
                fields: [
                    { type: "textarea", id: "molecule", label: "Molekül", placeholder: "SMILES: CC(=O)OC1=CC=CC=C1C(=O)O\noder InChI: InChI=1S/...\noder Name: Aspirin", rows: 4, icon: "molecule" },
                    { type: "select", id: "format", label: "Eingabeformat", options: ["Auto-Erkennung", "SMILES", "InChI", "Molekülname", "MOL/SDF"], icon: "format" }
                ]
            },
            {
                title: "Berechnungen",
                icon: "📊",
                fields: [
                    { type: "multiselect", id: "calculations", label: "Eigenschaften berechnen", options: ["Molekulargewicht", "LogP", "H-Brücken", "Lipinski-Regeln", "TPSA", "Rotierbare Bindungen"], icon: "calculate" }
                ]
            },
            {
                title: "Visualisierung",
                icon: "🎨",
                fields: [
                    { type: "checkbox", id: "show2d", label: "2D-Struktur anzeigen", checked: true },
                    { type: "checkbox", id: "show3d", label: "3D-Konformation generieren" }
                ]
            }
        ],
        quickActions: [
            { label: "Aspirin", icon: "💊", action: "load-aspirin" },
            { label: "Koffein", icon: "☕", action: "load-caffeine" },
            { label: "PubChem suchen", icon: "🔍", action: "search-pubchem" }
        ],
        tips: ["SMILES ist das empfohlene Format", "Nutze PubChem für Struktur-IDs", "3D-Konformation benötigt mehr Zeit"]
    },

    // Data Analysis Template
    dataAnalysis: {
        icon: "📊",
        title: "Statistische Analyse",
        description: "Führe statistische Analysen durch und visualisiere deine Daten.",
        sections: [
            {
                title: "Dateneingabe",
                icon: "📁",
                fields: [
                    { type: "textarea", id: "data", label: "Daten (CSV-Format)", placeholder: "Spalte1,Spalte2,Spalte3\n1.5,2.3,4.1\n2.1,3.4,5.2\n...", rows: 8, icon: "table" },
                    { type: "file", id: "dataFile", label: "oder Datei hochladen", accept: ".csv,.xlsx,.txt,.json", icon: "upload" }
                ]
            },
            {
                title: "Analyse-Einstellungen",
                icon: "⚙️",
                fields: [
                    { type: "select", id: "analysisType", label: "Analyseart", options: ["Deskriptive Statistik", "t-Test", "ANOVA", "Korrelation", "Regression", "Clustering", "PCA"], icon: "chart" },
                    { type: "select", id: "confidence", label: "Konfidenzlevel", options: ["95%", "99%", "90%"], icon: "percent" }
                ]
            },
            {
                title: "Ausgabe",
                icon: "📤",
                fields: [
                    { type: "multiselect", id: "output", label: "Ausgabeformat", options: ["Tabelle", "Grafik", "Python-Code", "R-Code", "Interpretation"], icon: "output" }
                ]
            }
        ],
        quickActions: [
            { label: "Beispieldaten", icon: "📋", action: "load-sample" },
            { label: "Normalverteilung prüfen", icon: "📈", action: "test-normal" },
            { label: "Ausreißer erkennen", icon: "🔍", action: "find-outliers" }
        ],
        tips: ["Erste Zeile wird als Header interpretiert", "Komma oder Semikolon als Trennzeichen", "Fehlende Werte als NA oder leer"]
    },

    // Clinical/Medical Template
    clinical: {
        icon: "🏥",
        title: "Klinische Analyse",
        description: "Analysiere klinische Daten, Varianten und unterstütze die Diagnose.",
        sections: [
            {
                title: "Patientendaten / Variante",
                icon: "👤",
                fields: [
                    { type: "textarea", id: "clinicalData", label: "Klinische Information", placeholder: "Variante: NM_000546.6:c.215C>G (p.Pro72Arg)\noder\nSymptome: ...\noder\nLaborbefund: ...", rows: 6, icon: "medical" }
                ]
            },
            {
                title: "Kontext & Referenzen",
                icon: "📚",
                fields: [
                    { type: "select", id: "context", label: "Klinischer Kontext", options: ["Diagnostik", "Therapieplanung", "Prognose", "Screening", "Forschung"], icon: "context" },
                    { type: "text", id: "guidelines", label: "Leitlinien", placeholder: "z.B. ACMG, ESMO, NCCN", icon: "guidelines" },
                    { type: "select", id: "evidence", label: "Evidenzlevel", options: ["Alle", "Nur klinisch validiert", "Forschung inkludieren"], icon: "evidence" }
                ]
            }
        ],
        quickActions: [
            { label: "BRCA1-Beispiel", icon: "🧬", action: "load-brca" },
            { label: "ICD-10 suchen", icon: "🔍", action: "search-icd" },
            { label: "ClinVar prüfen", icon: "🏥", action: "check-clinvar" }
        ],
        tips: ["HGVS-Nomenklatur für Varianten verwenden", "Immer aktuellste Leitlinien referenzieren", "Evidenzlevel dokumentieren"]
    },

    // Machine Learning Template
    ml: {
        icon: "🤖",
        title: "Machine Learning",
        description: "Entwickle und optimiere ML-Modelle für wissenschaftliche Anwendungen.",
        sections: [
            {
                title: "Problemdefinition",
                icon: "🎯",
                fields: [
                    { type: "textarea", id: "mlTask", label: "ML-Aufgabe beschreiben", placeholder: "Beschreibe dein ML-Problem:\n- Was soll vorhergesagt werden?\n- Welche Daten sind verfügbar?\n- Welche Constraints gibt es?", rows: 6, icon: "task" },
                    { type: "select", id: "taskType", label: "Aufgabentyp", options: ["Klassifikation", "Regression", "Clustering", "Dimensionsreduktion", "Sequenzanalyse", "Bildanalyse", "Generation"], icon: "type" }
                ]
            },
            {
                title: "Modell & Framework",
                icon: "🔧",
                fields: [
                    { type: "select", id: "framework", label: "Framework", options: ["Auto (Empfehlung)", "PyTorch", "TensorFlow/Keras", "Scikit-learn", "XGBoost", "JAX"], icon: "framework" },
                    { type: "select", id: "complexity", label: "Modellkomplexität", options: ["Einfach (Baseline)", "Mittel (Standard)", "Komplex (SOTA)"], icon: "complexity" }
                ]
            },
            {
                title: "Optionen",
                icon: "⚙️",
                fields: [
                    { type: "checkbox", id: "codeGen", label: "Vollständigen Code generieren", checked: true },
                    { type: "checkbox", id: "explain", label: "Modell-Erklärbarkeit (SHAP/LIME)" },
                    { type: "checkbox", id: "hyperopt", label: "Hyperparameter-Optimierung" }
                ]
            }
        ],
        quickActions: [
            { label: "CNN-Template", icon: "🖼️", action: "template-cnn" },
            { label: "Transformer", icon: "🔄", action: "template-transformer" },
            { label: "AutoML", icon: "🤖", action: "automl" }
        ],
        tips: ["Beginne mit einfachen Modellen", "Immer Train/Val/Test Split", "Dokumentiere Hyperparameter"]
    },

    // Database Query Template
    database: {
        icon: "🗄️",
        title: "Datenbankabfrage",
        description: "Suche in wissenschaftlichen Datenbanken und integriere Informationen.",
        sections: [
            {
                title: "Suchanfrage",
                icon: "🔍",
                fields: [
                    { type: "text", id: "query", label: "Suchbegriff", placeholder: "Gen-ID, Protein-Name, UniProt-ID, PubChem-CID...", icon: "search" },
                    { type: "select", id: "database", label: "Datenbank", options: ["Auto (alle)", "UniProt", "PDB", "PubChem", "ChEMBL", "NCBI", "Ensembl", "KEGG", "STRING"], icon: "database" }
                ]
            },
            {
                title: "Filter & Optionen",
                icon: "🎚️",
                fields: [
                    { type: "select", id: "organism", label: "Organismus", options: ["Alle", "Homo sapiens", "Mus musculus", "Rattus norvegicus", "Andere..."], icon: "organism" },
                    { type: "checkbox", id: "crossRef", label: "Cross-Referenzen einbeziehen", checked: true },
                    { type: "checkbox", id: "downloadData", label: "Daten zum Download vorbereiten" }
                ]
            }
        ],
        quickActions: [
            { label: "UniProt", icon: "🔬", action: "search-uniprot" },
            { label: "PDB-Struktur", icon: "🧱", action: "search-pdb" },
            { label: "Literatur", icon: "📚", action: "search-pubmed" }
        ],
        tips: ["Nutze offizielle IDs für präzise Ergebnisse", "Cross-Referenzen liefern mehr Kontext", "API-Limits beachten"]
    },

    // Proteomics Template
    proteomics: {
        icon: "🔬",
        title: "Proteomik-Analyse",
        description: "Analysiere Proteomik-Daten von der Identifizierung bis zur Quantifizierung.",
        sections: [
            {
                title: "Daten-Eingabe",
                icon: "📊",
                fields: [
                    { type: "textarea", id: "msData", label: "Proteinliste / MS-Daten", placeholder: "UniProt-IDs (eine pro Zeile):\nP04637\nP53_HUMAN\n...\n\noder Peptide:\nSEQUENCE,Intensity\n...", rows: 8, icon: "data" },
                    { type: "file", id: "msFile", label: "oder Datei hochladen", accept: ".csv,.xlsx,.txt,.mzML", icon: "upload" }
                ]
            },
            {
                title: "Analyse-Parameter",
                icon: "⚙️",
                fields: [
                    { type: "select", id: "analysisMode", label: "Analysemodus", options: ["Protein-Identifizierung", "Quantifizierung (LFQ)", "Quantifizierung (TMT/iTRAQ)", "PTM-Analyse", "Interaktom"], icon: "mode" },
                    { type: "text", id: "organism", label: "Organismus", placeholder: "Homo sapiens", icon: "organism" },
                    { type: "select", id: "fdr", label: "FDR-Schwelle", options: ["1%", "5%", "10%"], icon: "threshold" }
                ]
            }
        ],
        quickActions: [
            { label: "GO-Enrichment", icon: "📊", action: "go-enrichment" },
            { label: "Pathway-Analyse", icon: "🔀", action: "pathway" },
            { label: "STRING-Netzwerk", icon: "🕸️", action: "string-network" }
        ],
        tips: ["UniProt-IDs sind bevorzugt", "FDR-Korrektur beachten", "Mindestens 3 Replikate empfohlen"]
    },

    // Imaging Template
    imaging: {
        icon: "🖼️",
        title: "Bildanalyse",
        description: "Analysiere biomedizinische Bilder mit KI-unterstützten Methoden.",
        sections: [
            {
                title: "Bildeingabe",
                icon: "📷",
                fields: [
                    { type: "file", id: "imageFile", label: "Bild hochladen", accept: "image/*,.tif,.tiff,.nii,.dcm", icon: "image" },
                    { type: "select", id: "imageType", label: "Bildtyp", options: ["Mikroskopie (Fluoreszenz)", "Mikroskopie (Hellfeld)", "Histopathologie", "Radiologie (CT/MRT)", "Elektronenmikroskopie"], icon: "type" }
                ]
            },
            {
                title: "Analyse-Aufgabe",
                icon: "🎯",
                fields: [
                    { type: "select", id: "task", label: "Aufgabe", options: ["Segmentierung", "Zellzählung", "Klassifikation", "Messung/Morphometrie", "Colocalization", "Tracking"], icon: "task" },
                    { type: "text", id: "channels", label: "Kanäle/Marker", placeholder: "z.B. DAPI, GFP, mCherry", icon: "channels" }
                ]
            }
        ],
        quickActions: [
            { label: "Zellen segmentieren", icon: "🔬", action: "segment-cells" },
            { label: "Intensität messen", icon: "📊", action: "measure-intensity" },
            { label: "Beispielbild", icon: "🖼️", action: "load-example" }
        ],
        tips: ["TIFF für beste Qualität", "Kalibrierung angeben für Messungen", "Mehrkanal-Bilder werden unterstützt"]
    },

    // Materials/Physics Template
    materials: {
        icon: "🔧",
        title: "Materialwissenschaft",
        description: "Berechne Materialeigenschaften und führe Simulationen durch.",
        sections: [
            {
                title: "Struktur-Eingabe",
                icon: "🧱",
                fields: [
                    { type: "textarea", id: "structure", label: "Struktur / Formel", placeholder: "Summenformel: Fe2O3\noder POSCAR/CIF-Format\noder XYZ-Koordinaten", rows: 6, icon: "structure" },
                    { type: "select", id: "structureType", label: "Eingabetyp", options: ["Summenformel", "CIF", "POSCAR", "XYZ", "SMILES (Molekül)"], icon: "format" }
                ]
            },
            {
                title: "Berechnung",
                icon: "🔬",
                fields: [
                    { type: "select", id: "calculation", label: "Berechnung", options: ["Eigenschaften vorhersagen", "Geometrie-Optimierung", "Bandstruktur", "Phononen", "MD-Simulation"], icon: "calc" },
                    { type: "select", id: "method", label: "Methode", options: ["Empirisch (schnell)", "Semi-empirisch", "DFT (GGA)", "DFT (Hybrid)", "ML-Potential"], icon: "method" }
                ]
            }
        ],
        quickActions: [
            { label: "Perowskit", icon: "🧱", action: "load-perovskite" },
            { label: "Bandlücke", icon: "⚡", action: "calc-bandgap" },
            { label: "Materials Project", icon: "🔍", action: "search-mp" }
        ],
        tips: ["CIF-Format für Kristallstrukturen", "DFT-Berechnungen sind rechenintensiv", "ML-Potentiale für große Systeme"]
    },

    // Multi-Omics Template
    multiomics: {
        icon: "🧪",
        title: "Multi-Omics Integration",
        description: "Integriere verschiedene Omics-Datentypen für Systembiologie-Analysen.",
        sections: [
            {
                title: "Omics-Daten",
                icon: "📊",
                fields: [
                    { type: "textarea", id: "omicsData", label: "Genliste / Expressionsdaten", placeholder: "Gen-IDs oder Expressionswerte:\nGENE1\t2.5\nGENE2\t-1.3\n...", rows: 6, icon: "data" },
                    { type: "multiselect", id: "omicsTypes", label: "Datentypen", options: ["Transcriptomics", "Proteomics", "Metabolomics", "Genomics", "Epigenomics"], icon: "types" }
                ]
            },
            {
                title: "Analyse",
                icon: "🔬",
                fields: [
                    { type: "select", id: "integration", label: "Integrationsmethode", options: ["Pathway-Enrichment", "Netzwerk-Analyse", "Multi-Block PLS", "MOFA", "Korrelation"], icon: "integration" },
                    { type: "text", id: "organism", label: "Organismus", placeholder: "Homo sapiens", icon: "organism" }
                ]
            }
        ],
        quickActions: [
            { label: "GO-Enrichment", icon: "📊", action: "go-enrichment" },
            { label: "KEGG-Pathways", icon: "🔀", action: "kegg-pathways" },
            { label: "Netzwerk", icon: "🕸️", action: "network" }
        ],
        tips: ["Einheitliche Gen-IDs verwenden", "Log2-Fold-Change für Differenzanalyse", "p-Werte für Signifikanz angeben"]
    },

    // Communication Template
    communication: {
        icon: "📝",
        title: "Wissenschaftliches Schreiben",
        description: "Erstelle und verbessere wissenschaftliche Texte und Dokumente.",
        sections: [
            {
                title: "Inhalt",
                icon: "✍️",
                fields: [
                    { type: "textarea", id: "content", label: "Text / Inhalt", placeholder: "Füge deinen Text ein oder beschreibe, was du schreiben möchtest...", rows: 8, icon: "text" }
                ]
            },
            {
                title: "Dokument-Einstellungen",
                icon: "📄",
                fields: [
                    { type: "select", id: "docType", label: "Dokumenttyp", options: ["Paper (Abstract)", "Paper (Methods)", "Paper (Results)", "Paper (Discussion)", "Grant-Antrag", "Review", "Präsentation", "Poster"], icon: "doctype" },
                    { type: "select", id: "style", label: "Stil", options: ["Wissenschaftlich-formal", "Wissenschaftlich-verständlich", "Populärwissenschaftlich", "Technisch-präzise"], icon: "style" },
                    { type: "select", id: "language", label: "Sprache", options: ["Deutsch", "Englisch", "Beide (Übersetzung)"], icon: "language" }
                ]
            }
        ],
        quickActions: [
            { label: "Abstract schreiben", icon: "📋", action: "write-abstract" },
            { label: "Stil verbessern", icon: "✨", action: "improve-style" },
            { label: "Übersetzen", icon: "🌐", action: "translate" }
        ],
        tips: ["Klare, präzise Formulierungen", "Aktiv statt Passiv bevorzugen", "Fachbegriffe konsistent verwenden"]
    },

    // Lab Automation Template
    labAutomation: {
        icon: "🔬",
        title: "Laborautomatisierung",
        description: "Erstelle Protokolle und automatisiere Laborabläufe.",
        sections: [
            {
                title: "Protokoll",
                icon: "📋",
                fields: [
                    { type: "textarea", id: "protocol", label: "Protokoll / Workflow", placeholder: "Beschreibe den Laborprozess:\n1. ...\n2. ...\n\noder füge ein bestehendes Protokoll ein", rows: 6, icon: "protocol" }
                ]
            },
            {
                title: "Automatisierung",
                icon: "🤖",
                fields: [
                    { type: "select", id: "platform", label: "Plattform", options: ["Generisch", "Hamilton", "Tecan", "Beckman", "Opentrons", "Andere"], icon: "platform" },
                    { type: "number", id: "samples", label: "Anzahl Proben", placeholder: "96", icon: "samples" },
                    { type: "select", id: "plateFormat", label: "Plattenformat", options: ["96-Well", "384-Well", "24-Well", "6-Well", "Tubes"], icon: "plate" }
                ]
            }
        ],
        quickActions: [
            { label: "Plate-Layout", icon: "🔲", action: "plate-layout" },
            { label: "QC-Checks", icon: "✅", action: "qc-checks" },
            { label: "Pipettier-Script", icon: "💧", action: "pipette-script" }
        ],
        tips: ["Immer Kontrollen einplanen", "Dead-Volume berücksichtigen", "Plate-Maps dokumentieren"]
    },

    // Engineering Template
    engineering: {
        icon: "⚙️",
        title: "Engineering & Simulation",
        description: "Technische Berechnungen und Prozesssimulationen.",
        sections: [
            {
                title: "Problem-Definition",
                icon: "🎯",
                fields: [
                    { type: "textarea", id: "problem", label: "Technisches Problem", placeholder: "Beschreibe das zu lösende Problem:\n- System\n- Randbedingungen\n- Zielgrößen", rows: 6, icon: "problem" }
                ]
            },
            {
                title: "Simulation",
                icon: "💻",
                fields: [
                    { type: "select", id: "domain", label: "Bereich", options: ["CFD (Strömung)", "FEM (Struktur)", "Prozesssimulation", "Bioreaktor", "Wärmeübertragung", "Sensordaten"], icon: "domain" },
                    { type: "text", id: "constraints", label: "Randbedingungen", placeholder: "T=37°C, p=1atm, Material=...", icon: "constraints" }
                ]
            }
        ],
        quickActions: [
            { label: "Beispiel-Setup", icon: "📋", action: "example-setup" },
            { label: "Formelsammlung", icon: "📐", action: "formulas" },
            { label: "Einheiten", icon: "📏", action: "units" }
        ],
        tips: ["SI-Einheiten verwenden", "Randbedingungen vollständig angeben", "Konvergenz prüfen"]
    },

    // Protein Engineering Template
    proteinEngineering: {
        icon: "🧬",
        title: "Protein Engineering",
        description: "Designe und optimiere Proteine für spezifische Anwendungen.",
        sections: [
            {
                title: "Protein-Eingabe",
                icon: "🔬",
                fields: [
                    { type: "textarea", id: "proteinSeq", label: "Protein-Sequenz / ID", placeholder: "Aminosäuresequenz:\nMKWVTFISLLFSSAYS...\n\noder UniProt-ID: P04637", rows: 6, icon: "protein" },
                    { type: "text", id: "pdbId", label: "PDB-ID (optional)", placeholder: "z.B. 1TUP", icon: "structure" }
                ]
            },
            {
                title: "Engineering-Ziel",
                icon: "🎯",
                fields: [
                    { type: "select", id: "goal", label: "Optimierungsziel", options: ["Thermostabilität", "Katalytische Aktivität", "Substratspezifität", "Expression/Löslichkeit", "Bindungsaffinität", "Immunogenität reduzieren"], icon: "goal" },
                    { type: "text", id: "mutations", label: "Bekannte Mutationen", placeholder: "z.B. A123V, K45R, del56-60", icon: "mutations" }
                ]
            },
            {
                title: "Methoden",
                icon: "🧪",
                fields: [
                    { type: "checkbox", id: "alphafold", label: "AlphaFold-Struktur verwenden", checked: true },
                    { type: "checkbox", id: "evolutionary", label: "Evolutionäre Analyse (MSA)" },
                    { type: "checkbox", id: "ddg", label: "ΔΔG-Vorhersage für Mutationen" }
                ]
            }
        ],
        quickActions: [
            { label: "AlphaFold", icon: "🔮", action: "alphafold" },
            { label: "Hotspots finden", icon: "🎯", action: "find-hotspots" },
            { label: "Stabilität", icon: "💪", action: "stability" }
        ],
        tips: ["Strukturinformation verbessert Vorhersagen", "MSA für konservierte Positionen", "Kombinatorische Mutationen testen"]
    },

    // NGS Pipeline Template
    ngs: {
        icon: "🧬",
        title: "NGS-Pipeline",
        description: "Konfiguriere und analysiere Next-Generation Sequencing Pipelines für WGS, WES und RNA-seq.",
        sections: [
            {
                title: "Daten-Eingabe",
                icon: "📁",
                fields: [
                    { type: "textarea", id: "samples", label: "Samples / FASTQ-Pfade", placeholder: "Sample1_R1.fastq.gz, Sample1_R2.fastq.gz\nSample2_R1.fastq.gz, Sample2_R2.fastq.gz\n\noder Sample-Sheet im CSV-Format", rows: 5, icon: "files" },
                    { type: "select", id: "dataType", label: "Sequenzierungstyp", options: ["WGS (Whole Genome)", "WES (Whole Exome)", "RNA-seq", "Amplicon/Panel", "ChIP-seq", "ATAC-seq"], icon: "type" },
                    { type: "select", id: "readType", label: "Read-Typ", options: ["Paired-End", "Single-End"], icon: "reads" }
                ]
            },
            {
                title: "Pipeline-Konfiguration",
                icon: "⚙️",
                fields: [
                    { type: "select", id: "reference", label: "Referenzgenom", options: ["GRCh38/hg38", "GRCh37/hg19", "GRCm39/mm39", "GRCm38/mm10", "Andere..."], icon: "genome" },
                    { type: "select", id: "aligner", label: "Aligner", options: ["BWA-MEM2 (DNA)", "STAR (RNA-seq)", "HISAT2 (RNA-seq)", "Bowtie2", "minimap2"], icon: "align" },
                    { type: "select", id: "variantCaller", label: "Variant Caller", options: ["GATK HaplotypeCaller (Germline)", "DeepVariant (Germline)", "Mutect2 (Somatic)", "Strelka2", "FreeBayes", "Keine"], icon: "variants" }
                ]
            },
            {
                title: "Analyse-Optionen",
                icon: "🔬",
                fields: [
                    { type: "checkbox", id: "qc", label: "QC-Report (FastQC/MultiQC)", checked: true },
                    { type: "checkbox", id: "trimming", label: "Adapter-Trimming (fastp)", checked: true },
                    { type: "checkbox", id: "duplicates", label: "Duplicate-Marking", checked: true },
                    { type: "checkbox", id: "bqsr", label: "Base Quality Score Recalibration" },
                    { type: "checkbox", id: "annotation", label: "Varianten-Annotation (VEP/ANNOVAR)" },
                    { type: "checkbox", id: "cnv", label: "CNV-Analyse" }
                ]
            },
            {
                title: "Output-Format",
                icon: "📤",
                fields: [
                    { type: "select", id: "framework", label: "Pipeline-Framework", options: ["Nextflow", "Snakemake", "Shell-Script", "Python-Code"], icon: "framework" },
                    { type: "select", id: "executor", label: "Execution", options: ["Lokal", "SLURM", "PBS", "AWS Batch", "Google Cloud"], icon: "executor" }
                ]
            }
        ],
        quickActions: [
            { label: "nf-core/sarek", icon: "🧬", action: "nfcore-sarek" },
            { label: "RNA-seq DE", icon: "📊", action: "rnaseq-de" },
            { label: "QC-Pipeline", icon: "✅", action: "qc-pipeline" },
            { label: "Somatic Calling", icon: "🔬", action: "somatic-calling" }
        ],
        tips: [
            "Für klinische Analysen: nf-core/sarek empfohlen",
            "RNA-seq: Strand-spezifisches Protokoll angeben",
            "WES: BED-Datei für Target-Regions erforderlich",
            "Mindestens 30x Coverage für Germline Variant Calling",
            "Biostars Q&A für Troubleshooting nutzen"
        ]
    },

    // PGx Pipeline Template
    pgx: {
        icon: "💊",
        title: "Pharmakogenomik-Analyse",
        description: "Analysiere pharmakogenetische Daten mit IDAT/VCF-Erstellung, Beagle Imputation, PharmCAT und Interpretation.",
        sections: [
            {
                title: "IDAT/Array-Daten",
                icon: "🔬",
                fields: [
                    { type: "file", id: "idatFiles", label: "IDAT-Dateien (Grn + Red)", accept: ".idat", icon: "idat" },
                    { type: "file", id: "sampleSheet", label: "SampleSheet.csv", accept: ".csv", icon: "sheet" },
                    { type: "file", id: "finalReport", label: "oder FinalReport (CSV/TXT)", accept: ".csv,.txt", icon: "report" },
                    { type: "text", id: "sentrixCode", label: "Sentrix-Code", placeholder: "z.B. 207532370044_R01C01", icon: "barcode" }
                ]
            },
            {
                title: "VCF-Eingabe / Bibliothek",
                icon: "🧬",
                fields: [
                    { type: "file", id: "vcfFile", label: "VCF-Datei hochladen", accept: ".vcf,.vcf.gz", icon: "upload" },
                    { type: "select", id: "vcfLibrary", label: "oder aus Bibliothek wählen", options: ["-- Keine --"], icon: "library", dynamic: true },
                    { type: "textarea", id: "vcfContent", label: "oder VCF-Inhalt einfügen", placeholder: "##fileformat=VCFv4.2\n#CHROM\tPOS\tID\tREF\tALT\t...", rows: 4, icon: "vcf" }
                ]
            },
            {
                title: "Pipeline-Konfiguration",
                icon: "⚙️",
                fields: [
                    { type: "select", id: "pipeline", label: "Pipeline", options: ["IDAT → VCF → PharmCAT", "VCF → PharmCAT", "VCF → Beagle → PharmCAT", "PyPGx/Stargazer", "Dual-Pipeline", "Novogenia Pipeline"], icon: "pipeline" },
                    { type: "select", id: "assembly", label: "Referenzgenom", options: ["GRCh38 (empfohlen)", "GRCh37/hg19"], icon: "genome" },
                    { type: "text", id: "sampleId", label: "Sample-ID", placeholder: "z.B. Sample_001", icon: "sample" }
                ]
            },
            {
                title: "Beagle Imputation",
                icon: "📊",
                fields: [
                    { type: "checkbox", id: "useBeagle", label: "Beagle Imputation durchführen" },
                    { type: "text", id: "beagleJar", label: "Beagle JAR Pfad", placeholder: "C:/path/to/beagle5.jar", icon: "jar" },
                    { type: "text", id: "refPanelDir", label: "Referenz-Panel (bref3)", placeholder: "C:/path/to/bref3_hg38/", icon: "ref" },
                    { type: "text", id: "gpFilter", label: "GP-Filter", placeholder: "0.9", icon: "filter" }
                ]
            },
            {
                title: "Gene & Optionen",
                icon: "🧪",
                fields: [
                    { type: "multiselect", id: "genes", label: "Gene", options: ["Alle PGx-Gene", "CYP2D6", "CYP2C19", "CYP2C9", "CYP3A5", "CYP4F2", "DPYD", "TPMT", "NUDT15", "SLCO1B1", "UGT1A1", "VKORC1"], icon: "genes" },
                    { type: "checkbox", id: "preprocessing", label: "VCF Preprocessing", checked: true },
                    { type: "checkbox", id: "strandCorrection", label: "Strand-Korrektur (Minus-SNPs)", checked: true },
                    { type: "checkbox", id: "outsideCalls", label: "Outside Calls verwenden" },
                    { type: "checkbox", id: "saveVcf", label: "VCF in Bibliothek speichern", checked: true },
                    { type: "checkbox", id: "interpretation", label: "Klinische Interpretation", checked: true }
                ]
            }
        ],
        quickActions: [
            { label: "IDAT → VCF", icon: "🔄", action: "idat-to-vcf" },
            { label: "Beagle", icon: "📊", action: "beagle-impute" },
            { label: "PharmCAT", icon: "💊", action: "run-pharmcat" },
            { label: "Interpret", icon: "📋", action: "interpret" }
        ],
        tips: [
            "IDAT: Grn + Red Channel pro Sample nötig",
            "Beagle braucht Referenz-Panels pro Chromosom",
            "GP-Filter ≥0.9 für zuverlässige Imputation",
            "Minus-Strand SNPs werden automatisch korrigiert"
        ]
    },

    // NGS LLM Template (für Agentic AI, R2MED, Biostars)
    ngsLlm: {
        icon: "🤖",
        title: "NGS AI-Assistent",
        description: "Intelligente NGS-Analyse mit spezialisierten AI-Modellen.",
        sections: [
            {
                title: "Anfrage",
                icon: "❓",
                fields: [
                    { type: "textarea", id: "query", label: "Deine Frage / Analyse-Anfrage", placeholder: "Beschreibe dein NGS-Problem oder füge Daten ein...\n\nBeispiele:\n- Warum habe ich viele unmapped Reads?\n- Interpretiere diese VCF-Varianten\n- Erstelle einen QC-Report", rows: 8, icon: "question" },
                    { type: "file", id: "dataFile", label: "Daten hochladen (optional)", accept: ".vcf,.vcf.gz,.bam,.fastq,.fastq.gz,.csv,.txt", icon: "upload" }
                ]
            },
            {
                title: "Kontext",
                icon: "📋",
                fields: [
                    { type: "select", id: "analysisType", label: "Analyse-Typ", options: ["Allgemein", "Variant Interpretation", "QC-Troubleshooting", "Pipeline-Design", "Klinische Analyse", "RNA-seq", "Somatic"], icon: "type" },
                    { type: "select", id: "experience", label: "Erfahrungslevel", options: ["Anfänger", "Fortgeschritten", "Experte"], icon: "level" }
                ]
            }
        ],
        quickActions: [
            { label: "VCF analysieren", icon: "🧬", action: "analyze-vcf" },
            { label: "QC-Problem lösen", icon: "🔧", action: "qc-troubleshoot" },
            { label: "Best Practices", icon: "📚", action: "best-practices" },
            { label: "Tool-Vergleich", icon: "⚖️", action: "tool-comparison" }
        ],
        tips: [
            "Je mehr Kontext, desto bessere Antworten",
            "Fehlermeldungen vollständig einfügen",
            "Relevante Parameter und Versionen angeben"
        ]
    },

    // Default/General Template
    general: {
        icon: "💡",
        title: "Allgemeine Anfrage",
        description: "Stelle eine wissenschaftliche Frage oder beschreibe dein Problem.",
        sections: [
            {
                title: "Deine Anfrage",
                icon: "❓",
                fields: [
                    { type: "textarea", id: "question", label: "Frage / Aufgabe", placeholder: "Beschreibe deine wissenschaftliche Frage oder Aufgabe so detailliert wie möglich...", rows: 8, icon: "question" }
                ]
            },
            {
                title: "Kontext",
                icon: "📚",
                fields: [
                    { type: "select", id: "field", label: "Fachgebiet", options: ["Allgemein", "Biologie", "Chemie", "Physik", "Medizin", "Informatik", "Andere"], icon: "field" },
                    { type: "select", id: "depth", label: "Detailtiefe", options: ["Übersicht", "Standard", "Detailliert", "Experten-Level"], icon: "depth" }
                ]
            }
        ],
        quickActions: [
            { label: "Literatursuche", icon: "📚", action: "literature" },
            { label: "Code generieren", icon: "💻", action: "code" },
            { label: "Erklärung", icon: "💡", action: "explain" }
        ],
        tips: ["Je mehr Kontext, desto besser die Antwort", "Spezifische Fragen führen zu präzisen Antworten", "Angabe des Fachgebiets hilft"]
    }
};

// Map each skill to its UI template
const SKILL_TO_TEMPLATE = {
    // Bioinformatics
    "sequence-analysis": "sequence",
    "single-cell-rnaseq": "sequence",
    "gene-networks": "dataAnalysis",
    "variant-annotation": "clinical",
    "phylogenetics": "sequence",
    "genome-assembly": "sequence",
    "rna-structure": "sequence",
    "epigenomics": "sequence",
    "metagenomics": "sequence",
    "structural-bioinformatics": "sequence",
    "transcriptomics": "dataAnalysis",
    "chip-seq": "sequence",
    "gwas": "dataAnalysis",
    "cnv-analysis": "clinical",
    "long-read-seq": "sequence",
    "primer-design": "sequence",

    // NGS Pipelines & Tools
    "ngs-pipe-eth": "ngs",
    "vivaxgen-ngs": "ngs",
    "tjblaette-ngs": "ngs",
    "gunnarschotta-ngs": "ngs",
    "ngs-llm-agentic": "ngsLlm",
    "r2med-bioinfo": "ngsLlm",
    "biostars-qa": "ngsLlm",
    "ngs-general": "ngs",

    // PGx & Pharmakogenomik
    "idat-to-vcf": "pgx",
    "beagle-imputation": "pgx",
    "vcf-creator": "pgx",
    "pharmcat": "pgx",
    "stargazer-pypgx": "pgx",
    "pgx-dual-pipeline": "pgx",
    "pgx-novogenia": "pgx",
    "pgx-interpretation": "pgx",

    // Cheminformatics
    "molecular-properties": "molecule",
    "virtual-screening": "molecule",
    "admet-analysis": "molecule",
    "molecular-docking": "molecule",
    "lead-optimization": "molecule",
    "retrosynthesis": "molecule",
    "qsar-modeling": "molecule",
    "compound-clustering": "molecule",
    "structure-drawing": "molecule",
    "reaction-prediction": "molecule",

    // Clinical
    "clinical-trials": "clinical",
    "pharmacogenomics": "clinical",
    "variant-interpretation": "clinical",
    "drug-safety": "clinical",
    "clinical-decision": "clinical",
    "biomarker-discovery": "dataAnalysis",
    "survival-analysis": "dataAnalysis",
    "epidemiology": "dataAnalysis",
    "medical-coding": "clinical",
    "real-world-evidence": "dataAnalysis",
    "patient-stratification": "clinical",
    "health-economics": "dataAnalysis",

    // ML
    "deep-learning": "ml",
    "reinforcement-learning": "ml",
    "time-series": "ml",
    "interpretability": "ml",
    "bayesian-methods": "ml",
    "neural-networks": "ml",
    "transfer-learning": "ml",
    "active-learning": "ml",
    "generative-models": "ml",
    "graph-neural-networks": "ml",
    "nlp-scientific": "ml",
    "automl": "ml",
    "federated-learning": "ml",
    "anomaly-detection": "ml",
    "ensemble-methods": "ml",

    // Data Analysis
    "statistical-analysis": "dataAnalysis",
    "network-analysis": "dataAnalysis",
    "publication-figures": "dataAnalysis",
    "eda": "dataAnalysis",
    "dimensionality-reduction": "dataAnalysis",
    "clustering": "dataAnalysis",
    "missing-data": "dataAnalysis",
    "meta-analysis": "dataAnalysis",
    "regression-advanced": "dataAnalysis",
    "causal-inference": "dataAnalysis",
    "multivariate": "dataAnalysis",
    "bootstrap-permutation": "dataAnalysis",
    "spatial-analysis": "dataAnalysis",
    "interactive-viz": "dataAnalysis",

    // Databases
    "uniprot": "database",
    "pubchem": "database",
    "chembl": "database",
    "pubmed": "database",
    "biorxiv": "database",
    "clinvar": "database",
    "cosmic": "database",
    "kegg": "database",
    "reactome": "database",
    "pdb": "database",
    "ensembl": "database",
    "ncbi": "database",
    "drugbank": "database",
    "string": "database",
    "omim": "database",
    "gwas-catalog": "database",

    // Proteomics
    "protein-identification": "proteomics",
    "mass-spec-analysis": "proteomics",
    "ptm-analysis": "proteomics",
    "protein-quantification": "proteomics",
    "interactomics": "proteomics",
    "targeted-proteomics": "proteomics",
    "structural-proteomics": "proteomics",

    // Imaging
    "image-analysis": "imaging",
    "digital-pathology": "imaging",
    "radiology-ai": "imaging",
    "microscopy": "imaging",
    "image-registration": "imaging",
    "cryo-em": "imaging",
    "flow-cytometry": "imaging",

    // Materials
    "materials-prediction": "materials",
    "quantum-chemistry": "materials",
    "crystallography": "materials",
    "molecular-dynamics": "materials",
    "spectroscopy": "materials",
    "thermodynamics": "materials",
    "polymer-science": "materials",

    // Multi-Omics
    "pathway-analysis": "multiomics",
    "integration": "multiomics",
    "systems-modeling": "multiomics",
    "metabolomics": "multiomics",
    "lipidomics": "multiomics",
    "spatial-transcriptomics": "multiomics",

    // Communication
    "paper-writing": "communication",
    "grant-writing": "communication",
    "literature-review": "communication",
    "presentation": "communication",
    "peer-review": "communication",
    "data-management": "communication",
    "reproducibility": "communication",
    "science-communication": "communication",

    // Lab Automation
    "protocol-design": "labAutomation",
    "automation-scripts": "labAutomation",
    "lims": "labAutomation",
    "quality-control": "labAutomation",
    "high-throughput-screening": "labAutomation",

    // Engineering
    "cfd": "engineering",
    "fem": "engineering",
    "process-simulation": "engineering",
    "bioprocess": "engineering",
    "sensor-data": "engineering",

    // Protein Engineering
    "protein-design": "proteinEngineering",
    "antibody-engineering": "proteinEngineering",
    "enzyme-engineering": "proteinEngineering",
    "alphafold": "proteinEngineering",
    "peptide-design": "proteinEngineering"
};

// Get UI template for a skill
function getSkillUI(skillId) {
    const templateName = SKILL_TO_TEMPLATE[skillId] || "general";
    return SKILL_UI_TEMPLATES[templateName];
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SKILL_UI_TEMPLATES, SKILL_TO_TEMPLATE, getSkillUI };
}
