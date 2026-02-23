// Novogenia Scientific Assistant - Main Application
// VERSION: 2026-01-29-v2 (with all endpoint fixes)
console.log('🔧 APP.JS VERSION: 2026-01-29-v2 (Endpoints Fixed)');

class ClaudeScientificApp {
    constructor() {
        console.log('Novogenia Scientific Assistant initializing...');
        this.apiKey = localStorage.getItem('claude_api_key') || '';
        this.model = localStorage.getItem('claude_model') || 'claude-sonnet-4-20250514';
        this.language = localStorage.getItem('claude_language') || 'de';
        this.currentSkill = null;
        this.currentCategory = null;
        this.messages = [];
        this.attachedFiles = [];
        this.isLoading = false;
        this.sequenceLibrary = [];
        this.vcfLibrary = JSON.parse(localStorage.getItem('vcf_library') || '[]');
        this.vcfImputedLibrary = JSON.parse(localStorage.getItem('vcf_imputed_library') || '[]');
        this.paperLibrary = JSON.parse(localStorage.getItem('paper_library') || '[]');

        this.init();
    }

    init() {
        try {
            this.generateSkillsSidebar();
            this.bindElements();
            this.bindEvents();
            this.loadSettings();
            this.checkApiKey();
            this.checkLocalModelStatus();
            this.updateVcfLibraryUI();
            this.updateVcfImputedLibraryUI();
            this.updatePaperLibraryUI();
            console.log('App successfully initialized!');
        } catch (error) {
            console.error('Error during initialization:', error);
        }
    }

    generateSkillsSidebar() {
        const container = document.getElementById('skill-categories');
        if (!container || typeof SCIENTIFIC_SKILLS === 'undefined') {
            console.error('Skills could not be loaded');
            return;
        }

        // Count total skills
        let totalSkills = 0;
        Object.values(SCIENTIFIC_SKILLS).forEach(cat => {
            totalSkills += cat.skills.length;
        });

        // Create header
        container.innerHTML = `<h3>Scientific Skills (${totalSkills})</h3>`;

        // Generate categories and skills
        Object.entries(SCIENTIFIC_SKILLS).forEach(([categoryKey, categoryData]) => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category';
            categoryDiv.dataset.category = categoryKey;

            categoryDiv.innerHTML = `
                <div class="category-header">
                    <span class="category-icon">${categoryData.icon}</span>
                    <span class="category-name">${categoryData.name}</span>
                    <span class="category-count">${categoryData.skills.length}</span>
                    <span class="category-arrow">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </span>
                </div>
                <ul class="category-skills hidden">
                    ${categoryData.skills.map(skill => `
                        <li class="skill-item" data-skill="${skill.id}" title="${skill.examples ? skill.examples[0] : ''}">${skill.name}</li>
                    `).join('')}
                </ul>
            `;

            container.appendChild(categoryDiv);
        });

        console.log(`${totalSkills} Skills in ${Object.keys(SCIENTIFIC_SKILLS).length} categories loaded`);
    }

    bindCategoryEvents() {
        // Get freshly generated categories
        const categories = document.querySelectorAll('.category');
        console.log(`Binding events for ${categories.length} categories`);

        categories.forEach(category => {
            const header = category.querySelector('.category-header');
            const skillsList = category.querySelector('.category-skills');

            if (header) {
                header.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleCategory(category);
                });
            }

            if (skillsList) {
                const skills = skillsList.querySelectorAll('li');
                skills.forEach(skill => {
                    skill.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.selectSkill(skill, category);
                    });
                });
            }
        });
    }

    bindElements() {
        // Main elements
        this.chatContainer = document.getElementById('chat-container');
        this.messagesContainer = document.getElementById('messages');
        this.welcomeScreen = document.getElementById('welcome-screen');
        this.messageInput = document.getElementById('message-input');
        this.sendBtn = document.getElementById('send-btn');
        this.attachBtn = document.getElementById('attach-btn');
        this.fileInput = document.getElementById('file-input');
        this.newChatBtn = document.getElementById('new-chat-btn');
        this.activeSkillDisplay = document.getElementById('active-skill-display');

        // Skill info panel
        this.skillInfoPanel = document.getElementById('skill-info-panel');
        this.skillInfoTitle = document.getElementById('skill-info-title');
        this.skillInfoDescription = document.getElementById('skill-info-description');
        this.skillInfoExamplesList = document.getElementById('skill-info-examples-list');
        this.closeSkillInfoBtn = document.getElementById('close-skill-info');

        // Settings modal
        this.settingsBtn = document.getElementById('settings-btn');
        this.settingsModal = document.getElementById('settings-modal');
        this.closeSettingsBtn = document.getElementById('close-settings');
        this.saveSettingsBtn = document.getElementById('save-settings');
        this.apiKeyInput = document.getElementById('api-key');
        this.modelSelect = document.getElementById('model-select');
        this.languageSelect = document.getElementById('language-select');

        // Sequence library
        this.sequenceLibraryBtn = document.getElementById('sequence-library-btn');
        this.sequenceLibraryPanel = document.getElementById('sequence-library-panel');
        this.sequenceLibraryContent = document.getElementById('sequence-library-content');
        this.closeSequenceLibraryBtn = document.getElementById('close-sequence-library');
        this.clearSequencesBtn = document.getElementById('clear-sequences-btn');
        this.sequenceCountEl = document.getElementById('sequence-count');

        // Paper Library
        this.paperLibraryBtn = document.getElementById('paper-library-btn');
        this.paperLibraryPanel = document.getElementById('paper-library-panel');
        this.paperLibraryContent = document.getElementById('paper-library-content');
        this.closePaperLibraryBtn = document.getElementById('close-paper-library');
        this.clearPapersBtn = document.getElementById('clear-papers-btn');
        this.paperCountEl = document.getElementById('paper-count');

        // VCF Library (Raw)
        this.vcfLibraryBtn = document.getElementById('vcf-library-btn');
        this.vcfLibraryPanel = document.getElementById('vcf-library-panel');
        this.vcfLibraryContent = document.getElementById('vcf-library-content');
        this.closeVcfLibraryBtn = document.getElementById('close-vcf-library');
        this.clearVcfBtn = document.getElementById('clear-vcf-btn');
        this.vcfCountEl = document.getElementById('vcf-count');

        // VCF Library (Imputed)
        this.vcfImputedLibraryBtn = document.getElementById('vcf-imputed-library-btn');
        this.vcfImputedLibraryPanel = document.getElementById('vcf-imputed-library-panel');
        this.vcfImputedLibraryContent = document.getElementById('vcf-imputed-library-content');
        this.closeVcfImputedLibraryBtn = document.getElementById('close-vcf-imputed-library');
        this.clearVcfImputedBtn = document.getElementById('clear-vcf-imputed-btn');
        this.vcfImputedCountEl = document.getElementById('vcf-imputed-count');

        // VCF Creator
        this.vcfCreatorBtn = document.getElementById('vcf-creator-btn');
        this.vcfCreatorPanel = document.getElementById('vcf-creator-panel');
        this.closeVcfCreatorBtn = document.getElementById('close-vcf-creator');
        this.idatFolderPath = document.getElementById('idat-folder-path');
        this.idatFileInput = document.getElementById('idat-file-input');
        this.samplesheetInput = document.getElementById('samplesheet-input');
        this.vcfReference = document.getElementById('vcf-reference');
        this.vcfOutputDir = document.getElementById('vcf-output-dir');
        this.useBeagleCheckbox = document.getElementById('use-beagle-imputation');
        this.useDockerCheckbox = document.getElementById('use-docker');
        this.beagleJarPath = document.getElementById('beagle-jar-path');
        this.beagleRefPath = document.getElementById('beagle-ref-path');
        this.beagleGpFilter = document.getElementById('beagle-gp-filter');
        this.usePharmcatCheckbox = document.getElementById('use-pharmcat');
        this.pharmcatJarPath = document.getElementById('pharmcat-jar-path');
        this.vcfMethod = document.getElementById('vcf-method');
        this.arrayTypeSelect = document.getElementById('array-type-select');
        this.manifestPath = document.getElementById('manifest-path');
        this.clusterPath = document.getElementById('cluster-path');
        this.csvManifestPath = document.getElementById('csv-manifest-path');
        this.genomeFastaPath = document.getElementById('genome-fasta-path');
        this.vcfSamplesList = document.getElementById('vcf-samples-list');
        this.scanIdatBtn = document.getElementById('scan-idat-btn');
        this.createVcfBtn = document.getElementById('create-vcf-btn');
        this.vcfCreatorLog = document.getElementById('vcf-creator-log');
        this.vcfLogContent = document.getElementById('vcf-log-content');
        this.selectAllChromosomes = document.getElementById('select-all-chromosomes');
        this.chromosomeGrid = document.getElementById('chromosome-grid');

        // PaperQA
        this.paperqaBtn = document.getElementById('paperqa-btn');
        this.paperqaPanel = document.getElementById('paperqa-panel');
        this.closePaperqaBtn = document.getElementById('close-paperqa');
        this.paperqaTopic = document.getElementById('paperqa-topic');
        this.paperqaContext = document.getElementById('paperqa-context');
        this.paperqaSnps = document.getElementById('paperqa-snps');
        this.paperqaSnpFile = document.getElementById('paperqa-file-input');
        this.paperqaStartBtn = document.getElementById('paperqa-analyze-btn');
        this.paperqaExportBtn = document.getElementById('download-excel-btn');
        this.paperqaCopyBtn = document.getElementById('copy-results-btn');
        this.paperqaReportBtn = document.getElementById('download-report-btn');
        this.paperqaResults = document.getElementById('paperqa-results');
        this.paperqaResultsSection = document.getElementById('paperqa-results-section');
        this.paperqaLogContainer = document.getElementById('paperqa-log');
        this.paperqaLog = document.getElementById('paperqa-log-content');
        this.paperqaSnpSection = document.getElementById('snp-input-section');

        // PaperQA Enhanced UI Elements
        this.paperqaTabButtons = document.querySelectorAll('.paperqa-tab');
        this.paperqaTabPanes = document.querySelectorAll('.paperqa-tab-pane');
        this.snpCountEl = document.getElementById('snp-count');
        this.fileDropZone = document.getElementById('file-drop-zone');
        this.fileInfo = document.getElementById('file-info');
        this.removeFileBtn = document.getElementById('remove-file');
        this.progressOverlay = document.getElementById('progress-overlay');
        this.progressTitle = document.getElementById('progress-title');
        this.progressMessage = document.getElementById('progress-message');
        this.resultsSearch = document.getElementById('results-search');
        this.filterBtns = document.querySelectorAll('.filter-btn');
        this.statSnps = document.getElementById('stat-snps');
        this.statPapers = document.getElementById('stat-papers');
        this.statGwas = document.getElementById('stat-gwas');
        this.statClinvar = document.getElementById('stat-clinvar');
        this.resultsBadge = document.getElementById('results-badge');
    }

    bindEvents() {
        // Input events
        this.messageInput.addEventListener('input', () => this.handleInputChange());
        this.messageInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.sendBtn.addEventListener('click', () => this.sendMessage());

        // File attachment
        this.attachBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // New chat
        this.newChatBtn.addEventListener('click', () => this.startNewChat());

        // Settings
        this.settingsBtn.addEventListener('click', () => this.openSettings());
        this.closeSettingsBtn.addEventListener('click', () => this.closeSettings());
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        this.settingsModal.querySelector('.modal-overlay').addEventListener('click', () => this.closeSettings());

        // Skill info panel
        if (this.closeSkillInfoBtn) {
            this.closeSkillInfoBtn.addEventListener('click', () => this.hideSkillInfo());
        }

        // Sequence library
        if (this.sequenceLibraryBtn) {
            this.sequenceLibraryBtn.addEventListener('click', () => this.toggleSequenceLibrary());
        }
        if (this.closeSequenceLibraryBtn) {
            this.closeSequenceLibraryBtn.addEventListener('click', () => this.closeSequenceLibrary());
        }
        if (this.clearSequencesBtn) {
            this.clearSequencesBtn.addEventListener('click', () => this.clearSequenceLibrary());
        }

        // Paper Library
        if (this.paperLibraryBtn) {
            this.paperLibraryBtn.addEventListener('click', () => this.togglePaperLibrary());
        }
        if (this.closePaperLibraryBtn) {
            this.closePaperLibraryBtn.addEventListener('click', () => this.closePaperLibrary());
        }
        if (this.clearPapersBtn) {
            this.clearPapersBtn.addEventListener('click', () => this.clearPaperLibrary());
        }

        // VCF Library
        if (this.vcfLibraryBtn) {
            this.vcfLibraryBtn.addEventListener('click', () => this.toggleVcfLibrary());
        }
        if (this.closeVcfLibraryBtn) {
            this.closeVcfLibraryBtn.addEventListener('click', () => this.closeVcfLibrary());
        }
        if (this.clearVcfBtn) {
            this.clearVcfBtn.addEventListener('click', () => this.clearVcfLibrary());
        }

        // VCF Imputed Library
        if (this.vcfImputedLibraryBtn) {
            this.vcfImputedLibraryBtn.addEventListener('click', () => this.toggleVcfImputedLibrary());
        }
        if (this.closeVcfImputedLibraryBtn) {
            this.closeVcfImputedLibraryBtn.addEventListener('click', () => this.closeVcfImputedLibrary());
        }
        if (this.clearVcfImputedBtn) {
            this.clearVcfImputedBtn.addEventListener('click', () => this.clearVcfImputedLibrary());
        }

        // VCF Creator
        if (this.vcfCreatorBtn) {
            this.vcfCreatorBtn.addEventListener('click', () => this.toggleVcfCreator());
        }
        if (this.closeVcfCreatorBtn) {
            this.closeVcfCreatorBtn.addEventListener('click', () => this.closeVcfCreator());
        }
        if (this.scanIdatBtn) {
            this.scanIdatBtn.addEventListener('click', () => this.scanIdatFiles());
        }
        if (this.createVcfBtn) {
            this.createVcfBtn.addEventListener('click', () => this.createVcfFromIdat());
        }
        if (this.arrayTypeSelect) {
            this.arrayTypeSelect.addEventListener('change', () => this.updateArrayPaths());
        }
        if (this.useBeagleCheckbox) {
            this.useBeagleCheckbox.addEventListener('change', () => this.toggleBeagleOptions());
        }
        if (this.usePharmcatCheckbox) {
            this.usePharmcatCheckbox.addEventListener('change', () => this.togglePharmcatOptions());
        }
        if (this.idatFileInput) {
            this.idatFileInput.addEventListener('change', (e) => this.handleIdatFileSelect(e));
        }
        // Chromosome selection
        if (this.selectAllChromosomes) {
            this.selectAllChromosomes.addEventListener('change', () => this.toggleAllChromosomes());
        }
        if (this.chromosomeGrid) {
            this.chromosomeGrid.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox') {
                    this.updateSelectAllChromosomeState();
                }
            });
        }

        // PaperQA
        if (this.paperqaBtn) {
            this.paperqaBtn.addEventListener('click', () => this.togglePaperqa());
        }
        if (this.closePaperqaBtn) {
            this.closePaperqaBtn.addEventListener('click', () => this.closePaperqa());
        }
        if (this.paperqaStartBtn) {
            console.log('PaperQA Start Button bound:', this.paperqaStartBtn);
            this.paperqaStartBtn.addEventListener('click', () => {
                console.log('PaperQA Button clicked!');
                this.startPaperqaAnalysis();
            });
        } else {
            console.log('PaperQA uses inline onclick handlers (no separate button binding needed)');
        }
        if (this.paperqaExportBtn) {
            this.paperqaExportBtn.addEventListener('click', () => this.exportPaperqaResults('excel'));
        }
        if (this.paperqaCopyBtn) {
            this.paperqaCopyBtn.addEventListener('click', () => this.copyPaperqaResults());
        }
        if (this.paperqaReportBtn) {
            this.paperqaReportBtn.addEventListener('click', () => this.exportPaperqaResults('report'));
        }
        if (this.paperqaSnpFile) {
            this.paperqaSnpFile.addEventListener('change', (e) => this.handleSnpFileUpload(e));
        }
        // PaperQA Mode selection
        document.querySelectorAll('input[name="paperqa-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.handlePaperqaModeChange(e));
        });
        // PaperQA Output format selection
        document.querySelectorAll('input[name="output-format"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.handlePaperqaOutputChange(e));
        });

        // PaperQA Enhanced UI - Tabs
        this.paperqaTabButtons.forEach(tab => {
            tab.addEventListener('click', (e) => this.switchPaperqaTab(e));
        });

        // PaperQA Enhanced UI - Input Method Toggle
        document.querySelectorAll('.input-method').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchSnpInputMethod(e));
        });

        // PaperQA Enhanced UI - SNP Counter
        if (this.paperqaSnps) {
            this.paperqaSnps.addEventListener('input', () => this.updateSnpCounter());
        }

        // PaperQA Enhanced UI - File Drop Zone
        if (this.fileDropZone) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                this.fileDropZone.addEventListener(eventName, (e) => this.handleFileDragDrop(e), false);
            });
        }

        // PaperQA Enhanced UI - Remove File Button
        if (this.removeFileBtn) {
            this.removeFileBtn.addEventListener('click', () => this.removeSnpFile());
        }

        // PaperQA Enhanced UI - Results Filtering
        this.filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.filterPaperqaResults(e));
        });

        // PaperQA Enhanced UI - Results Search
        if (this.resultsSearch) {
            this.resultsSearch.addEventListener('input', (e) => this.searchPaperqaResults(e));
        }

        // Category toggles - bind after dynamic generation
        this.bindCategoryEvents();

        // Quick actions
        document.querySelectorAll('.quick-action').forEach(btn => {
            btn.addEventListener('click', () => {
                const prompt = btn.dataset.prompt;
                this.messageInput.value = prompt;
                this.handleInputChange();
                this.messageInput.focus();
            });
        });

        // Auto-resize textarea
        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 200) + 'px';
        });
    }

    handleInputChange() {
        const hasContent = this.messageInput.value.trim().length > 0;
        this.sendBtn.disabled = !hasContent || this.isLoading;
    }

    handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!this.sendBtn.disabled) {
                this.sendMessage();
            }
        }
    }

    toggleCategory(category) {
        console.log('Category clicked:', category.dataset.category);
        const skillsList = category.querySelector('.category-skills');

        if (!skillsList) {
            console.error('Skills list not found!');
            return;
        }

        const isOpen = !skillsList.classList.contains('hidden');
        console.log('Is open:', isOpen);

        // Close all other categories
        document.querySelectorAll('.category').forEach(cat => {
            const skills = cat.querySelector('.category-skills');
            if (skills) {
                skills.classList.add('hidden');
            }
            cat.classList.remove('active');
            cat.classList.remove('open');
        });

        // Toggle current category
        if (!isOpen) {
            skillsList.classList.remove('hidden');
            category.classList.add('active');
            category.classList.add('open');
            console.log('Category opened');
        } else {
            console.log('Category closed');
        }
    }

    selectSkill(skillElement, category) {
        console.log('Skill selected:', skillElement.dataset.skill);

        // Remove active class from all skills
        document.querySelectorAll('.category-skills li').forEach(s => s.classList.remove('active'));

        // Add active class to selected skill
        skillElement.classList.add('active');

        const categoryId = category.dataset.category;
        const skillId = skillElement.dataset.skill;
        const skillName = skillElement.textContent.trim();

        // Update display immediately
        this.activeSkillDisplay.textContent = skillName;

        // Default skill info
        let skillDescription = `The skill "${skillName}" is now active. Enter your question in the input field below.`;
        let skillExamples = [`Help me with ${skillName}`, `Explain ${skillName} to me`, `Analyze...`];

        // Find skill in our data
        if (typeof SCIENTIFIC_SKILLS !== 'undefined') {
            const categoryData = Object.values(SCIENTIFIC_SKILLS).find(cat =>
                cat.skills && cat.skills.some(s => s.id === skillId)
            );

            if (categoryData) {
                const skill = categoryData.skills.find(s => s.id === skillId);
                this.currentSkill = skill;
                this.currentCategory = categoryData;
                console.log('Skill activated:', skill.name);

                // Get skill description and examples
                if (skill.prompt) {
                    skillDescription = skill.prompt;
                }
                if (skill.examples && skill.examples.length > 0) {
                    skillExamples = skill.examples;
                    this.messageInput.placeholder = `z.B.: ${skill.examples[0]}`;
                }
            }
        }

        // Clear previous chat when switching skills
        this.messages = [];
        this.messagesContainer.innerHTML = '';

        // Show skill info panel
        this.showSkillInfo(skillName, skillDescription, skillExamples);

        // Hide welcome screen
        this.welcomeScreen.classList.add('hidden');

        // Visual feedback - flash the display
        this.activeSkillDisplay.style.transform = 'scale(1.1)';
        this.activeSkillDisplay.style.transition = 'transform 0.2s ease';
        setTimeout(() => {
            this.activeSkillDisplay.style.transform = 'scale(1)';
        }, 200);

        // Focus input
        this.messageInput.focus();
    }

    showSkillInfo(title, description, examples) {
        if (!this.skillInfoPanel) return;

        this.skillInfoTitle.textContent = `${title} - Guide`;
        this.skillInfoDescription.textContent = description;

        // Clear and populate examples
        this.skillInfoExamplesList.innerHTML = '';
        examples.forEach(example => {
            const li = document.createElement('li');
            li.textContent = example;
            li.addEventListener('click', () => {
                this.messageInput.value = example;
                this.handleInputChange();
                this.messageInput.focus();
            });
            this.skillInfoExamplesList.appendChild(li);
        });

        this.skillInfoPanel.classList.add('active');

        // Render skill-specific UI if available
        this.renderSkillUI();
    }

    renderSkillUI() {
        // Get or create skill UI container
        let skillUIContainer = document.getElementById('skill-ui-container');
        if (!skillUIContainer) {
            skillUIContainer = document.createElement('div');
            skillUIContainer.id = 'skill-ui-container';
            skillUIContainer.className = 'skill-ui-container';
            this.skillInfoPanel.appendChild(skillUIContainer);
        }

        // Get UI template for current skill
        if (!this.currentSkill || typeof getSkillUI === 'undefined') {
            skillUIContainer.innerHTML = '';
            return;
        }

        const ui = getSkillUI(this.currentSkill.id);
        if (!ui) {
            skillUIContainer.innerHTML = '';
            return;
        }

        // Build WordPress-like UI
        let html = `<div class="skill-ui-panel">
            <!-- Hero Header -->
            <div class="skill-ui-main-header">
                <div class="skill-ui-main-header-content">
                    <div class="skill-ui-main-icon">${ui.icon}</div>
                    <h2 class="skill-ui-main-title">${ui.title || this.currentSkill.name}</h2>
                    <p class="skill-ui-main-description">${ui.description || ''}</p>
                </div>
            </div>

            <!-- Body with Sections -->
            <div class="skill-ui-body">
                <div class="skill-ui-sections">`;

        // Render each section
        if (ui.sections) {
            ui.sections.forEach(section => {
                html += `
                    <div class="skill-ui-section">
                        <div class="skill-ui-section-header">
                            <div class="skill-ui-section-icon">${section.icon}</div>
                            <span class="skill-ui-section-title">${section.title}</span>
                        </div>
                        <div class="skill-ui-section-body">
                            <div class="skill-ui-fields">`;

                section.fields.forEach(field => {
                    html += this.renderField(field);
                });

                html += `
                            </div>
                        </div>
                    </div>`;
            });
        }

        html += `
                </div>
            </div>

            <!-- Quick Actions Bar -->
            <div class="skill-ui-quick-bar">
                <span class="skill-ui-quick-label">Quick Actions:</span>
                <div class="skill-ui-quick-actions">
                    ${ui.quickActions ? ui.quickActions.map(action => `
                        <button class="skill-ui-quick-btn" data-action="${action.action}">
                            <span class="skill-ui-quick-btn-icon">${action.icon}</span>
                            ${action.label}
                        </button>
                    `).join('') : ''}
                </div>
            </div>

            <!-- Tips -->
            ${ui.tips ? `
            <div class="skill-ui-tips">
                <div class="skill-ui-tips-title">
                    <span>💡</span> Tipps
                </div>
                <div class="skill-ui-tips-list">
                    ${ui.tips.map(tip => `<div class="skill-ui-tip">${tip}</div>`).join('')}
                </div>
            </div>
            ` : ''}

            <!-- Submit Footer -->
            <div class="skill-ui-footer">
                <button class="skill-ui-submit" id="skill-ui-submit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    <span class="skill-ui-submit-text">
                        <span class="skill-ui-submit-main">Start Analysis</span>
                        <span class="skill-ui-submit-sub">Send request to Claude</span>
                    </span>
                </button>
            </div>
        </div>`;

        skillUIContainer.innerHTML = html;

        // Bind events
        this.bindSkillUIEvents(skillUIContainer);
    }

    renderField(field) {
        let html = `<div class="skill-ui-field">`;

        switch (field.type) {
            case 'textarea':
                html += `
                    <label class="skill-ui-field-label" for="skill-${field.id}">${field.label}</label>
                    <textarea id="skill-${field.id}"
                        placeholder="${field.placeholder || ''}"
                        rows="${field.rows || 4}"></textarea>`;
                break;
            case 'text':
                html += `
                    <label class="skill-ui-field-label" for="skill-${field.id}">${field.label}</label>
                    <input type="text" id="skill-${field.id}"
                        placeholder="${field.placeholder || ''}">`;
                break;
            case 'number':
                html += `
                    <label class="skill-ui-field-label" for="skill-${field.id}">${field.label}</label>
                    <input type="number" id="skill-${field.id}"
                        placeholder="${field.placeholder || ''}">`;
                break;
            case 'select':
                html += `
                    <label class="skill-ui-field-label" for="skill-${field.id}">${field.label}</label>
                    <select id="skill-${field.id}">
                        ${field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                    </select>`;
                break;
            case 'multiselect':
                html += `
                    <label class="skill-ui-field-label">${field.label}</label>
                    <div class="skill-ui-multiselect">
                        ${field.options.map(opt => `
                            <div class="skill-ui-chip" data-value="${opt}">
                                <span class="skill-ui-chip-check">✓</span>
                                ${opt}
                            </div>
                        `).join('')}
                    </div>`;
                break;
            case 'checkbox':
                html += `
                    <div class="skill-ui-toggle ${field.checked ? 'checked' : ''}" data-field="${field.id}">
                        <input type="checkbox" id="skill-${field.id}" ${field.checked ? 'checked' : ''} hidden>
                        <div class="skill-ui-toggle-switch"></div>
                        <span class="skill-ui-toggle-label">${field.label}</span>
                    </div>`;
                break;
            case 'file':
                html += `
                    <label class="skill-ui-field-label">${field.label}</label>
                    <div class="skill-ui-file-wrapper">
                        <div class="skill-ui-file-icon">📁</div>
                        <div class="skill-ui-file-text">
                            <span>Select file</span> or drag here
                        </div>
                        <input type="file" id="skill-${field.id}" accept="${field.accept || '*'}">
                    </div>`;
                break;
        }

        html += `</div>`;
        return html;
    }

    bindSkillUIEvents(container) {
        // Submit button
        const submitBtn = container.querySelector('#skill-ui-submit');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.submitSkillUIForm(container));
        }

        // Quick action buttons
        container.querySelectorAll('.skill-ui-quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.handleSkillUIAction(action, container);
            });
        });

        // Chip multiselect toggle
        container.querySelectorAll('.skill-ui-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                chip.classList.toggle('selected');
            });
        });

        // Toggle switches
        container.querySelectorAll('.skill-ui-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                toggle.classList.toggle('checked');
                const checkbox = toggle.querySelector('input[type="checkbox"]');
                if (checkbox) checkbox.checked = toggle.classList.contains('checked');
            });
        });
    }

    submitSkillUIForm(container) {
        const fields = container.querySelectorAll('input, textarea, select');
        let formData = {};
        let prompt = '';

        fields.forEach(field => {
            const id = field.id.replace('skill-', '');
            if (field.type === 'checkbox') {
                formData[id] = field.checked;
            } else if (field.value) {
                formData[id] = field.value;
            }
        });

        // Get multiselect values
        container.querySelectorAll('.skill-ui-multiselect').forEach(ms => {
            const selected = Array.from(ms.querySelectorAll('.skill-ui-chip.selected'))
                .map(chip => chip.dataset.value);
            if (selected.length > 0) {
                const label = ms.previousElementSibling;
                const key = label ? label.textContent : 'selection';
                formData[key] = selected.join(', ');
            }
        });

        // Build prompt from form data
        const skillName = this.currentSkill ? this.currentSkill.name : 'Skill';
        prompt = `[${skillName}]\n\n`;

        Object.entries(formData).forEach(([key, value]) => {
            if (value && value !== '' && value !== false) {
                prompt += `${key}: ${value}\n`;
            }
        });

        if (prompt.trim().length > skillName.length + 5) {
            this.messageInput.value = prompt.trim();
            this.handleInputChange();
            this.sendMessage();
        }
    }

    handleSkillUIAction(action, container) {
        // Handle quick actions
        switch (action) {
            case 'load-dna':
                const seqField = container.querySelector('#skill-sequence');
                if (seqField) seqField.value = '>Example_Gene_BRCA1\nATGGATTTATCTGCTCTTCGCGTTGAAGAAGTACAAAGTGGCCGAGAGGAGGCAGGCCTTGGGGTGTGGCTTCTGGGTATCTGGGGGCTTCCTCACCTCCCATGATGGACCTGGCCAAGTGAGCCCCCAGGTGGCAGGGTGTGGTTCTGGGGCTCTCACAGTGTGGCCAGCGCCGGGTGTGGTGAGACTGGGGGAAGG';
                break;
            case 'load-protein':
                const protField = container.querySelector('#skill-sequence');
                if (protField) protField.value = '>Example_Protein_P53\nMEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGPDEAPRMPEAAPPVAPAPAAPTPAAPAPAPSWPLSSSVPSQKTYQGSYGFRLGFLHSGTAKSVTCTYSPALNKMFCQLAKTCPVQLWVDSTPPPGTRVRAMAIYKQSQHMTEVVRRCPHHERCSDSDGLAPPQHLIRVEGNLRVEYLDDRNTFRHSVVVPYEPPEVGSDCTTIHYNYMCNSSCMGGMNRRPILTIITLEDSSGNLLGRNSFEVRVCACPGRDRRTEENLRKKGEPHHELPPGSTKRALPNNTSSS';
                break;
            case 'load-aspirin':
                const molField = container.querySelector('#skill-molecule');
                if (molField) molField.value = 'CC(=O)OC1=CC=CC=C1C(=O)O';
                break;
            case 'load-caffeine':
                const cafField = container.querySelector('#skill-molecule');
                if (cafField) cafField.value = 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C';
                break;
            case 'load-sample':
                const dataField = container.querySelector('#skill-data');
                if (dataField) dataField.value = 'Sample,Control,Treatment_A,Treatment_B\n1,12.5,15.2,18.3\n2,11.8,14.9,17.8\n3,13.2,16.1,19.2\n4,12.1,15.5,18.5\n5,11.5,14.3,17.2\n6,12.8,15.8,18.9\n7,13.5,16.4,19.5\n8,11.9,14.7,17.6';
                break;
            default:
                // Use action label as prompt
                this.messageInput.value = action.replace(/-/g, ' ');
                this.handleInputChange();
                this.messageInput.focus();
        }
    }

    hideSkillInfo() {
        if (this.skillInfoPanel) {
            this.skillInfoPanel.classList.remove('active');
        }
    }

    async sendMessage() {
        const content = this.messageInput.value.trim();
        if (!content || this.isLoading) return;

        // Check API key
        if (!this.apiKey) {
            this.showError('Please enter API key in settings.');
            this.openSettings();
            return;
        }

        // Hide welcome screen
        this.welcomeScreen.classList.add('hidden');

        // Add user message
        this.addMessage('user', content);
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';
        this.handleInputChange();

        // Add to conversation history
        this.messages.push({ role: 'user', content: content });

        // Show loading state
        this.isLoading = true;
        this.sendBtn.disabled = true;

        try {
            // Streaming response handles message display
            const response = await this.callClaudeAPI(content);
            this.messages.push({ role: 'assistant', content: response });
        } catch (error) {
            this.showError(`Error: ${error.message}`);
        } finally {
            this.isLoading = false;
            this.handleInputChange();
        }
    }

    async callClaudeAPI(userMessage) {
        // Build system prompt
        let systemPrompt = SYSTEM_PROMPTS.general;

        if (this.currentSkill) {
            systemPrompt += `\n\n${this.currentSkill.prompt}`;
        }

        if (this.language === 'de') {
            systemPrompt += '\n\nAntworte auf Deutsch.';
        } else {
            systemPrompt += '\n\nRespond in English.';
        }

        const requestBody = {
            model: this.model,
            max_tokens: 16384,  // Increased for long sequences
            system: systemPrompt,
            messages: this.messages,
            apiKey: this.apiKey,
            stream: true  // Enable streaming
        };

        const apiUrl = '/api/chat';

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API Error: ${response.status}`);
        }

        // Handle streaming response
        return await this.handleStreamingResponse(response);
    }

    async handleStreamingResponse(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        // Create placeholder message element for streaming
        const messageEl = this.addMessage('assistant', '');
        const contentEl = messageEl.querySelector('.message-content');
        contentEl.innerHTML = '<span class="streaming-cursor">▊</span>';

        // Simple formatting for streaming (protects code blocks from sequence formatting)
        const formatForStreaming = (text) => {
            // Mark code blocks to protect them
            const codeBlockMarkers = [];
            text = text.replace(/```[\s\S]*?(?:```|$)/g, (match) => {
                const marker = `__STREAM_CODE_${codeBlockMarkers.length}__`;
                codeBlockMarkers.push(match);
                return marker;
            });

            // Format sequences ONLY outside of code blocks
            text = text.replace(/([ATGCUNRYWSMKHBVD]{100,})/gi, (match) => {
                const lines = [];
                for (let i = 0; i < match.length; i += 70) {
                    lines.push(match.substring(i, i + 70));
                }
                return lines.join('\n');
            });

            // Restore code blocks
            codeBlockMarkers.forEach((block, i) => {
                text = text.replace(`__STREAM_CODE_${i}__`, block);
            });

            return text
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>')
                .replace(/```(\w*)\n?/g, '<span style="color: #10b981; font-weight: bold;">[$1 code]</span><br>')
                .replace(/`([^`]+)`/g, '<code>$1</code>');
        };

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Process SSE events
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);

                            // Handle different event types
                            if (parsed.type === 'content_block_delta') {
                                const text = parsed.delta?.text || '';
                                fullText += text;

                                // Use simple formatting during streaming
                                contentEl.innerHTML = formatForStreaming(fullText) + '<span class="streaming-cursor">▊</span>';
                                this.scrollToBottom();
                            } else if (parsed.type === 'message_stop') {
                                // Stream complete
                            } else if (parsed.type === 'error') {
                                throw new Error(parsed.error?.message || 'Stream error');
                            }
                        } catch (e) {
                            // Skip non-JSON lines
                        }
                    }
                }
            }

            // Final update with FULL formatting (code blocks, run buttons, etc.)
            contentEl.innerHTML = this.formatMessage(fullText);

            // Bind run button events for any Python code blocks
            contentEl.querySelectorAll('.code-run-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.executeCode(btn.dataset.codeId);
                });
            });

            // Bind sequence selector events
            this.bindSequenceSelectorEvents(contentEl);

            this.scrollToBottom();
            return fullText;

        } catch (error) {
            contentEl.innerHTML = `<span style="color: red;">Error: ${error.message}</span>`;
            throw error;
        }
    }

    addMessage(role, content) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${role}`;

        const avatarEl = document.createElement('div');
        avatarEl.className = 'message-avatar';
        avatarEl.textContent = role === 'user' ? 'Du' : 'AI';

        const contentEl = document.createElement('div');
        contentEl.className = 'message-content';
        contentEl.innerHTML = this.formatMessage(content);

        messageEl.appendChild(avatarEl);
        messageEl.appendChild(contentEl);

        this.messagesContainer.appendChild(messageEl);

        // Bind run button events for Python code blocks
        contentEl.querySelectorAll('.code-run-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.executeCode(btn.dataset.codeId);
            });
        });

        // Bind sequence selector events
        this.bindSequenceSelectorEvents(contentEl);

        this.scrollToBottom();

        return messageEl;
    }

    formatMessage(content) {
        // IMPORTANT: Protect code blocks FIRST so sequence formatting doesn't break them
        const codeBlocks = [];

        // Extract all code blocks and replace them with placeholders
        content = content.replace(/```([Pp]ython)?\s*([\s\S]*?)```/g, (match, lang, code) => {
            const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
            codeBlocks.push({ lang: lang || '', code: code });
            return placeholder;
        });

        // NOW apply sequence formatting only to non-code content
        content = content.replace(/([ATGCUNRYWSMKHBVD]{100,})/gi, (match) => {
            const lines = [];
            for (let i = 0; i < match.length; i += 70) {
                lines.push(match.substring(i, i + 70));
            }
            return lines.join('\n');
        });

        // Helper function to create Python code block HTML
        const createPythonBlock = (code) => {
            code = code.trim();
            const id = 'code-' + Math.random().toString(36).substr(2, 9);
            const encodedCode = btoa(unescape(encodeURIComponent(code)));

            // Check if code references SEQUENCE variable (placeholder for library sequences)
            const usesSequenceVar = /\bSEQUENCE\b/.test(code) || /\bsequence\s*=/.test(code);
            const hasLibrarySeqs = this.sequenceLibrary && this.sequenceLibrary.length > 0;

            // Show sequence selector if sequences exist in library
            const sequenceSelector = hasLibrarySeqs ? `
                <div class="code-sequence-selector" data-code-id="${id}">
                    <button class="code-seq-btn" data-code-id="${id}" title="Select sequence from library">
                        🧬 <span class="seq-btn-text">Select Sequence</span>
                    </button>
                    <select class="code-seq-select hidden" data-code-id="${id}">
                        <option value="">-- Select Sequence --</option>
                        ${this.sequenceLibrary.map(seq =>
                            `<option value="${seq.id}">${seq.name} (${seq.length} bp)</option>`
                        ).join('')}
                    </select>
                </div>` : '';

            return `<div class="code-block-wrapper" data-code-id="${id}" data-code="${encodedCode}" data-selected-seq="">
                <div class="code-header">
                    <span class="code-lang">🐍 Python</span>
                    <div class="code-header-actions">
                        ${sequenceSelector}
                        <button class="code-run-btn" data-code-id="${id}">▶ Run</button>
                    </div>
                </div>
                <pre><code class="language-python">${this.escapeHtml(code)}</code></pre>
                <div class="code-output" id="output-${id}"></div>
            </div>`;
        };

        // Basic markdown formatting (WITHOUT code blocks - already extracted)
        let formatted = content
            // Inline code
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Bold
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            // Headers
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            // Lists
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
            // Paragraphs
            .replace(/\n\n/g, '</p><p>')
            // Line breaks
            .replace(/\n/g, '<br>');

        // Restore code blocks (UNCHANGED, with original code)
        codeBlocks.forEach((block, index) => {
            const placeholder = `__CODE_BLOCK_${index}__`;
            const isPython = /^p/i.test(block.lang);
            if (isPython) {
                formatted = formatted.replace(placeholder, createPythonBlock(block.code));
            } else {
                // Non-Python code block
                formatted = formatted.replace(placeholder,
                    `<pre><code class="language-${block.lang}">${this.escapeHtml(block.code)}</code></pre>`);
            }
        });

        // Wrap in paragraph if not starting with special element
        if (!formatted.startsWith('<')) {
            formatted = '<p>' + formatted + '</p>';
        }

        // Fix list items
        formatted = formatted.replace(/(<li>.*<\/li>)+/g, '<ul>$&</ul>');

        return formatted;
    }

    addLoadingIndicator() {
        const messageEl = document.createElement('div');
        messageEl.className = 'message assistant';

        const avatarEl = document.createElement('div');
        avatarEl.className = 'message-avatar';
        avatarEl.textContent = 'AI';

        const contentEl = document.createElement('div');
        contentEl.className = 'message-content';
        contentEl.innerHTML = `
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;

        messageEl.appendChild(avatarEl);
        messageEl.appendChild(contentEl);

        this.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();

        return messageEl;
    }

    scrollToBottom() {
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Format long sequences with line breaks (70 chars per line)
    formatLongSequences(text) {
        // Match long stretches of nucleotides (ATGC) or amino acids without spaces/newlines
        // This regex finds sequences of 100+ characters that look like biological sequences
        return text.replace(/([ATGCUNRYWSMKHBVD]{100,})/gi, (match) => {
            // Break into 70-character lines
            const lines = [];
            for (let i = 0; i < match.length; i += 70) {
                lines.push(match.substring(i, i + 70));
            }
            return lines.join('\n');
        });
    }

    // Bind sequence selector button and dropdown events
    bindSequenceSelectorEvents(container) {
        // Sequence selector button click - toggle dropdown
        container.querySelectorAll('.code-seq-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const codeId = btn.dataset.codeId;
                const select = container.querySelector(`.code-seq-select[data-code-id="${codeId}"]`);
                if (select) {
                    select.classList.toggle('hidden');
                    if (!select.classList.contains('hidden')) {
                        select.focus();
                    }
                }
            });
        });

        // Sequence select change - store selection
        container.querySelectorAll('.code-seq-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const codeId = select.dataset.codeId;
                const wrapper = document.querySelector(`.code-block-wrapper[data-code-id="${codeId}"]`);
                const btn = container.querySelector(`.code-seq-btn[data-code-id="${codeId}"]`);
                const selectedId = select.value;

                if (wrapper) {
                    wrapper.dataset.selectedSeq = selectedId;
                }

                // Update button text to show selected sequence
                if (btn) {
                    if (selectedId) {
                        const seq = this.sequenceLibrary.find(s => s.id === selectedId);
                        btn.innerHTML = `🧬 <span class="seq-btn-text">${seq ? seq.name : 'Sequenz'}</span>`;
                        btn.classList.add('seq-selected');
                    } else {
                        btn.innerHTML = `🧬 <span class="seq-btn-text">Sequenz wählen</span>`;
                        btn.classList.remove('seq-selected');
                    }
                }

                // Hide dropdown after selection
                select.classList.add('hidden');
            });

            // Hide dropdown when clicking outside
            select.addEventListener('blur', () => {
                setTimeout(() => select.classList.add('hidden'), 200);
            });
        });
    }

    async executeCode(codeId) {
        const wrapper = document.querySelector(`[data-code-id="${codeId}"]`);
        if (!wrapper) return;

        // Decode base64-encoded code to preserve newlines and special characters
        const encodedCode = wrapper.dataset.code;
        let code = decodeURIComponent(escape(atob(encodedCode)));

        // Check if a sequence from library is selected
        const selectedSeqId = wrapper.dataset.selectedSeq;
        if (selectedSeqId) {
            const seq = this.sequenceLibrary.find(s => s.id === selectedSeqId);
            if (seq) {
                // Prepend the sequence as a Python variable
                const sequenceVar = `# Sequence from library: ${seq.name}\nSEQUENCE = """${seq.sequence}"""\nsequence = SEQUENCE  # Alias for easier access\n\n`;
                code = sequenceVar + code;
            }
        }

        const outputEl = wrapper.querySelector('.code-output');
        const runBtn = wrapper.querySelector('.code-run-btn');

        // Show loading state
        outputEl.textContent = '⏳ Executing...';
        outputEl.className = 'code-output running';
        runBtn.disabled = true;
        runBtn.textContent = '⏳ Running...';

        try {
            const response = await fetch('/api/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });

            const result = await response.json();

            if (result.success) {
                let output = result.output || '(No output)';
                // Use rawOutput for sequence detection (unformatted from server)
                const rawOutput = result.rawOutput || output;

                // IMPORTANT: Detect sequences from RAW OUTPUT (unformatted!)
                const detectedSeqs = this.detectAndOfferSequenceSave(rawOutput);

                // Auto-format long sequences with line breaks (falls noch nicht vom Server gemacht)
                output = this.formatLongSequences(output);

                outputEl.className = 'code-output success';

                // Create output content
                const textNode = document.createElement('pre');
                textNode.style.margin = '0';
                textNode.style.whiteSpace = 'pre-wrap';
                textNode.style.wordBreak = 'break-all';
                textNode.textContent = output;
                outputEl.innerHTML = '';
                outputEl.appendChild(textNode);

                // Add action buttons for output (Download, Copy)
                const outputActions = document.createElement('div');
                outputActions.className = 'output-actions';
                outputActions.innerHTML = `
                    <button class="output-action-btn download-output" title="Download results">
                        💾 Download
                    </button>
                    <button class="output-action-btn copy-output" title="Copy results">
                        📋 Copy
                    </button>
                `;

                // Bind download button
                outputActions.querySelector('.download-output').onclick = () => {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                    const filename = `output_${timestamp}.txt`;
                    const blob = new Blob([output], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    this.showSuccess('Results downloaded!');
                };

                // Bind copy button
                outputActions.querySelector('.copy-output').onclick = () => {
                    navigator.clipboard.writeText(output);
                    const btn = outputActions.querySelector('.copy-output');
                    btn.textContent = '✅ Copied!';
                    setTimeout(() => { btn.innerHTML = '📋 Copy'; }, 2000);
                };

                outputEl.appendChild(outputActions);

                // Render detected sequences with full display
                if (detectedSeqs.length > 0) {
                    const seqContainer = this.renderDetectedSequences(detectedSeqs);
                    outputEl.appendChild(seqContainer);
                }
            } else {
                outputEl.textContent = result.error || result.output || 'Unknown error';
                outputEl.className = 'code-output error';
            }
        } catch (error) {
            outputEl.textContent = `Error: ${error.message}`;
            outputEl.className = 'code-output error';
        } finally {
            runBtn.disabled = false;
            runBtn.textContent = '▶ Run';
        }
    }

    // Render detected sequences with full FASTA display and action buttons
    renderDetectedSequences(sequences) {
        const container = document.createElement('div');
        container.className = 'detected-sequences-container';

        const header = document.createElement('div');
        header.className = 'detected-sequences-header';
        header.innerHTML = `<span>🧬 ${sequences.length} Sequence(s) detected</span>`;
        container.appendChild(header);

        sequences.forEach((seq, index) => {
            const seqId = `detected-seq-${Date.now()}-${index}`;
            const formattedSeq = this.formatSequenceForDisplay(seq.sequence);
            const fastaContent = `>${seq.name}\n${formattedSeq}`;

            const seqDiv = document.createElement('div');
            seqDiv.className = 'detected-sequence-item';
            seqDiv.innerHTML = `
                <div class="detected-seq-header">
                    <span class="detected-seq-name">${seq.name}</span>
                    <span class="detected-seq-info">${seq.type} • ${seq.sequence.length} bp</span>
                </div>

                <div class="detected-seq-actions">
                    <button class="seq-action-btn copy-raw" data-seq="${seqId}-raw" title="Copy raw sequence">
                        📋 Copy Sequence
                    </button>
                    <button class="seq-action-btn copy-fasta" data-seq="${seqId}-fasta" title="Copy FASTA">
                        📄 Copy FASTA
                    </button>
                    <button class="seq-action-btn download-fasta" data-seq="${seqId}" title="Download as FASTA file">
                        💾 Download
                    </button>
                    <button class="seq-action-btn save-library" data-seq="${seqId}" title="Save to library">
                        📚 Save
                    </button>
                </div>

                <div class="detected-seq-content">
                    <div class="seq-display-tabs">
                        <button class="seq-tab active" data-tab="fasta">FASTA</button>
                        <button class="seq-tab" data-tab="raw">Roh</button>
                    </div>

                    <div class="seq-tab-content active" data-content="fasta">
                        <textarea class="seq-textarea fasta-textarea" id="${seqId}-fasta" readonly onclick="this.select()">${fastaContent}</textarea>
                    </div>

                    <div class="seq-tab-content" data-content="raw">
                        <textarea class="seq-textarea raw-textarea" id="${seqId}-raw" readonly onclick="this.select()">${seq.sequence}</textarea>
                    </div>
                </div>
            `;

            // Bind events
            const copyRawBtn = seqDiv.querySelector('.copy-raw');
            const copyFastaBtn = seqDiv.querySelector('.copy-fasta');
            const downloadBtn = seqDiv.querySelector('.download-fasta');
            const saveBtn = seqDiv.querySelector('.save-library');
            const tabs = seqDiv.querySelectorAll('.seq-tab');

            copyRawBtn.onclick = () => {
                navigator.clipboard.writeText(seq.sequence);
                copyRawBtn.textContent = '✅ Copied!';
                setTimeout(() => { copyRawBtn.innerHTML = '📋 Copy Sequence'; }, 2000);
            };

            copyFastaBtn.onclick = () => {
                navigator.clipboard.writeText(fastaContent);
                copyFastaBtn.textContent = '✅ Copied!';
                setTimeout(() => { copyFastaBtn.innerHTML = '📄 Copy FASTA'; }, 2000);
            };

            downloadBtn.onclick = () => {
                const blob = new Blob([fastaContent], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${seq.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.fasta`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                downloadBtn.textContent = '✅ Downloaded!';
                setTimeout(() => { downloadBtn.innerHTML = '💾 Download'; }, 2000);
            };

            saveBtn.onclick = () => {
                this.addSequence(seq.name, seq.sequence, seq.type);
                saveBtn.textContent = '✅ Saved!';
                saveBtn.disabled = true;
            };

            tabs.forEach(tab => {
                tab.onclick = () => {
                    const tabName = tab.dataset.tab;
                    seqDiv.querySelectorAll('.seq-tab').forEach(t => t.classList.remove('active'));
                    seqDiv.querySelectorAll('.seq-tab-content').forEach(c => c.classList.remove('active'));
                    tab.classList.add('active');
                    seqDiv.querySelector(`[data-content="${tabName}"]`).classList.add('active');
                };
            });

            container.appendChild(seqDiv);
        });

        // Add "Save All" button if multiple sequences
        if (sequences.length > 1) {
            const saveAllBtn = document.createElement('button');
            saveAllBtn.className = 'save-all-sequences-btn';
            saveAllBtn.innerHTML = `📚 Save all ${sequences.length} sequences`;
            saveAllBtn.onclick = () => {
                sequences.forEach(seq => this.addSequence(seq.name, seq.sequence, seq.type));
                saveAllBtn.textContent = '✅ All saved!';
                saveAllBtn.disabled = true;
                container.querySelectorAll('.save-library').forEach(btn => {
                    btn.textContent = '✅ Saved!';
                    btn.disabled = true;
                });
            };
            container.appendChild(saveAllBtn);
        }

        return container;
    }

    // Format sequence with line breaks for FASTA display (70 chars per line)
    formatSequenceForDisplay(sequence) {
        const lines = [];
        for (let i = 0; i < sequence.length; i += 70) {
            lines.push(sequence.substring(i, i + 70));
        }
        return lines.join('\n');
    }

    // Sequence Library Methods
    toggleSequenceLibrary() {
        this.sequenceLibraryPanel.classList.toggle('active');
    }

    closeSequenceLibrary() {
        this.sequenceLibraryPanel.classList.remove('active');
    }

    addSequence(name, sequence, type = 'DNA') {
        const id = 'seq-' + Date.now();
        const seqData = {
            id,
            name: name || `Sequence ${this.sequenceLibrary.length + 1}`,
            sequence: sequence.replace(/\s/g, ''),
            type: type.toUpperCase(),
            length: sequence.replace(/\s/g, '').length,
            addedAt: new Date().toLocaleTimeString()
        };

        this.sequenceLibrary.push(seqData);
        this.updateSequenceLibraryUI();
        this.showSuccess(`Sequence "${seqData.name}" saved!`);
        return id;
    }

    removeSequence(id) {
        this.sequenceLibrary = this.sequenceLibrary.filter(s => s.id !== id);
        this.updateSequenceLibraryUI();
    }

    clearSequenceLibrary() {
        if (this.sequenceLibrary.length === 0) return;
        if (confirm('Delete all sequences?')) {
            this.sequenceLibrary = [];
            this.updateSequenceLibraryUI();
        }
    }

    updateSequenceLibraryUI() {
        const count = this.sequenceLibrary.length;
        this.sequenceCountEl.textContent = count;

        if (count === 0) {
            this.sequenceLibraryContent.innerHTML = `
                <div class="sequence-library-empty">
                    <p>No sequences saved</p>
                    <small>Sequences from code outputs will be saved here</small>
                </div>
            `;
            return;
        }

        this.sequenceLibraryContent.innerHTML = this.sequenceLibrary.map(seq => `
            <div class="sequence-item" data-seq-id="${seq.id}">
                <div class="sequence-item-header">
                    <span class="sequence-item-name">${seq.name}</span>
                    <span class="sequence-item-type">${seq.type}</span>
                </div>
                <div class="sequence-item-info">${seq.length} bp • Fully saved • ${seq.addedAt}</div>
                <div class="sequence-item-preview">${seq.sequence.substring(0, 50)}${seq.sequence.length > 50 ? '...' : ''}</div>
                <button class="seq-expand-btn" data-seq-id="${seq.id}" onclick="event.stopPropagation(); app.toggleSequenceExpand('${seq.id}', event)">
                    ▼ Show complete sequence
                </button>
                <div class="sequence-full-view" id="seq-full-${seq.id}" style="display: none;">
                    <div class="sequence-full-header">
                        <span>Complete sequence (${seq.length} bp)</span>
                        <button class="seq-copy-full-btn" onclick="event.stopPropagation(); app.copySequence('${seq.id}')">📋 Copy all</button>
                    </div>
                    <textarea class="sequence-full-text" readonly onclick="this.select()">${seq.sequence}</textarea>
                    <div class="sequence-fasta-view">
                        <div class="sequence-fasta-header">FASTA Format:</div>
                        <textarea class="sequence-fasta-text" readonly onclick="this.select()">${'>' + seq.name + '\n' + seq.sequence}</textarea>
                    </div>
                </div>
                <div class="sequence-item-actions">
                    <button class="seq-fasta-btn" onclick="event.stopPropagation(); app.downloadFasta('${seq.id}')">💾 FASTA Download</button>
                    <button class="seq-use-btn" onclick="event.stopPropagation(); app.useSequence('${seq.id}')">✏️ Use</button>
                    <button class="seq-delete-btn" onclick="event.stopPropagation(); app.removeSequence('${seq.id}')">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    toggleSequenceExpand(id, event) {
        // Prevent event bubbling and default behavior
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const fullView = document.getElementById(`seq-full-${id}`);
        if (!fullView) {
            console.error('Full view not found for id:', id);
            return;
        }

        const btn = document.querySelector(`button.seq-expand-btn[data-seq-id="${id}"]`);
        if (!btn) {
            console.error('Button not found for id:', id);
            return;
        }

        const isHidden = fullView.style.display === 'none' || fullView.style.display === '';

        if (isHidden) {
            fullView.style.display = 'block';
            btn.innerHTML = '▲ Hide sequence';
            btn.classList.add('expanded');
            // Scroll the sequence item into view smoothly
            setTimeout(() => {
                btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 50);
        } else {
            fullView.style.display = 'none';
            btn.innerHTML = '▼ Show complete sequence';
            btn.classList.remove('expanded');
        }
    }

    copySequence(id) {
        const seq = this.sequenceLibrary.find(s => s.id === id);
        if (seq) {
            navigator.clipboard.writeText(seq.sequence);
            this.showSuccess('Complete sequence copied!');
        }
    }

    downloadFasta(id) {
        const seq = this.sequenceLibrary.find(s => s.id === id);
        if (seq) {
            // Format sequence with line breaks every 70 chars (standard FASTA)
            const formattedSeq = seq.sequence.match(/.{1,70}/g).join('\n');
            const fasta = `>${seq.name}\n${formattedSeq}`;

            const blob = new Blob([fasta], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${seq.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.fasta`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showSuccess('FASTA file downloaded!');
        }
    }

    useSequence(id) {
        const seq = this.sequenceLibrary.find(s => s.id === id);
        if (seq) {
            this.messageInput.value = `Analyze this ${seq.type} sequence:\n${seq.sequence}`;
            this.handleInputChange();
            this.closeSequenceLibrary();
            this.messageInput.focus();
        }
    }

    // ============================================================
    // VCF Library Methods
    // ============================================================

    addVcf(name, content, sampleId = null) {
        const id = 'vcf-' + Date.now();

        // Parse VCF to extract metadata
        const lines = content.split('\n');
        let variantCount = 0;
        let samples = [];
        let genes = new Set();

        for (const line of lines) {
            if (line.startsWith('#CHROM')) {
                const cols = line.split('\t');
                if (cols.length > 9) {
                    samples = cols.slice(9);
                }
            } else if (!line.startsWith('#') && line.trim()) {
                variantCount++;
                // Extract gene info from INFO field if available
                const match = line.match(/GENE=([^;]+)/);
                if (match) genes.add(match[1]);
            }
        }

        const vcfData = {
            id,
            name: name || `VCF_${this.vcfLibrary.length + 1}`,
            content: content,
            sampleId: sampleId || (samples.length > 0 ? samples[0] : 'Unknown'),
            samples: samples,
            variantCount: variantCount,
            genes: Array.from(genes),
            addedAt: new Date().toLocaleString(),
            size: content.length
        };

        this.vcfLibrary.push(vcfData);
        this.saveVcfLibrary();
        this.updateVcfLibraryDropdowns();
        this.updateVcfLibraryUI();
        this.showSuccess(`VCF "${vcfData.name}" with ${variantCount} variants saved!`);
        return id;
    }

    removeVcf(id) {
        this.vcfLibrary = this.vcfLibrary.filter(v => v.id !== id);
        this.saveVcfLibrary();
        this.updateVcfLibraryDropdowns();
        this.updateVcfLibraryUI();
    }

    saveVcfLibrary() {
        localStorage.setItem('vcf_library', JSON.stringify(this.vcfLibrary));
    }

    clearVcfLibrary() {
        if (this.vcfLibrary.length === 0) return;
        if (confirm('Delete all VCF files from library?')) {
            this.vcfLibrary = [];
            this.saveVcfLibrary();
            this.updateVcfLibraryDropdowns();
            this.updateVcfLibraryUI();
            this.showSuccess('VCF library cleared');
        }
    }

    toggleVcfLibrary() {
        this.vcfLibraryPanel.classList.toggle('active');
        if (this.vcfLibraryPanel.classList.contains('active')) {
            this.updateVcfLibraryUI();
        }
    }

    closeVcfLibrary() {
        this.vcfLibraryPanel.classList.remove('active');
    }

    updateVcfLibraryUI() {
        const count = this.vcfLibrary.length;
        if (this.vcfCountEl) {
            this.vcfCountEl.textContent = count;
        }

        if (!this.vcfLibraryContent) return;

        if (count === 0) {
            this.vcfLibraryContent.innerHTML = `
                <div class="vcf-library-empty">
                    <p>No VCF files saved</p>
                    <small>VCF files from VCF Creator will be saved here</small>
                </div>
            `;
            return;
        }

        this.vcfLibraryContent.innerHTML = this.vcfLibrary.map(vcf => `
            <div class="vcf-item" data-vcf-id="${vcf.id}">
                <div class="vcf-item-header">
                    <span class="vcf-item-name">${vcf.name}</span>
                    <span class="vcf-item-badge">${vcf.variantCount} Variants</span>
                </div>
                <div class="vcf-item-info">
                    <span>Sample: ${vcf.sampleId}</span>
                    <span>•</span>
                    <span>${vcf.addedAt}</span>
                </div>
                ${vcf.genes && vcf.genes.length > 0 ? `
                <div class="vcf-item-genes">
                    Gene: ${vcf.genes.slice(0, 5).join(', ')}${vcf.genes.length > 5 ? ` (+${vcf.genes.length - 5})` : ''}
                </div>
                ` : ''}
                <div class="vcf-item-actions">
                    <button class="vcf-use-btn" onclick="event.stopPropagation(); app.useVcf('${vcf.id}')">✏️ Analyze</button>
                    <button class="vcf-download-btn" onclick="event.stopPropagation(); app.downloadVcf('${vcf.id}')">💾 Download</button>
                    <button class="vcf-delete-btn" onclick="event.stopPropagation(); app.removeVcfWithUI('${vcf.id}')">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    removeVcfWithUI(id) {
        this.removeVcf(id);
        this.updateVcfLibraryUI();
    }

    updateVcfLibraryDropdowns() {
        // Update all VCF library dropdowns in the UI
        const dropdowns = document.querySelectorAll('select[id="vcfLibrary"]');
        dropdowns.forEach(dropdown => {
            const currentValue = dropdown.value;
            dropdown.innerHTML = '<option value="">-- None --</option>';

            this.vcfLibrary.forEach(vcf => {
                const option = document.createElement('option');
                option.value = vcf.id;
                option.textContent = `${vcf.name} (${vcf.variantCount} Var., ${vcf.sampleId})`;
                dropdown.appendChild(option);
            });

            // Restore selection if still exists
            if (currentValue && this.vcfLibrary.find(v => v.id === currentValue)) {
                dropdown.value = currentValue;
            }
        });
    }

    getVcfById(id) {
        return this.vcfLibrary.find(v => v.id === id);
    }

    downloadVcf(id) {
        const vcf = this.vcfLibrary.find(v => v.id === id);
        if (vcf) {
            const blob = new Blob([vcf.content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${vcf.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.vcf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showSuccess('VCF file downloaded!');
        }
    }

    useVcf(id) {
        const vcf = this.vcfLibrary.find(v => v.id === id);
        if (vcf) {
            this.messageInput.value = `Analyze this VCF file (${vcf.variantCount} variants, Sample: ${vcf.sampleId}):\n\n${vcf.content.substring(0, 2000)}${vcf.content.length > 2000 ? '\n...(truncated)' : ''}`;
            this.handleInputChange();
            this.messageInput.focus();
        }
    }

    detectAndOfferVcfSave(output) {
        // Check if output contains VCF content
        if (output.includes('##fileformat=VCF') || output.includes('#CHROM\tPOS\tID\tREF\tALT')) {
            // Extract VCF content
            const vcfMatch = output.match(/(##fileformat=VCF[\s\S]*?)(?=\n\n|\n```|$)/);
            if (vcfMatch) {
                const vcfContent = vcfMatch[1].trim();
                const lines = vcfContent.split('\n').filter(l => !l.startsWith('##'));
                const variantCount = lines.filter(l => !l.startsWith('#')).length;

                if (variantCount > 0) {
                    // Show save prompt
                    const savePrompt = document.createElement('div');
                    savePrompt.className = 'vcf-save-prompt';
                    savePrompt.innerHTML = `
                        <div class="vcf-save-content">
                            <span>💊 VCF with ${variantCount} variants detected</span>
                            <input type="text" id="vcfSaveName" placeholder="Name for VCF" value="PGx_VCF_${Date.now()}">
                            <button onclick="app.addVcf(document.getElementById('vcfSaveName').value, \`${btoa(vcfContent)}\`.split('').map(c=>String.fromCharCode(c.charCodeAt(0))).join('')); this.parentElement.parentElement.remove();">
                                💾 Save to library
                            </button>
                            <button onclick="this.parentElement.parentElement.remove();">✕</button>
                        </div>
                    `;

                    const outputEl = document.querySelector('.code-output:last-child');
                    if (outputEl) {
                        outputEl.appendChild(savePrompt);
                    }
                }
            }
        }
    }

    // ============================================================
    // VCF Imputed Library Methods
    // ============================================================

    addVcfImputed(name, content, filePath = null, sampleId = null) {
        const id = 'vcf-imputed-' + Date.now();

        // Parse VCF to extract metadata
        const lines = content.split('\n');
        let variantCount = 0;
        let samples = [];

        for (const line of lines) {
            if (line.startsWith('#CHROM')) {
                const cols = line.split('\t');
                if (cols.length > 9) {
                    samples = cols.slice(9);
                }
            } else if (!line.startsWith('#') && line.trim()) {
                variantCount++;
            }
        }

        const vcfData = {
            id,
            name: name || `VCF_Imputed_${this.vcfImputedLibrary.length + 1}`,
            content: content,
            filePath: filePath,
            sampleId: sampleId || (samples.length > 0 ? samples[0] : 'Unknown'),
            samples: samples,
            variantCount: variantCount,
            addedAt: new Date().toLocaleString(),
            size: content.length,
            type: 'imputed'
        };

        this.vcfImputedLibrary.push(vcfData);
        this.saveVcfImputedLibrary();
        this.updateVcfImputedLibraryUI();
        this.showSuccess(`Imputed VCF "${vcfData.name}" with ${variantCount} variants saved!`);
        return id;
    }

    removeVcfImputed(id) {
        this.vcfImputedLibrary = this.vcfImputedLibrary.filter(v => v.id !== id);
        this.saveVcfImputedLibrary();
        this.updateVcfImputedLibraryUI();
    }

    saveVcfImputedLibrary() {
        localStorage.setItem('vcf_imputed_library', JSON.stringify(this.vcfImputedLibrary));
    }

    clearVcfImputedLibrary() {
        if (this.vcfImputedLibrary.length === 0) return;
        if (confirm('Delete all imputed VCF files from library?')) {
            this.vcfImputedLibrary = [];
            this.saveVcfImputedLibrary();
            this.updateVcfImputedLibraryUI();
            this.showSuccess('Imputed VCF library cleared');
        }
    }

    toggleVcfImputedLibrary() {
        // Create panel if it doesn't exist
        if (!this.vcfImputedLibraryPanel) {
            this.createVcfImputedLibraryPanel();
        }
        this.vcfImputedLibraryPanel.classList.toggle('active');
        if (this.vcfImputedLibraryPanel.classList.contains('active')) {
            this.updateVcfImputedLibraryUI();
        }
    }

    closeVcfImputedLibrary() {
        if (this.vcfImputedLibraryPanel) {
            this.vcfImputedLibraryPanel.classList.remove('active');
        }
    }

    createVcfImputedLibraryPanel() {
        const panel = document.createElement('div');
        panel.className = 'vcf-library-panel vcf-imputed-panel';
        panel.id = 'vcf-imputed-library-panel';
        panel.innerHTML = `
            <div class="vcf-library-header">
                <h3>📊 Imputed VCF Bibliothek</h3>
                <div class="vcf-library-actions">
                    <button id="clear-vcf-imputed-btn" class="vcf-clear-btn">Delete all</button>
                    <button id="close-vcf-imputed-library" class="vcf-close-btn">×</button>
                </div>
            </div>
            <div class="vcf-library-content" id="vcf-imputed-library-content">
                <p class="vcf-empty-message">No imputed VCF files available</p>
            </div>
        `;
        document.body.appendChild(panel);

        this.vcfImputedLibraryPanel = panel;
        this.vcfImputedLibraryContent = document.getElementById('vcf-imputed-library-content');
        this.closeVcfImputedLibraryBtn = document.getElementById('close-vcf-imputed-library');
        this.clearVcfImputedBtn = document.getElementById('clear-vcf-imputed-btn');

        this.closeVcfImputedLibraryBtn.addEventListener('click', () => this.closeVcfImputedLibrary());
        this.clearVcfImputedBtn.addEventListener('click', () => this.clearVcfImputedLibrary());
    }

    updateVcfImputedLibraryUI() {
        const count = this.vcfImputedLibrary.length;
        if (this.vcfImputedCountEl) {
            this.vcfImputedCountEl.textContent = count;
        }

        if (!this.vcfImputedLibraryContent) return;

        if (count === 0) {
            this.vcfImputedLibraryContent.innerHTML = `
                <div class="vcf-empty">
                    <p>📊 No imputed VCF files available</p>
                    <small>VCFs will be saved here after Beagle imputation</small>
                </div>
            `;
            return;
        }

        this.vcfImputedLibraryContent.innerHTML = this.vcfImputedLibrary.map(vcf => `
            <div class="vcf-item imputed" data-id="${vcf.id}">
                <div class="vcf-item-header">
                    <span class="vcf-name">📊 ${vcf.name}</span>
                    <span class="vcf-badge imputed">IMPUTED</span>
                </div>
                <div class="vcf-item-meta">
                    <span>Sample: ${vcf.sampleId}</span>
                    <span>Variants: ${vcf.variantCount.toLocaleString()}</span>
                    <span>${(vcf.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                ${vcf.filePath ? `<div class="vcf-item-path">📁 ${vcf.filePath}</div>` : ''}
                <div class="vcf-item-actions">
                    <button onclick="app.useVcfImputed('${vcf.id}')" class="vcf-use-btn">Use</button>
                    <button onclick="app.downloadVcfImputed('${vcf.id}')" class="vcf-download-btn">Download</button>
                    <button onclick="app.removeVcfImputed('${vcf.id}')" class="vcf-delete-btn">×</button>
                </div>
            </div>
        `).join('');
    }

    getVcfImputedById(id) {
        return this.vcfImputedLibrary.find(v => v.id === id);
    }

    downloadVcfImputed(id) {
        const vcf = this.vcfImputedLibrary.find(v => v.id === id);
        if (vcf) {
            const blob = new Blob([vcf.content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${vcf.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.imputed.vcf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showSuccess('Imputed VCF file downloaded!');
        }
    }

    useVcfImputed(id) {
        const vcf = this.vcfImputedLibrary.find(v => v.id === id);
        if (vcf) {
            this.messageInput.value = `Analyze this imputed VCF file (${vcf.variantCount} variants, Sample: ${vcf.sampleId}):\n\n${vcf.content.substring(0, 2000)}${vcf.content.length > 2000 ? '\n...(truncated)' : ''}`;
            this.handleInputChange();
            this.closeVcfImputedLibrary();
            this.messageInput.focus();
        }
    }

    // ============================================================
    // VCF Creator Methods (IDAT to VCF)
    // ============================================================

    toggleVcfCreator() {
        this.vcfCreatorPanel.classList.toggle('active');
        // Close other panels
        this.sequenceLibraryPanel.classList.remove('active');
    }

    closeVcfCreator() {
        this.vcfCreatorPanel.classList.remove('active');
    }

    updateArrayPaths() {
        if (!this.arrayTypeSelect) return;

        const arrayType = this.arrayTypeSelect.value;
        const baseManifestPath = 'C:\\Users\\ErwinSchimak\\Desktop\\idat\\need\\Manifest\\';
        const baseClusterPath = 'C:\\Users\\ErwinSchimak\\Desktop\\idat\\need\\clusterfile\\';

        // Array-specific configurations
        const arrayConfigs = {
            novoscreen: {
                manifest: baseManifestPath + 'NovoScreen01_20032937X376089_A2.bpm',
                cluster: baseClusterPath + 'Clusterfile_Final_V137.egt',
                csv: baseManifestPath + 'NovoScreen01_20032937X376089_A2.bpm.csv'
            },
            gsa24v3: {
                manifest: baseManifestPath + 'GSA-24v3-0_A1.bpm',
                cluster: baseClusterPath + 'GSA-24v3-0_A1_ClusterFile.egt',
                csv: baseManifestPath + 'GSA-24v3-0_A1.csv'
            },
            custom: {
                // Keep current values for custom
                manifest: this.manifestPath ? this.manifestPath.value : '',
                cluster: this.clusterPath ? this.clusterPath.value : '',
                csv: this.csvManifestPath ? this.csvManifestPath.value : ''
            }
        };

        // Update the input fields
        if (arrayType !== 'custom' && arrayConfigs[arrayType]) {
            const config = arrayConfigs[arrayType];
            if (this.manifestPath) this.manifestPath.value = config.manifest;
            if (this.clusterPath) this.clusterPath.value = config.cluster;
            if (this.csvManifestPath) this.csvManifestPath.value = config.csv;

            // Visual feedback
            this.showToast(`📊 Array paths updated for ${arrayType === 'novoscreen' ? 'NovoScreen01' : 'Global Screening Array-24+ v3.0 HTS'}`, 'success');
        } else if (arrayType === 'custom') {
            this.showToast('✏️ Custom mode: Adjust paths manually', 'info');
        }
    }

    toggleBeagleOptions() {
        const beagleOptions = document.querySelectorAll('.beagle-options');
        const show = this.useBeagleCheckbox.checked;
        beagleOptions.forEach(el => {
            el.style.display = show ? 'block' : 'none';
        });
    }

    togglePharmcatOptions() {
        const pharmcatOptions = document.querySelectorAll('.pharmcat-options');
        const show = this.usePharmcatCheckbox.checked;
        pharmcatOptions.forEach(el => {
            el.style.display = show ? 'block' : 'none';
        });
    }

    toggleAllChromosomes() {
        const isChecked = this.selectAllChromosomes.checked;
        const checkboxes = this.chromosomeGrid.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = isChecked;
        });
    }

    updateSelectAllChromosomeState() {
        const checkboxes = this.chromosomeGrid.querySelectorAll('input[type="checkbox"]');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        const noneChecked = Array.from(checkboxes).every(cb => !cb.checked);

        if (allChecked) {
            this.selectAllChromosomes.checked = true;
            this.selectAllChromosomes.indeterminate = false;
        } else if (noneChecked) {
            this.selectAllChromosomes.checked = false;
            this.selectAllChromosomes.indeterminate = false;
        } else {
            this.selectAllChromosomes.indeterminate = true;
        }
    }

    getSelectedChromosomes() {
        const checkboxes = this.chromosomeGrid.querySelectorAll('input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    handleIdatFileSelect(e) {
        const files = Array.from(e.target.files);
        this.selectedIdatFiles = files;
        this.updateIdatSamplesList(files);
    }

    updateIdatSamplesList(files) {
        if (!files || files.length === 0) {
            this.vcfSamplesList.innerHTML = '<p class="vcf-empty-message">No IDAT files selected</p>';
            return;
        }

        // Group files by sample (Sentrix code)
        const samples = {};
        files.forEach(file => {
            // Extract Sentrix code from filename: {barcode}_{position}_{Grn/Red}.idat
            const match = file.name.match(/^(\d+_R\d+C\d+)_(Grn|Red)\.idat$/i);
            if (match) {
                const sentrixCode = match[1];
                const channel = match[2];
                if (!samples[sentrixCode]) {
                    samples[sentrixCode] = { grn: false, red: false };
                }
                samples[sentrixCode][channel.toLowerCase()] = true;
            }
        });

        // Display samples
        const sampleEntries = Object.entries(samples);
        if (sampleEntries.length === 0) {
            this.vcfSamplesList.innerHTML = '<p class="vcf-empty-message">No valid IDAT pairs found</p>';
            return;
        }

        this.vcfSamplesList.innerHTML = sampleEntries.map(([code, channels]) => {
            const complete = channels.grn && channels.red;
            const status = complete ? '✅' : '⚠️';
            const statusText = complete ? 'Complete' : 'Incomplete';
            return `
                <div class="vcf-sample-item">
                    <span class="sample-name">${status} ${code}</span>
                    <span class="sample-files">${statusText} (Grn: ${channels.grn ? '✓' : '✗'}, Red: ${channels.red ? '✓' : '✗'})</span>
                </div>
            `;
        }).join('');

        this.detectedSamples = samples;
    }

    scanIdatFiles() {
        const folderPath = this.idatFolderPath.value.trim();
        if (!folderPath) {
            this.showError('Please enter an IDAT folder path');
            return;
        }

        this.vcfLog('Scanning IDAT folder: ' + folderPath);

        // Call server to scan folder
        fetch('/api/scan-idat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                this.vcfLog('Error: ' + data.error);
                this.showError(data.error);
            } else {
                this.vcfLog(`Found: ${data.samples.length} samples`);
                this.detectedSamples = data.samples;
                this.updateIdatSamplesListFromScan(data.samples);
            }
        })
        .catch(err => {
            this.vcfLog('Error: ' + err.message);
            this.showError('Error scanning: ' + err.message);
        });
    }

    updateIdatSamplesListFromScan(samples) {
        if (!samples || samples.length === 0) {
            this.vcfSamplesList.innerHTML = '<p class="vcf-empty-message">No IDAT files found</p>';
            return;
        }

        this.vcfSamplesList.innerHTML = samples.map(sample => `
            <div class="vcf-sample-item">
                <span class="sample-name">✅ ${sample.id}</span>
                <span class="sample-files">${sample.grnFile} / ${sample.redFile}</span>
            </div>
        `).join('');
    }

    vcfLog(message) {
        this.vcfCreatorLog.style.display = 'block';
        const timestamp = new Date().toLocaleTimeString();
        this.vcfLogContent.textContent += `[${timestamp}] ${message}\n`;
        this.vcfLogContent.scrollTop = this.vcfLogContent.scrollHeight;
    }

    async createVcfFromIdat() {
        const useDocker = this.useDockerCheckbox.checked;
        const useBeagle = this.useBeagleCheckbox.checked;
        const usePharmcat = this.usePharmcatCheckbox ? this.usePharmcatCheckbox.checked : false;
        const selectedChromosomes = useBeagle ? this.getSelectedChromosomes() : [];
        const reference = this.vcfReference.value;
        const outputDir = this.vcfOutputDir.value.trim();
        const folderPath = this.idatFolderPath.value.trim();
        const method = this.vcfMethod ? this.vcfMethod.value : 'cli';
        const manifestPath = this.manifestPath ? this.manifestPath.value.trim() : '';
        const clusterPath = this.clusterPath ? this.clusterPath.value.trim() : '';
        const csvManifestPath = this.csvManifestPath ? this.csvManifestPath.value.trim() : '';
        const genomeFastaPath = this.genomeFastaPath ? this.genomeFastaPath.value.trim() : '';

        if (!folderPath && (!this.selectedIdatFiles || this.selectedIdatFiles.length === 0)) {
            this.showError('Please select IDAT files or enter a folder path');
            return;
        }

        this.vcfLog('=== VCF Creation Started ===');
        this.vcfLog(`Method: ${method.toUpperCase()}`);
        this.vcfLog(`Docker: ${useDocker ? 'Yes' : 'No'}`);
        this.vcfLog(`Beagle Imputation: ${useBeagle ? 'Yes' : 'No'}`);
        if (useBeagle) {
            this.vcfLog(`Chromosomes: ${selectedChromosomes.length > 0 ? selectedChromosomes.join(', ') : 'All'}`);
        }
        this.vcfLog(`PharmCAT: ${usePharmcat ? 'Yes' : 'No'}`);
        this.vcfLog(`Reference: ${reference}`);

        const requestBody = {
            idatFolder: folderPath,
            outputDir: outputDir || folderPath,
            reference: reference,
            useDocker: useDocker,
            useBeagle: useBeagle,
            beagleJarPath: useBeagle ? this.beagleJarPath.value : 'C:\\Users\\ErwinSchimak\\Desktop\\idat\\beagle5.jar',
            beagleRefPath: useBeagle ? this.beagleRefPath.value : null,
            gpFilter: useBeagle ? parseFloat(this.beagleGpFilter.value) : null,
            chromosomes: selectedChromosomes,
            usePharmcat: usePharmcat,
            pharmcatJarPath: usePharmcat ? this.pharmcatJarPath.value : 'C:\\Users\\ErwinSchimak\\Desktop\\idat\\pharmcat-3.0.0-all.jar',
            method: method,
            manifestPath: manifestPath,
            clusterPath: clusterPath,
            csvManifestPath: csvManifestPath,
            genomeFastaPath: genomeFastaPath
        };

        // If files were selected via file input, we need to handle them differently
        if (this.selectedIdatFiles && this.selectedIdatFiles.length > 0) {
            this.vcfLog('Processing uploaded IDAT files...');
            // For now, just show that files were selected
            this.vcfLog(`${this.selectedIdatFiles.length} files selected`);
        }

        try {
            this.createVcfBtn.disabled = true;
            this.createVcfBtn.textContent = '⏳ Processing...';

            const response = await fetch('/api/create-vcf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const result = await response.json();

            if (result.error) {
                this.vcfLog('❌ Error: ' + result.error);
                this.showError(result.error);
            } else {
                this.vcfLog('✅ VCF creation completed!');

                // Show logs from server
                if (result.logs && result.logs.length > 0) {
                    result.logs.forEach(log => this.vcfLog(log));
                }

                // Show created VCF files
                if (result.vcf_files && result.vcf_files.length > 0) {
                    this.vcfLog(`Created: ${result.vcf_files.length} VCF files`);
                    result.vcf_files.forEach(f => this.vcfLog(`  📄 ${f}`));
                    this.showSuccess(`${result.vcf_files.length} VCF files created!`);
                } else {
                    this.vcfLog('No VCF files created - check logs');
                }

                // Add raw VCFs to library if content is provided
                if (result.vcfContents && result.vcfContents.length > 0) {
                    this.vcfLog(`Adding ${result.vcfContents.length} Raw VCF files to library...`);
                    result.vcfContents.forEach(vcf => {
                        this.addVcf(vcf.sampleId, vcf.content, vcf.sampleId);
                        this.vcfLog(`  ✅ Raw VCF ${vcf.sampleId} added to library`);
                    });
                    this.updateVcfLibraryUI();
                } else if (result.vcfContent) {
                    this.addVcf(result.sampleId || 'IDAT_Sample', result.vcfContent);
                }

                // Add imputed VCFs to library if available
                if (result.imputedVcfContents && result.imputedVcfContents.length > 0) {
                    this.vcfLog(`Adding ${result.imputedVcfContents.length} Imputed VCF files to library...`);
                    result.imputedVcfContents.forEach(vcf => {
                        this.addVcfImputed(vcf.sampleId + '_imputed', vcf.content, vcf.path, vcf.sampleId);
                        this.vcfLog(`  ✅ Imputed VCF ${vcf.sampleId} added to library`);
                    });
                    this.updateVcfImputedLibraryUI();
                }
            }
        } catch (err) {
            this.vcfLog('❌ Error: ' + err.message);
            this.showError('Error creating VCF: ' + err.message);
        } finally {
            this.createVcfBtn.disabled = false;
            this.createVcfBtn.textContent = '🧬 Create VCF';
        }
    }

    detectAndOfferSequenceSave(output) {
        let sequences = [];
        const addedSequences = new Set(); // Prevent duplicates

        // Helper: Clean sequence (remove all whitespace/newlines)
        const cleanSeq = (seq) => seq.replace(/[\s\n\r\t]/g, '').toUpperCase();

        // Helper: Add sequence if valid and not duplicate
        const addSequence = (name, seq, type) => {
            seq = cleanSeq(seq);
            // Remove non-sequence characters but keep valid ones
            seq = seq.replace(/[^ATGCUNRYWSMKHBVDEFILPQWXY*-]/g, '');

            if (seq.length >= 20 && !addedSequences.has(seq)) {
                addedSequences.add(seq);
                // Determine type based on content
                const isProtein = /[EFILPQWXY]/.test(seq);
                const actualType = isProtein ? 'Protein' : (type || 'DNA');
                sequences.push({
                    name: name || `Sequence ${sequences.length + 1}`,
                    sequence: seq,
                    type: actualType
                });
                console.log(`Sequence detected: ${name}, Length: ${seq.length}`);
            }
        };

        // 1. FASTA format - Greedy capture of everything after >header until next > or end
        // Split output into FASTA entries
        const fastaBlocks = output.split(/(?=^>)/m);
        for (const block of fastaBlocks) {
            if (block.startsWith('>')) {
                const lines = block.split('\n');
                const header = lines[0].substring(1).trim(); // Remove > and trim
                // Join ALL remaining lines as sequence
                const seqLines = lines.slice(1).join('');
                const seq = cleanSeq(seqLines);
                if (seq.length >= 20) {
                    addSequence(header, seq, 'DNA');
                }
            }
        }

        // 2. Multi-line sequence blocks (lines containing only sequence characters)
        // Find consecutive lines that look like sequence data
        const lines = output.split('\n');
        let currentSeq = '';
        let seqName = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Check if line is purely sequence (after removing spaces)
            const cleaned = line.replace(/[\s]/g, '');
            if (/^[ATGCUNRYWSMKHBVD]+$/i.test(cleaned) && cleaned.length >= 10) {
                // This line is part of a sequence
                currentSeq += cleaned;
                // Look for a name in the previous line if we just started
                if (currentSeq === cleaned && i > 0) {
                    const prevLine = lines[i-1].trim();
                    if (prevLine && !(/^[ATGCUNRYWSMKHBVD]+$/i.test(prevLine.replace(/[\s]/g, '')))) {
                        seqName = prevLine.replace(/[:=]/g, '').trim().substring(0, 50);
                    }
                }
            } else if (currentSeq.length >= 50) {
                // End of sequence block
                addSequence(seqName || `DNA-Block ${sequences.length + 1}`, currentSeq, 'DNA');
                currentSeq = '';
                seqName = '';
            } else {
                currentSeq = '';
                seqName = '';
            }
        }
        // Don't forget last sequence
        if (currentSeq.length >= 50) {
            addSequence(seqName || `DNA-Block ${sequences.length + 1}`, currentSeq, 'DNA');
        }

        // 3. Labeled sequences: "Label: SEQUENCE" or "Label = SEQUENCE"
        const labeledRegex = /([A-Za-z_][A-Za-z0-9_\s]{0,40})[:=]\s*([ATGCUNRYWSMKHBVD\s]{30,})/gi;
        let labeledMatch;
        while ((labeledMatch = labeledRegex.exec(output)) !== null) {
            const name = labeledMatch[1].trim();
            const seq = labeledMatch[2];
            if (cleanSeq(seq).length >= 30) {
                addSequence(name, seq, 'DNA');
            }
        }

        // 4. Python string output patterns
        const pythonPatterns = [
            /['"]([ATGCUN]{50,})['"]/g,  // Quoted sequences
            /print\s*\(\s*['"]?([ATGCUN]{30,})['"]?\s*\)/gi,  // print() calls
            /(?:sequence|seq|dna|rna)[\s:=]+([ATGCUN\s]{30,})/gi  // Variable assignments
        ];

        for (const pattern of pythonPatterns) {
            let match;
            while ((match = pattern.exec(output)) !== null) {
                addSequence(null, match[1], 'DNA');
            }
        }

        // 5. Protein sequences (amino acid patterns)
        const proteinRegex = /([ACDEFGHIKLMNPQRSTVWY*]{30,})/g;
        let protMatch;
        while ((protMatch = proteinRegex.exec(output)) !== null) {
            const seq = protMatch[1];
            // Only add if contains amino acids NOT in DNA alphabet
            if (/[EFILPQWXY]/.test(seq)) {
                addSequence(`Protein ${sequences.length + 1}`, seq, 'Protein');
            }
        }

        // 6. Complement/Reverse/Translated sequences with labels
        const specialPatterns = [
            { regex: /(?:complement|komplementär)[\s:=]+([ATGCUN\s]{20,})/gi, name: 'Complement' },
            { regex: /(?:reverse|revers)[\s:=]+([ATGCUN\s]{20,})/gi, name: 'Reverse' },
            { regex: /(?:translated|übersetzt|protein)[\s:=]+([A-Z*\s]{20,})/gi, name: 'Translated' },
            { regex: /(?:forward|vorwärts)[\s:=]+([ATGCUN\s]{20,})/gi, name: 'Forward' },
            { regex: /(?:primer|oligo)[\s:=]+([ATGCUN\s]{15,})/gi, name: 'Primer' }
        ];

        for (const {regex, name} of specialPatterns) {
            let match;
            while ((match = regex.exec(output)) !== null) {
                addSequence(`${name} ${sequences.length + 1}`, match[1], 'DNA');
            }
        }

        console.log(`Total ${sequences.length} sequences detected`);
        return sequences;
    }

    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        files.forEach(file => {
            this.attachedFiles.push(file);
            this.readFileContent(file);
        });
        event.target.value = '';
    }

    async readFileContent(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const preview = `[File attached: ${file.name}]\n\nContent:\n${content.substring(0, 1000)}${content.length > 1000 ? '...' : ''}`;
            this.messageInput.value = (this.messageInput.value + '\n\n' + preview).trim();
            this.handleInputChange();
        };
        reader.readAsText(file);
    }

    startNewChat() {
        this.messages = [];
        this.messagesContainer.innerHTML = '';
        this.welcomeScreen.classList.remove('hidden');
        this.currentSkill = null;
        this.currentCategory = null;
        this.activeSkillDisplay.textContent = 'General Science';

        // Clear active skill selection
        document.querySelectorAll('.category-skills li').forEach(s => s.classList.remove('active'));
    }

    openSettings() {
        this.settingsModal.classList.add('active');
        this.apiKeyInput.value = this.apiKey;
        this.modelSelect.value = this.model;
        this.languageSelect.value = this.language;
    }

    closeSettings() {
        this.settingsModal.classList.remove('active');
    }

    saveSettings() {
        this.apiKey = this.apiKeyInput.value.trim();
        this.model = this.modelSelect.value;
        this.language = this.languageSelect.value;

        localStorage.setItem('claude_api_key', this.apiKey);
        localStorage.setItem('claude_model', this.model);
        localStorage.setItem('claude_language', this.language);

        this.closeSettings();
        this.showSuccess('Settings saved!');
    }

    loadSettings() {
        this.apiKey = localStorage.getItem('claude_api_key') || '';
        this.model = localStorage.getItem('claude_model') || 'claude-sonnet-4-20250514';
        this.language = localStorage.getItem('claude_language') || 'de';
    }

    async toggleLocalModels() {
        const btn = document.getElementById('btn-start-local-models');
        const statusEl = document.getElementById('local-models-status');
        if (!btn || !statusEl) return;

        // Check current status first
        btn.disabled = true;
        btn.textContent = 'Checking...';

        try {
            const statusRes = await fetch('/api/local-models/status', { method: 'POST' });
            const status = await statusRes.json();
            const anyRunning = (status.deberta && status.deberta.healthy) || (status.roberta && status.roberta.healthy);

            if (anyRunning) {
                // Stop services
                btn.textContent = 'Stopping...';
                const services = [];
                if (status.deberta && status.deberta.healthy) services.push('deberta');
                if (status.roberta && status.roberta.healthy) services.push('roberta');
                await fetch('/api/local-models/stop', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ services })
                });
                btn.textContent = 'Start Models';
                statusEl.textContent = 'Offline';
                statusEl.className = 'local-models-status offline';
                this.showSuccess('Local AI models stopped');
            } else {
                // Start services
                btn.textContent = 'Starting...';
                statusEl.textContent = 'Starting...';
                statusEl.className = 'local-models-status starting';
                const res = await fetch('/api/local-models/start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ services: ['roberta'] })
                });
                const result = await res.json();
                if (result.roberta && result.roberta.started) {
                    btn.textContent = 'Stop Models';
                    statusEl.textContent = 'Online (RoBERTa)';
                    statusEl.className = 'local-models-status online';
                    this.showSuccess('RoBERTa-MNLI model started - first analysis may take 2-3 min for model download');
                } else {
                    btn.textContent = 'Start Models';
                    statusEl.textContent = 'Error';
                    statusEl.className = 'local-models-status offline';
                    this.showError('Failed to start model: ' + (result.roberta && result.roberta.error || 'Unknown error'));
                }
            }
        } catch (error) {
            btn.textContent = 'Start Models';
            statusEl.textContent = 'Error';
            statusEl.className = 'local-models-status offline';
            this.showError('Could not connect to server: ' + error.message);
        }

        btn.disabled = false;
    }

    async checkLocalModelStatus() {
        try {
            const statusRes = await fetch('/api/local-models/status', { method: 'POST' });
            const status = await statusRes.json();
            const btn = document.getElementById('btn-start-local-models');
            const statusEl = document.getElementById('local-models-status');
            if (!btn || !statusEl) return;

            const models = [];
            if (status.deberta && status.deberta.healthy) models.push('DeBERTa');
            if (status.roberta && status.roberta.healthy) models.push('RoBERTa');

            if (models.length > 0) {
                btn.textContent = 'Stop Models';
                statusEl.textContent = `Online (${models.join(' + ')})`;
                statusEl.className = 'local-models-status online';
            } else {
                btn.textContent = 'Start Models';
                statusEl.textContent = 'Offline';
                statusEl.className = 'local-models-status offline';
            }

            // Update token reduction service status indicators
            const summarizerEl = document.getElementById('summarizer-status');
            const rankerEl = document.getElementById('ranker-status');
            if (summarizerEl) {
                if (status.summarizer && status.summarizer.healthy) {
                    summarizerEl.textContent = 'Summarizer: Online';
                    summarizerEl.className = 'local-models-status online';
                } else {
                    summarizerEl.textContent = 'Summarizer: Offline';
                    summarizerEl.className = 'local-models-status offline';
                }
            }
            if (rankerEl) {
                if (status.ranker && status.ranker.healthy) {
                    rankerEl.textContent = 'Ranker: Online';
                    rankerEl.className = 'local-models-status online';
                } else {
                    rankerEl.textContent = 'Ranker: Offline';
                    rankerEl.className = 'local-models-status offline';
                }
            }
        } catch { /* ignore */ }
    }

    checkApiKey() {
        if (!this.apiKey) {
            setTimeout(() => {
                this.showInfo('Please enter your Anthropic API key in settings to start.');
            }, 1000);
        }
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showInfo(message) {
        this.showNotification(message, 'info');
    }

    // ============================================================
    // PaperQA Methods - SNP & Paper Analysis
    // ============================================================

    // ============================================================
    // Scientific Database Query Functions
    // ============================================================

    // Helper function for safe JSON fetching
    async safeFetchJSON(url, options, apiName, identifier) {
        try {
            const response = await fetch(url, options);

            if (!response.ok) {
                console.warn(`${apiName} API returned status ${response.status} for ${identifier}`);
                return null;
            }

            const text = await response.text();
            if (!text || text.trim().length === 0) {
                console.warn(`${apiName} API returned empty response for ${identifier}`);
                return null;
            }

            try {
                return JSON.parse(text);
            } catch (parseError) {
                console.warn(`${apiName} API returned invalid JSON for ${identifier}:`, text.substring(0, 100));
                return null;
            }
        } catch (error) {
            console.error(`${apiName} query error:`, error);
            return null;
        }
    }

    async queryDbSNP(rsid) {
        const data = await this.safeFetchJSON(
            '/api/dbsnp',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rsid })
            },
            'dbSNP',
            rsid
        );
        return data ? this.parseDbSNPResult(data, rsid) : null;
    }

    parseDbSNPResult(data, rsid) {
        try {
            const snpId = rsid.replace(/^rs/i, '');
            const docsum = data?.result?.[snpId];
            if (!docsum) return null;

            return {
                rsid: rsid,
                chromosome: docsum.chr || 'unknown',
                position: docsum.chrpos || 'unknown',
                gene: docsum.genes?.map(g => g.name).join(', ') || 'unknown',
                alleles: docsum.docsum?.match(/alleles='([^']+)'/)?.[1] || 'unknown',
                maf: docsum.global_mafs?.[0]?.freq || 'unknown',
                clinicalSignificance: docsum.clinical_significance || 'not reported',
                functionClass: docsum.fxn_class || 'unknown'
            };
        } catch (e) {
            return null;
        }
    }

    async queryPubMed(rsid, topic, maxResults = 20) {
        const data = await this.safeFetchJSON(
            '/api/pubmed',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rsid, topic, maxResults })
            },
            'PubMed',
            rsid
        );
        return data ? this.parsePubMedResult(data) : [];
    }

    async queryGoogleScholar(rsid, topic, maxResults = 15) {
        const data = await this.safeFetchJSON(
            '/api/google-scholar',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rsid, topic, maxResults })
            },
            'Google Scholar',
            rsid
        );
        return data ? this.parseGoogleScholarResult(data) : [];
    }

    parseGoogleScholarResult(data) {
        try {
            const papers = data?.papers || [];
            if (papers.length === 0) return [];

            return papers.map(paper => ({
                title: paper.title || 'Unknown',
                authors: paper.authors || 'Unknown',
                year: paper.year || 'Unknown',
                journal: paper.journal || 'Unknown',
                abstract: paper.abstract || '',
                citations: paper.citations || 0,
                url: paper.url || paper.eprint_url || null,
                eprint_url: paper.eprint_url || null,
                hasFullText: false,
                hasAbstract: !!paper.abstract,
                source: 'Google Scholar',
                isGWAS: (paper.title + ' ' + paper.abstract).toLowerCase().includes('gwas') ||
                        (paper.title + ' ' + paper.abstract).toLowerCase().includes('genome-wide')
            })).sort((a, b) => b.citations - a.citations); // Sort by citations
        } catch (e) {
            console.error('Google Scholar parse error:', e);
            return [];
        }
    }

    async queryArXiv(rsid, topic, maxResults = 20) {
        const data = await this.safeFetchJSON(
            '/api/arxiv',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rsid, topic, maxResults })
            },
            'ArXiv',
            rsid
        );
        return data ? this.parseArXivResult(data) : [];
    }

    parseArXivResult(data) {
        try {
            const papers = data?.papers || [];
            if (papers.length === 0) return [];

            return papers.map(paper => ({
                title: paper.title || 'Unknown',
                authors: paper.authors || 'Unknown',
                year: paper.year || 'Unknown',
                journal: 'ArXiv (Preprint)',
                abstract: paper.abstract || '',
                arxivId: paper.arxivId,
                pdfUrl: paper.pdfUrl,
                url: paper.arxivUrl,
                hasFullText: true, // ArXiv always provides PDFs
                hasAbstract: !!paper.abstract,
                source: 'ArXiv',
                isGWAS: (paper.title + ' ' + paper.abstract).toLowerCase().includes('gwas') ||
                        (paper.title + ' ' + paper.abstract).toLowerCase().includes('genome-wide')
            }));
        } catch (e) {
            console.error('ArXiv parse error:', e);
            return [];
        }
    }

    async queryHuggingFacePapers(rsid, topic, maxResults = 20) {
        const data = await this.safeFetchJSON(
            '/api/huggingface-papers',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rsid, topic, maxResults })
            },
            'HuggingFace',
            rsid
        );
        return data ? this.parseHuggingFaceResult(data) : [];
    }

    parseHuggingFaceResult(data) {
        try {
            const papers = data?.papers || [];
            if (papers.length === 0) return [];

            return papers.map(paper => ({
                title: paper.title || 'Unknown',
                authors: paper.authors || 'Unknown',
                year: paper.year || 'Unknown',
                journal: 'HuggingFace Daily Papers',
                abstract: paper.abstract || '',
                arxivId: paper.arxivId,
                pdfUrl: paper.pdfUrl,
                upvotes: paper.upvotes || 0,
                hasFullText: !!paper.pdfUrl,
                hasAbstract: !!paper.abstract,
                source: 'HuggingFace',
                isGWAS: false // HuggingFace focuses on ML/AI papers
            }));
        } catch (e) {
            console.error('HuggingFace parse error:', e);
            return [];
        }
    }

    async queryCrawlyScraper(rsid, topic, sources = ['biorxiv', 'medrxiv']) {
        const data = await this.safeFetchJSON(
            '/api/crawly-scraper',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rsid, topic, sources })
            },
            'Crawly Scraper',
            rsid
        );
        return data ? this.parseCrawlyResult(data) : [];
    }

    parseCrawlyResult(data) {
        try {
            const papers = data?.papers || [];
            if (papers.length === 0) return [];

            return papers.map(paper => ({
                title: paper.title || 'Unknown',
                authors: paper.authors || 'Unknown',
                year: paper.year || 'Unknown',
                journal: paper.source || 'Unknown',
                abstract: paper.abstract || '',
                pdfUrl: paper.pdfUrl,
                hasFullText: !!paper.pdfUrl,
                hasAbstract: !!paper.abstract,
                source: paper.source,
                isGWAS: false
            }));
        } catch (e) {
            console.error('Crawly parse error:', e);
            return [];
        }
    }

    async querySciHubTopic(rsid, topic, maxResults = 15) {
        const data = await this.safeFetchJSON(
            '/api/scihub-topic-search',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rsid, topic, maxResults })
            },
            'Sci-Hub Topic',
            rsid
        );
        return data ? this.parseSciHubTopicResult(data) : [];
    }

    parseSciHubTopicResult(data) {
        try {
            const papers = data?.papers || [];
            if (papers.length === 0) return [];

            return papers.map(paper => ({
                title: paper.title || 'Unknown',
                authors: 'Unknown',
                year: 'Unknown',
                journal: 'Sci-Hub',
                abstract: '',
                doi: paper.doi || null,
                url: paper.url || paper.scihub_url,
                pdfUrl: paper.scihub_url,
                scihubAvailable: paper.scihub_available || false,
                hasFullText: paper.scihub_available || false,
                hasAbstract: false,
                source: 'Sci-Hub Topic Search',
                isGWAS: false
            }));
        } catch (e) {
            console.error('Sci-Hub Topic parse error:', e);
            return [];
        }
    }

    parsePubMedResult(data) {
        try {
            // New format: { papers: [...] }
            const papers = data?.papers || [];
            if (papers.length === 0) return [];

            // Process and enrich papers
            return papers.map(paper => {
                // Use full text if available, otherwise abstract
                const content = paper.fullText || paper.abstract || '';
                const hasFullText = paper.hasFullText || false;

                return {
                    pmid: paper.pmid,
                    pmcId: paper.pmcId || null,
                    title: paper.title || 'Unknown title',
                    hasFullText: hasFullText,
                    abstract: content,  // Contains full text if available
                    authors: paper.authors || 'Unknown',
                    journal: paper.journal || 'Unknown',
                    year: paper.year || 'Unknown',
                    isGWAS: (paper.title + ' ' + content).toLowerCase().includes('gwas') ||
                            (paper.title + ' ' + content).toLowerCase().includes('genome-wide'),
                    hasAbstract: !!content
                };
            }).sort((a, b) => (b.isGWAS ? 1 : 0) - (a.isGWAS ? 1 : 0));
        } catch (e) {
            console.error('PubMed parse error:', e);
            return [];
        }
    }

    async queryClinVar(rsid) {
        const data = await this.safeFetchJSON(
            '/api/clinvar',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rsid })
            },
            'ClinVar',
            rsid
        );
        return data ? this.parseClinVarResult(data) : [];
    }

    parseClinVarResult(data) {
        try {
            const result = data?.result;
            if (!result) return [];

            const entries = [];
            for (const uid of (result.uids || [])) {
                const entry = result[uid];
                if (entry) {
                    entries.push({
                        uid: uid,
                        title: entry.title || 'Unknown',
                        clinicalSignificance: entry.clinical_significance?.description || 'Unknown',
                        condition: entry.trait_set?.map(t => t.trait_name).join('; ') || 'Unknown',
                        gene: entry.genes?.map(g => g.symbol).join(', ') || 'Unknown',
                        reviewStatus: entry.review_status || 'Unknown',
                        accession: entry.accession || ''
                    });
                }
            }
            return entries;
        } catch (e) {
            return [];
        }
    }

    async queryGWASCatalog(rsid) {
        const data = await this.safeFetchJSON(
            '/api/gwas',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rsid })
            },
            'GWAS',
            rsid
        );
        return data ? this.parseGWASResult(data) : [];
    }

    parseGWASResult(data) {
        try {
            // Handle GWAS Catalog API response structure
            const associations = data?._embedded?.associations || data?.associations || [];

            // LIMIT TO 5 associations to avoid token overflow
            return associations.slice(0, 5).map(assoc => ({
                trait: assoc.efoTraits?.map(t => t.trait)?.join(', ') || assoc.diseaseTrait?.trait || 'Unknown',
                pValue: assoc.pvalue || assoc.pValue || 'Unknown',
                orBeta: assoc.orPerCopyNum || assoc.betaNum || 'Unknown',
                riskAllele: assoc.strongestSnpRiskAlleles?.map(a => a.riskAlleleName)?.join(', ') || 'Unknown',
                pubmedId: assoc.study?.publicationInfo?.pubmedId || '',
                year: assoc.study?.publicationInfo?.publicationDate?.split('-')?.[0] || 'Unknown'
            }));
        } catch (e) {
            console.error('GWAS parse error:', e);
            return [];
        }
    }

    async queryPharmGKB(rsid) {
        const data = await this.safeFetchJSON(
            '/api/pharmgkb',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rsid })
            },
            'PharmGKB',
            rsid
        );
        return data ? this.parsePharmGKBResult(data) : null;
    }

    parsePharmGKBResult(data) {
        try {
            if (!data || data.status === 'error') return null;

            const variant = Array.isArray(data.data) ? data.data[0] : data.data;
            if (!variant) return null;

            return {
                id: variant.id || 'Unknown',
                name: variant.name || 'Unknown',
                gene: variant.gene?.symbol || 'Unknown',
                chromosome: variant.chromosome || 'Unknown',
                position: variant.position || 'Unknown',
                alleles: variant.alleles || 'Unknown',
                clinicalAnnotations: variant.clinicalAnnotations || [],
                drugLabels: variant.drugLabels || [],
                guidelines: variant.guidelines || []
            };
        } catch (e) {
            return null;
        }
    }

    async queryEnsembl(rsid) {
        const data = await this.safeFetchJSON(
            '/api/ensembl',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rsid })
            },
            'Ensembl',
            rsid
        );
        return data ? this.parseEnsemblResult(data, rsid) : null;
    }

    parseEnsemblResult(data, rsid) {
        try {
            if (!data || data.error) return null;

            return {
                rsid: rsid,
                name: data.name || rsid,
                mappings: data.mappings?.map(m => ({
                    chromosome: m.seq_region_name,
                    start: m.start,
                    end: m.end,
                    strand: m.strand,
                    alleleString: m.allele_string
                })) || [],
                ancestralAllele: data.ancestral_allele || 'Unknown',
                minorAllele: data.minor_allele || 'Unknown',
                maf: data.MAF || 'Unknown',
                consequence: data.most_severe_consequence || 'Unknown',
                synonyms: data.synonyms || []
            };
        } catch (e) {
            return null;
        }
    }

    async downloadAndExtractFullPapers(papers, snp, gene = null, autoSave = false) {
        if (!papers || papers.length === 0) return papers;

        console.log(`📥 Fetching full text for ${papers.length} papers for ${snp}...`);
        if (autoSave) {
            console.log(`📁 Auto-save enabled: Papers will be saved to collection ${gene || 'Unknown'}_${snp}`);
        }

        const enhancedPapers = [];

        for (let i = 0; i < papers.length; i++) {
            const paper = papers[i];
            console.log(`  ${i + 1}/${papers.length}: ${paper.title.substring(0, 60)}...`);

            let fullText = null;
            let fullTextSource = null;

            try {
                // STEP 0: If paper is from ArXiv, download PDF directly
                if (paper.arxivId || (paper.pdfUrl && paper.pdfUrl.includes('arxiv.org'))) {
                    console.log(`    🔍 Downloading ArXiv PDF directly...`);
                    try {
                        const downloadResponse = await fetch('/api/download-arxiv-pdf', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                arxivId: paper.arxivId,
                                pdfUrl: paper.pdfUrl
                            })
                        });

                        const downloadData = await downloadResponse.json();

                        if (downloadData.success) {
                            console.log(`    ✓ ArXiv PDF downloaded (${(downloadData.file_size / 1024 / 1024).toFixed(2)} MB)`);

                            // Extract text from PDF
                            fullText = await this.extractPdfText(downloadData.file_path);
                            if (fullText) {
                                fullTextSource = 'ArXiv PDF';
                                paper.downloadedPdfPath = downloadData.file_path;
                                console.log(`    ✓ Full text extracted (${Math.round(fullText.length / 1024)} KB)`);
                            }
                        }
                    } catch (e) {
                        console.log(`    ⚠ ArXiv download failed: ${e.message}`);
                    }
                }

                // STEP 0b: If paper is from BioRxiv/MedRxiv with PDF URL, download directly
                if (!fullText && paper.pdfUrl && (paper.pdfUrl.includes('biorxiv.org') || paper.pdfUrl.includes('medrxiv.org'))) {
                    console.log(`    🔍 Downloading ${paper.source} PDF directly...`);
                    try {
                        const browserResponse = await fetch('/api/download-paper-browser', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url: paper.pdfUrl })
                        });

                        const browserData = await browserResponse.json();

                        if (browserData.success) {
                            console.log(`    ✓ ${paper.source} PDF downloaded (${(browserData.file_size / 1024 / 1024).toFixed(2)} MB)`);

                            // Extract text from PDF
                            fullText = await this.extractPdfText(browserData.file_path);
                            if (fullText) {
                                fullTextSource = `${paper.source} PDF`;
                                paper.downloadedPdfPath = browserData.file_path;
                                console.log(`    ✓ Full text extracted (${Math.round(fullText.length / 1024)} KB)`);
                            }
                        }
                    } catch (e) {
                        console.log(`    ⚠ ${paper.source} download failed: ${e.message}`);
                    }
                }

                // STEP 1: Try PMC Full-Text API (free and legal)
                if (!fullText && paper.pmcId) {
                    console.log(`    🔍 Trying PMC Full-Text API...`);
                    try {
                        const pmcResponse = await fetch('/api/pmc-fulltext', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ pmcId: paper.pmcId })
                        });
                        if (pmcResponse.ok) {
                            const pmcData = await pmcResponse.json();
                            if (pmcData.success && pmcData.fullText) {
                                fullText = pmcData.fullText;
                                fullTextSource = 'PMC API (TXT)';
                                paper.downloadedPdfPath = pmcData.file_path; // Save path to text file
                                paper.fileType = 'txt'; // Mark as text file
                                console.log(`    ✓ Full text from PMC (${Math.round(fullText.length / 1024)} KB) - saved to ${pmcData.file_path}`);
                            }
                        }
                    } catch (e) {
                        console.log(`    ⚠ PMC API failed: ${e.message}`);
                    }
                }

                // STEP 2: Try Unpaywall for open access version
                if (!fullText && paper.doi) {
                    console.log(`    🔍 Trying Unpaywall...`);
                    try {
                        const unpaywallResponse = await fetch('/api/unpaywall', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ doi: paper.doi })
                        });

                        const unpaywallData = await unpaywallResponse.json();

                        if (unpaywallData.success && unpaywallData.is_oa && unpaywallData.pdf_url) {
                            console.log(`    ✓ Found open access PDF: ${unpaywallData.pdf_url.substring(0, 50)}...`);

                            // Download PDF via browser
                            const browserResponse = await fetch('/api/download-paper-browser', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ url: unpaywallData.pdf_url })
                            });

                            const browserData = await browserResponse.json();

                            if (browserData.success) {
                                console.log(`    ✓ Downloaded via browser (${(browserData.file_size / 1024 / 1024).toFixed(2)} MB)`);

                                // Extract text from PDF
                                fullText = await this.extractPdfText(browserData.file_path);
                                if (fullText) {
                                    fullTextSource = 'Unpaywall + Browser';
                                    paper.downloadedPdfPath = browserData.file_path;
                                    console.log(`    ✓ Full text extracted (${Math.round(fullText.length / 1024)} KB)`);
                                }
                            }
                        } else {
                            console.log(`    ⚠ No open access version available`);
                        }
                    } catch (e) {
                        console.log(`    ⚠ Unpaywall failed: ${e.message}`);
                    }
                }

                // STEP 3: Try Advanced Downloader (multiple Python libraries)
                if (!fullText && (paper.pmid || paper.doi)) {
                    console.log(`    🔍 Trying Advanced Downloader (multiple methods)...`);
                    const downloadResponse = await fetch('/api/download-paper-advanced', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            pmid: paper.pmid,
                            doi: paper.doi,
                            title: paper.title
                        })
                    });

                    const downloadData = await downloadResponse.json();

                    if (downloadData.success) {
                        console.log(`    ✓ Downloaded via ${downloadData.method} (${(downloadData.file_size / 1024 / 1024).toFixed(2)} MB)`);

                        // Extract full text from PDF
                        fullText = await this.extractPdfText(downloadData.file_path);
                        if (fullText) {
                            fullTextSource = downloadData.method;
                            paper.downloadedPdfPath = downloadData.file_path;
                            console.log(`    ✓ Full text extracted (${Math.round(fullText.length / 1024)} KB)`);
                        }
                    } else {
                        console.log(`    ⚠ Advanced download failed: ${downloadData.error}`);
                        console.log(`    Available methods: ${downloadData.available_methods?.join(', ') || 'none'}`);

                        // Fallback to original Sci-Hub if advanced fails
                        console.log(`    🔍 Trying fallback Sci-Hub...`);
                        const scihubResponse = await fetch('/api/download-paper-scihub-browser', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                pmid: paper.pmid,
                                doi: paper.doi
                            })
                        });

                        const scihubData = await scihubResponse.json();

                        if (scihubData.success) {
                            console.log(`    ✓ Downloaded from fallback Sci-Hub (${(scihubData.file_size / 1024 / 1024).toFixed(2)} MB)`);

                            fullText = await this.extractPdfText(scihubData.file_path);
                            if (fullText) {
                                fullTextSource = 'Sci-Hub (fallback)';
                                paper.downloadedPdfPath = scihubData.file_path;
                                console.log(`    ✓ Full text extracted (${Math.round(fullText.length / 1024)} KB)`);
                            }
                        } else {
                            console.log(`    ⚠ All download methods failed`);
                        }
                    }
                }

                // STEP 4: Try direct Sci-Hub URL if available (from Sci-Hub Topic Search)
                if (!fullText && paper.pdfUrl && paper.source === 'Sci-Hub Topic Search') {
                    console.log(`    🔍 Trying Sci-Hub direct URL: ${paper.pdfUrl.substring(0, 50)}...`);

                    try {
                        const scihubResponse = await fetch('/api/download-paper-scihub-browser', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                pmid: null,
                                doi: paper.doi || paper.pdfUrl
                            })
                        });

                        const scihubData = await scihubResponse.json();

                        if (scihubData.success) {
                            console.log(`    ✓ Downloaded via Sci-Hub direct (${(scihubData.file_size / 1024 / 1024).toFixed(2)} MB)`);

                            fullText = await this.extractPdfText(scihubData.file_path);
                            if (fullText) {
                                fullTextSource = 'Sci-Hub Topic';
                                paper.downloadedPdfPath = scihubData.file_path;
                                console.log(`    ✓ Full text extracted (${Math.round(fullText.length / 1024)} KB)`);
                            }
                        }
                    } catch (e) {
                        console.log(`    ⚠ Sci-Hub direct download failed: ${e.message}`);
                    }
                }

                // STEP 5: Try browser-based download as last resort (for papers with URL)
                if (!fullText && (paper.url || paper.eprint_url)) {
                    const targetUrl = paper.eprint_url || paper.url;
                    console.log(`    🔍 Trying browser download from: ${targetUrl.substring(0, 50)}...`);

                    try {
                        const browserResponse = await fetch('/api/download-paper-browser', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                url: targetUrl,
                                doi: paper.doi,
                                pmid: paper.pmid
                            })
                        });

                        const browserData = await browserResponse.json();

                        if (browserData.success) {
                            console.log(`    ✓ Downloaded via browser (${(browserData.file_size / 1024 / 1024).toFixed(2)} MB)`);

                            // Extract text from PDF
                            fullText = await this.extractPdfText(browserData.file_path);
                            if (fullText) {
                                fullTextSource = 'Browser PDF';
                                paper.downloadedPdfPath = browserData.file_path;
                                console.log(`    ✓ Full text extracted (${Math.round(fullText.length / 1024)} KB)`);
                            }
                        }
                    } catch (e) {
                        console.log(`    ⚠ Browser download failed: ${e.message}`);
                    }
                }

                // Add paper to results
                if (fullText) {
                    enhancedPapers.push({
                        ...paper,
                        fullText: fullText,
                        hasFullText: true,
                        fullTextSource: fullTextSource,
                        pdfPath: paper.downloadedPdfPath // Add PDF path for saving
                    });
                } else {
                    enhancedPapers.push({
                        ...paper,
                        hasFullText: false
                    });
                    console.log(`    ⚠ Using abstract only`);
                }

            } catch (error) {
                enhancedPapers.push(paper);
                console.log(`    ⚠ Error: ${error.message}`);
            }

            // Small delay between downloads
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        const fullTextCount = enhancedPapers.filter(p => p.hasFullText).length;
        console.log(`  ✓ Completed: ${fullTextCount}/${papers.length} papers with full text`);

        // Auto-save papers to collection if enabled
        if (autoSave && fullTextCount > 0) {
            console.log(`📁 Saving ${fullTextCount} papers to collection...`);
            for (const paper of enhancedPapers) {
                if (paper.hasFullText && paper.pdfPath) {
                    try {
                        await this.savePaperToCollection(gene, snp, paper);
                    } catch (e) {
                        console.error(`Failed to save paper: ${e.message}`);
                    }
                }
            }
            console.log(`✓ Papers saved to collection: ${gene || 'Unknown'}_${snp}`);
        }

        return enhancedPapers;
    }

    async savePaperToCollection(gene, rsid, paper) {
        try {
            const response = await fetch('/api/save-paper-to-collection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gene: gene,
                    rsid: rsid,
                    pdfPath: paper.pdfPath,
                    title: paper.title,
                    metadata: {
                        pmid: paper.pmid,
                        doi: paper.doi,
                        authors: paper.authors,
                        journal: paper.journal,
                        year: paper.year,
                        source: paper.fullTextSource,
                        abstract: paper.abstract?.substring(0, 500)
                    }
                })
            });

            const result = await response.json();
            if (result.success) {
                console.log(`  ✓ Saved: ${paper.title.substring(0, 50)}...`);
            }
            return result;
        } catch (e) {
            console.error(`Save error: ${e.message}`);
            return { success: false, error: e.message };
        }
    }

    async extractPdfText(pdfPath) {
        try {
            const extractCode = `
import PyPDF2
import os

pdf_path = r"${pdfPath.replace(/\\/g, '\\\\')}"

if not os.path.exists(pdf_path):
    print("ERROR: PDF not found")
else:
    try:
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            full_text = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    full_text.append(text)
            result = "\\n\\n".join(full_text)
            # Limit to 100,000 chars to avoid memory issues
            if len(result) > 100000:
                result = result[:100000] + "\\n\\n[TEXT TRUNCATED]"
            print(result)
    except Exception as e:
        print(f"ERROR: {str(e)}")
`;

            const extractResponse = await fetch('/api/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: extractCode })
            });

            const extractResult = await extractResponse.json();

            if (extractResult.success && extractResult.output && !extractResult.output.includes('ERROR:')) {
                return extractResult.output;
            }
            return null;
        } catch (e) {
            console.error('PDF extraction error:', e);
            return null;
        }
    }

    async queryAllDatabases(rsid, topic) {
        console.log(`Querying all databases for ${rsid}...`);

        const results = {
            rsid: rsid,
            dbsnp: null,
            ensembl: null,
            gwas: [],
            pubmed: [],
            googleScholar: [],
            arxiv: [],
            huggingface: [],
            crawly: [],
            scihubTopic: [],
            clinvar: [],
            pharmgkb: null
        };

        // Query databases - NCBI APIs (dbSNP, PubMed, ClinVar) are rate-limited to 3 req/sec
        // so we stagger NCBI calls while running non-NCBI APIs in parallel
        try {
            const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

            // Group 1: Non-NCBI APIs (can all run in parallel)
            const nonNcbiPromise = Promise.all([
                this.queryEnsembl(rsid).then(r => { console.log(`  ✓ Ensembl for ${rsid}`); return r; }).catch(e => { console.error(`Ensembl error:`, e); return null; }),
                this.queryGWASCatalog(rsid).then(r => { console.log(`  ✓ GWAS Catalog for ${rsid}: ${r.length} associations`); return r; }).catch(e => { console.error(`GWAS error:`, e); return []; }),
                this.queryGoogleScholar(rsid, topic, 15).then(r => { console.log(`  ✓ Google Scholar for ${rsid}: ${r.length} papers`); return r; }).catch(e => { console.error(`Google Scholar error:`, e); return []; }),
                this.queryArXiv(rsid, topic, 15).then(r => { console.log(`  ✓ ArXiv for ${rsid}: ${r.length} papers`); return r; }).catch(e => { console.error(`ArXiv error:`, e); return []; }),
                this.queryHuggingFacePapers(rsid, topic, 10).then(r => { console.log(`  ✓ HuggingFace for ${rsid}: ${r.length} papers`); return r; }).catch(e => { console.error(`HuggingFace error:`, e); return []; }),
                this.queryCrawlyScraper(rsid, topic, ['biorxiv', 'medrxiv']).then(r => { console.log(`  ✓ Crawly (BioRxiv/MedRxiv) for ${rsid}: ${r.length} papers`); return r; }).catch(e => { console.error(`Crawly error:`, e); return []; }),
                this.querySciHubTopic(rsid, topic, 15).then(r => { console.log(`  ✓ Sci-Hub Topic Search for ${rsid}: ${r.length} papers`); return r; }).catch(e => { console.error(`Sci-Hub Topic error:`, e); return []; }),
                this.queryPharmGKB(rsid).then(r => { console.log(`  ✓ PharmGKB for ${rsid}`); return r; }).catch(e => { console.error(`PharmGKB error:`, e); return null; })
            ]);

            // Group 2: NCBI APIs (staggered with 400ms delays to respect 3 req/sec rate limit)
            const dbsnpPromise = this.queryDbSNP(rsid).then(r => { console.log(`  ✓ dbSNP for ${rsid}`); return r; }).catch(e => { console.error(`dbSNP error:`, e); return null; });
            const pubmedPromise = delay(400).then(() => this.queryPubMed(rsid, topic, 20).then(r => { console.log(`  ✓ PubMed/PMC/Europe PMC for ${rsid}: ${r.length} papers`); return r; }).catch(e => { console.error(`PubMed error:`, e); return []; }));
            const clinvarPromise = delay(800).then(() => this.queryClinVar(rsid).then(r => { console.log(`  ✓ ClinVar for ${rsid}: ${r.length} entries`); return r; }).catch(e => { console.error(`ClinVar error:`, e); return []; }));

            // Wait for everything
            const [[ensembl, gwas, googleScholar, arxiv, huggingface, crawly, scihubTopic, pharmgkb], dbsnp, pubmed, clinvar] = await Promise.all([
                nonNcbiPromise,
                dbsnpPromise,
                pubmedPromise,
                clinvarPromise
            ]);

            results.dbsnp = dbsnp;
            results.ensembl = ensembl;
            results.gwas = gwas;
            results.arxiv = arxiv;
            results.huggingface = huggingface;
            results.crawly = crawly;
            results.scihubTopic = scihubTopic;
            results.clinvar = clinvar;
            results.pharmgkb = pharmgkb;

            // Merge all paper sources, removing duplicates by title
            const allPapers = [...pubmed];
            const existingTitles = new Set(pubmed.map(p => p.title.toLowerCase().trim()));

            // Add papers from all sources
            const otherSources = [...googleScholar, ...arxiv, ...huggingface, ...crawly, ...scihubTopic];
            for (const paper of otherSources) {
                const normalizedTitle = paper.title.toLowerCase().trim();
                if (!existingTitles.has(normalizedTitle)) {
                    allPapers.push(paper);
                    existingTitles.add(normalizedTitle);
                }
            }

            // Token reduction: rank by relevance and keep top papers
            const rankedPapers = await this.rankPapersByRelevance(allPapers, `${rsid} ${topic}`, 10);

            // Token reduction: summarize abstracts locally
            results.pubmed = await this.summarizeAbstracts(rankedPapers);

            console.log(`Query complete for ${rsid}. Total unique papers: ${allPapers.length}, after filtering: ${results.pubmed.length}`);
            console.log(`  Sources: PubMed=${pubmed.length}, Scholar=${googleScholar.length}, ArXiv=${arxiv.length}, HF=${huggingface.length}, Crawly=${crawly.length}, SciHub=${scihubTopic.length}`);
        } catch (error) {
            console.error(`Error querying databases for ${rsid}:`, error);
        }

        return results;
    }

    // ============================================================
    // PaperQA UI Methods
    // ============================================================

    togglePaperqa() {
        this.paperqaPanel.classList.toggle('active');

        // When opening, show mode selection screen
        if (this.paperqaPanel.classList.contains('active')) {
            this.showModeSelection();
        }

        // Close other panels
        if (this.sequenceLibraryPanel) this.sequenceLibraryPanel.classList.remove('active');
        if (this.vcfLibraryPanel) this.vcfLibraryPanel.classList.remove('active');
        if (this.vcfImputedLibraryPanel) this.vcfImputedLibraryPanel.classList.remove('active');
        if (this.vcfCreatorPanel) this.vcfCreatorPanel.classList.remove('active');
    }

    showModeSelection() {
        // Hide all mode pages
        document.querySelectorAll('.paperqa-mode-page').forEach(page => {
            page.classList.add('hidden');
        });

        // Show mode selection screen
        const modeSelection = document.getElementById('paperqa-mode-selection');
        if (modeSelection) {
            modeSelection.style.display = 'flex';
        }

        // Bind mode selection buttons if not already bound
        document.querySelectorAll('.mode-selection-btn').forEach(btn => {
            btn.onclick = () => {
                const mode = btn.dataset.mode;
                this.showModePage(mode);
            };
        });
    }

    showModePage(mode) {
        // Hide mode selection screen
        const modeSelection = document.getElementById('paperqa-mode-selection');
        if (modeSelection) {
            modeSelection.style.display = 'none';
        }

        // Hide all mode pages
        document.querySelectorAll('.paperqa-mode-page').forEach(page => {
            page.classList.add('hidden');
        });

        // Show selected mode page
        const pageName = `page-${mode}`;
        const modePage = document.getElementById(pageName);
        if (modePage) {
            modePage.classList.remove('hidden');
        }
    }

    async startModeAnalysis(mode) {
        console.log('=== Starting analysis for mode:', mode);

        // Get form values based on mode
        const topic = document.getElementById(`topic-${mode}`)?.value?.trim();
        const snps = document.getElementById(`snps-${mode}`)?.value?.trim();
        const enableScihub = document.getElementById(`scihub-${mode}`)?.checked || false;

        console.log('Topic:', topic);
        console.log('SNPs:', snps);
        console.log('Sci-Hub enabled:', enableScihub);

        // Validate
        if (!topic) {
            this.showError('Please enter a research topic');
            return;
        }

        if (mode === 'snps-given' && !snps) {
            this.showError('Please enter SNPs');
            return;
        }

        // Show loading
        this.showInfo('Starting analysis...');

        // Get results area
        const resultsArea = document.getElementById(`results-${mode}`);
        if (!resultsArea) {
            console.error('Results area not found:', `results-${mode}`);
            return;
        }

        resultsArea.innerHTML = '<div class="loading">🔄 Loading... Querying databases...</div>';

        try {
            // Query databases
            let snpList = [];
            if (mode === 'snps-given') {
                snpList = snps.split(/[\n,]+/).map(s => s.trim()).filter(s => s.match(/^rs\d+$/i));
                console.log('Parsed SNP list:', snpList);
            } else if (mode === 'search-snps') {
                // Search SNPs by Gene Name
                this.showInfo(`Searching SNPs for gene: ${topic}...`);
                resultsArea.innerHTML = '<div class="loading">🔄 Searching for SNPs in gene...</div>';

                try {
                    const response = await fetch('/api/search-snps-by-gene', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ geneName: topic })
                    });

                    if (!response.ok) {
                        throw new Error(`Gene search failed: ${response.statusText}`);
                    }

                    const data = await response.json();
                    console.log('Gene search result:', data);

                    if (data.snps && data.snps.length > 0) {
                        snpList = data.snps.map(s => s.rsid).slice(0, 20); // Limit to 20 SNPs
                        this.showSuccess(`Found ${data.snps.length} SNPs in gene ${topic} (analyzing top ${snpList.length})`);
                        console.log('Found SNPs:', snpList);
                    } else {
                        this.showError(`No SNPs found for gene ${topic}`);
                        resultsArea.innerHTML = `<div class="error">❌ No SNPs found for gene "${topic}".<br><br>Please check gene name (e.g., APOE, BRCA1, TP53).</div>`;
                        return;
                    }
                } catch (error) {
                    console.error('Gene search error:', error);
                    this.showError(`Gene search failed: ${error.message}`);
                    resultsArea.innerHTML = `<div class="error">❌ Gene search failed: ${error.message}</div>`;
                    return;
                }
            } else if (mode === 'discover-genes') {
                // Discover SNPs by Phenotype/Disease
                this.showInfo(`Discovering SNPs for: ${topic}...`);
                resultsArea.innerHTML = '<div class="loading">🔄 Discovering SNPs associated with phenotype...</div>';

                try {
                    const response = await fetch('/api/discover-snps-by-phenotype', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phenotype: topic })
                    });

                    if (!response.ok) {
                        throw new Error(`Phenotype search failed: ${response.statusText}`);
                    }

                    const data = await response.json();
                    console.log('Phenotype search result:', data);

                    if (data.snps && data.snps.length > 0) {
                        snpList = data.snps.map(s => s.rsid).slice(0, 20); // Limit to 20 SNPs
                        const genesFound = [...new Set(data.snps.map(s => s.gene))].join(', ');
                        this.showSuccess(`Found ${data.snps.length} SNPs associated with ${topic} in genes: ${genesFound.substring(0, 100)}...`);
                        console.log('Found SNPs:', snpList);
                        console.log('Associated genes:', genesFound);
                    } else {
                        this.showError(`No SNPs found for phenotype ${topic}`);
                        resultsArea.innerHTML = `<div class="error">❌ No SNPs found for phenotype "${topic}".<br><br>Try different terms (e.g., "alzheimer disease", "breast cancer", "diabetes").</div>`;
                        return;
                    }
                } catch (error) {
                    console.error('Phenotype search error:', error);
                    this.showError(`Phenotype search failed: ${error.message}`);
                    resultsArea.innerHTML = `<div class="error">❌ Phenotype search failed: ${error.message}</div>`;
                    return;
                }
            }

            if (snpList.length === 0) {
                this.showError('No valid SNPs found');
                resultsArea.innerHTML = '<div class="error">No valid SNPs found. Please enter SNPs in format: rs12345</div>';
                return;
            }

            resultsArea.innerHTML = `<div class="loading">🔄 Querying databases for ${snpList.length} SNP(s)...</div>`;

            // Query all databases
            const allResults = {};
            for (let i = 0; i < snpList.length; i++) {
                const snp = snpList[i];
                console.log(`Querying databases for ${snp} (${i + 1}/${snpList.length})...`);
                resultsArea.innerHTML = `<div class="loading">🔄 Querying ${snp} (${i + 1}/${snpList.length})...</div>`;

                allResults[snp] = await this.queryAllDatabases(snp, topic);
                console.log(`Results for ${snp}:`, allResults[snp]);

                // Download papers via Sci-Hub if enabled
                if (enableScihub && allResults[snp].pubmed && allResults[snp].pubmed.length > 0) {
                    resultsArea.innerHTML = `<div class="loading">📥 Fetching full text for ${snp} (${allResults[snp].pubmed.length} papers)...</div>`;

                    // Extract gene name from topic or use "Unknown"
                    const gene = topic ? topic.split(/[\s,]+/)[0] : 'Unknown';

                    allResults[snp].pubmed = await this.downloadAndExtractFullPapers(
                        allResults[snp].pubmed,
                        snp,
                        gene,
                        true // autoSave = true for automatic paper collection
                    );
                    console.log(`Enhanced papers for ${snp}:`, allResults[snp].pubmed.length);
                    this.showSuccess(`Papers saved to collection: ${gene}_${snp}`);
                }
            }

            console.log('All results:', allResults);

            // Count total papers
            let totalPapers = 0;
            for (const snp in allResults) {
                if (allResults[snp].pubmed) {
                    totalPapers += allResults[snp].pubmed.length;
                }
            }

            console.log('Total papers found:', totalPapers);

            if (totalPapers === 0) {
                resultsArea.innerHTML = '<div class="error">No papers found for the given SNPs and topic. Try different SNPs or topic.</div>';
                this.showError('No papers found');
                return;
            }

            // Display papers
            console.log('Displaying papers list...');
            this.displayPapersList(allResults, resultsArea, mode);

            this.showSuccess(`Analysis complete! Found ${totalPapers} papers.`);
        } catch (error) {
            console.error('Analysis error:', error);
            this.showError(`Analysis failed: ${error.message}`);
            resultsArea.innerHTML = `<div class="error">❌ Analysis failed: ${error.message}<br><br>Please check the console for details.</div>`;
        }
    }

    displayPapersList(allResults, container, mode) {
        console.log('=== displayPapersList called ===');
        console.log('allResults:', allResults);
        console.log('container:', container);
        console.log('mode:', mode);

        let html = '';

        // Batch Analysis & Export buttons
        html += `
            <div class="export-buttons">
                <button class="export-btn primary" onclick="app.analyzeAllPapers('${mode}')">
                    🔬 Analyze All Papers
                </button>
                <button class="export-btn primary" onclick="app.analyzeSelectedPapers('${mode}')">
                    🔬 Analyze Selected Papers
                </button>
                <button class="export-btn" onclick="app.selectAllPapers('${mode}')">
                    ☑️ Select All
                </button>
                <button class="export-btn" onclick="app.copyAllResults('${mode}')">
                    📋 Copy All
                </button>
                <button class="export-btn" onclick="app.downloadAllResults('${mode}')">
                    💾 Download All
                </button>
            </div>
        `;

        html += '<div class="paper-list">';

        let paperCount = 0;

        // Loop through SNPs and their papers
        for (const [snp, data] of Object.entries(allResults)) {
            console.log(`Processing SNP: ${snp}`, data);

            if (!data.pubmed || data.pubmed.length === 0) {
                console.log(`No papers for ${snp}`);
                continue;
            }

            console.log(`Found ${data.pubmed.length} papers for ${snp}`);

            html += `<h3 style="margin: 30px 0 20px 0; color: var(--navy);">📚 Papers for ${snp} (${data.pubmed.length} papers)</h3>`;

            data.pubmed.forEach((paper, index) => {
                paperCount++;
                const paperId = `paper-${snp}-${index}`;
                const pmidLink = paper.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}` : '#';
                const doiLink = paper.doi ? `https://doi.org/${paper.doi}` : '#';

                console.log(`Adding paper ${index + 1}:`, paper.title);

                html += `
                    <div class="paper-card" id="${paperId}" data-snp="${snp}" data-index="${index}">
                        <div style="display: flex; align-items: start; gap: 16px;">
                            <input type="checkbox" class="paper-checkbox" id="check-${paperId}" style="width: 20px; height: 20px; margin-top: 4px;">
                            <div style="flex: 1;">
                                <div class="paper-title">${paper.title || 'Untitled'}</div>
                                <div class="paper-meta">
                                    <span class="paper-meta-item">📅 ${paper.year || 'N/A'}</span>
                                    <span class="paper-meta-item">📖 ${paper.journal || 'N/A'}</span>
                                    <span class="paper-meta-item">👥 ${(paper.authors || 'N/A').substring(0, 50)}...</span>
                                    ${paper.hasFullText ? `<span class="paper-meta-item" style="color: green; font-weight: bold;">✓ Full Text (${paper.fullTextSource})</span>` : '<span class="paper-meta-item" style="color: orange;">⚠ Abstract Only</span>'}
                                    ${paper.pdfPath ? `<span class="paper-meta-item" style="color: green; font-weight: bold;">💾 Saved to Library</span>` : ''}
                                </div>
                                <div class="paper-meta">
                                    ${paper.pmid ? `<a href="${pmidLink}" target="_blank" class="paper-link">🔗 PMID: ${paper.pmid}</a>` : ''}
                                    ${paper.doi ? `<a href="${doiLink}" target="_blank" class="paper-link">🔗 DOI: ${paper.doi}</a>` : ''}
                                    ${paper.openAccessUrl ? `<a href="${paper.openAccessUrl}" target="_blank" class="paper-link" style="color: green; font-weight: bold;">📖 Open Access</a>` : ''}
                                    ${paper.pmcId ? `<a href="https://www.ncbi.nlm.nih.gov/pmc/articles/${paper.pmcId}/" target="_blank" class="paper-link" style="color: green;">📄 PMC Full Text</a>` : ''}
                                </div>
                                <div class="paper-abstract">${(paper.abstract || 'No abstract available').substring(0, 400)}...</div>
                                <div class="paper-actions">
                                    <button class="paper-action-btn-simple primary" onclick="app.analyzeDetailedPaper('${paperId}', '${snp}', ${index})">
                                        🔍 Detailed Analysis
                                    </button>
                                    <button class="paper-action-btn-simple" onclick="app.copyPaperInfo('${paperId}')">
                                        📋 Copy Info
                                    </button>
                                    <button class="paper-action-btn-simple" onclick="app.downloadPaperInfo('${paperId}')">
                                        💾 Download
                                    </button>
                                </div>
                                <div id="${paperId}-analysis" class="paper-analysis-result" style="display:none;"></div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        html += '</div>';

        console.log(`Generated HTML for ${paperCount} papers`);
        console.log('HTML length:', html.length);

        container.innerHTML = html;
        console.log('HTML inserted into container');

        // Store results for export
        this.currentModeResults = { mode, allResults };
    }

    selectAllPapers(mode) {
        const checkboxes = document.querySelectorAll('.paper-checkbox');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);

        checkboxes.forEach(cb => {
            cb.checked = !allChecked;
        });
    }

    async analyzeAllPapers(mode) {
        const allPapers = document.querySelectorAll('.paper-card');
        this.showInfo(`Starting detailed analysis of ${allPapers.length} papers...`);

        for (const paperCard of allPapers) {
            const paperId = paperCard.id;
            const snp = paperCard.dataset.snp;
            const index = parseInt(paperCard.dataset.index);

            await this.analyzeDetailedPaper(paperId, snp, index);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Delay between analyses
        }

        this.showSuccess('All papers analyzed!');
    }

    async analyzeSelectedPapers(mode) {
        const selectedCheckboxes = document.querySelectorAll('.paper-checkbox:checked');

        if (selectedCheckboxes.length === 0) {
            this.showError('Please select at least one paper');
            return;
        }

        this.showInfo(`Starting detailed analysis of ${selectedCheckboxes.length} selected papers...`);

        for (const checkbox of selectedCheckboxes) {
            const paperId = checkbox.id.replace('check-', '');
            const paperCard = document.getElementById(paperId);
            const snp = paperCard.dataset.snp;
            const index = parseInt(paperCard.dataset.index);

            await this.analyzeDetailedPaper(paperId, snp, index);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Delay between analyses
        }

        this.showSuccess('Selected papers analyzed!');
    }

    async analyzeDetailedPaper(paperId, snp, paperIndex) {
        const analysisDiv = document.getElementById(`${paperId}-analysis`);
        if (!analysisDiv) return;

        analysisDiv.style.display = 'block';
        analysisDiv.innerHTML = '<div class="loading">⏳ Performing detailed analysis... This may take a minute...</div>';

        try {
            // Get paper data
            const paper = this.currentModeResults.allResults[snp].pubmed[paperIndex];

            // Build detailed analysis prompt
            const prompt = `You are an expert genetic researcher analyzing a scientific paper for pharmacogenomics research.

**PAPER INFORMATION:**
Title: ${paper.title}
Authors: ${paper.authors}
Journal: ${paper.journal}
Year: ${paper.year}
PMID: ${paper.pmid || 'N/A'}
DOI: ${paper.doi || 'N/A'}

**FULL TEXT/ABSTRACT:**
${paper.hasFullText ? paper.fullText : paper.abstract}

**SNP OF INTEREST:** ${snp}

---

Please provide a COMPREHENSIVE ANALYSIS with the following sections:

## 1. STUDY CHARACTERISTICS
- **Study Size (n=?):** Extract exact sample size
- **Study Type:** (Meta-analysis / Cohort study / Case-control / RCT / GWAS / etc.)
- **Ethnicity:** (Caucasian / Asian / African / Mixed / Not specified)
- **Year of Publication:** ${paper.year}

## 2. EXECUTIVE SUMMARY (max 5 sentences)
Provide a concise summary of the paper's main findings related to the topic and ${snp}.

## 3. KEY FINDINGS - GENOTYPE-SPECIFIC STATEMENTS
Extract ORIGINAL SENTENCES from the paper that mention:
- Genotypes (AA, AG, GG, etc.)
- Associations with phenotypes/diseases/traits
- Odds Ratios (OR), Relative Risks (RR), p-values

Format each as:
**Quote:** "[Original sentence from paper]"
**Genotype:** [AA/AG/GG/etc.]
**Association:** [What is the association?]
**Statistics:** [OR, 95% CI, p-value if available]

## 4. ODDS RATIO (OR) & STATISTICAL SIGNIFICANCE
- Extract all OR/RR values mentioned for ${snp}
- Include 95% Confidence Intervals
- Report p-values
- Indicate statistical significance

## 5. VALIDITY ASSESSMENT FOR OUR RESEARCH
Rate the paper's validity for pharmacogenomics research:
- **Study Quality:** [High/Medium/Low] - Explain why
- **Sample Size Adequacy:** [Adequate/Limited] - Why?
- **Ethnicity Relevance:** [Highly relevant/Moderately relevant/Limited relevance]
- **Statistical Power:** [Strong/Moderate/Weak]
- **Replication Status:** [Replicated findings/Novel findings]
- **Overall Reliability Score:** [1-10] with justification

## 6. CONTRADICTORY EVIDENCE ANALYSIS ⚠️
**CRITICAL:** Search the text for any:
- Contradictory findings within this paper
- Null results
- Non-significant associations
- Conflicting genotype-phenotype directions
- Heterogeneity in results
- Limitations that weaken conclusions

**Contradiction Summary:**
- Are there contradictory results? [Yes/No]
- If yes, what specifically contradicts the main findings?
- Which genotype association is MORE LIKELY correct based on:
  - Sample size
  - Statistical significance
  - Replication
  - Biological plausibility

## 7. CLINICAL RELEVANCE FOR ${snp}
- What is the clinical actionability of these findings?
- Risk genotype vs. Protective genotype
- Effect size (strong/moderate/weak association)

## 8. LIMITATIONS & CAVEATS
- Main study limitations
- Reasons for caution in interpretation
- Need for replication

---

**FORMAT:** Use clear markdown formatting with headers, bullet points, and bold text for emphasis. Be OBJECTIVE and CRITICAL in your assessment. Include page numbers or section references if available in the full text.`;

            // Call Claude API with extended token limit
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: this.apiKey,
                    model: this.model,
                    max_tokens: 8000,
                    messages: [{ role: 'user', content: prompt }],
                    stream: false
                })
            });

            const data = await response.json();
            const analysis = data.content[0].text;

            // Display analysis with markdown formatting
            analysisDiv.innerHTML = `
                <div class="detailed-analysis">
                    <div class="analysis-header">
                        <h4>📊 Detailed Analysis Results</h4>
                        <span class="analysis-badge">✓ Full Text Analysis</span>
                    </div>
                    <div class="analysis-content">
                        ${this.formatMarkdownToHTML(analysis)}
                    </div>
                    <div class="analysis-footer">
                        <button class="paper-action-btn-simple" onclick="app.copyAnalysis('${paperId}')">
                            📋 Copy Analysis
                        </button>
                        <button class="paper-action-btn-simple" onclick="app.downloadAnalysis('${paperId}', '${snp}')">
                            💾 Download Analysis
                        </button>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Detailed analysis error:', error);
            analysisDiv.innerHTML = `<div class="error">❌ Analysis failed: ${error.message}</div>`;
        }
    }

    copyAnalysis(paperId) {
        const analysisDiv = document.getElementById(`${paperId}-analysis`);
        if (!analysisDiv) return;

        const text = analysisDiv.innerText;
        navigator.clipboard.writeText(text).then(() => {
            this.showSuccess('Analysis copied to clipboard!');
        });
    }

    downloadAnalysis(paperId, snp) {
        const analysisDiv = document.getElementById(`${paperId}-analysis`);
        if (!analysisDiv) return;

        const text = analysisDiv.innerText;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analysis-${snp}-${paperId}-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        this.showSuccess('Analysis downloaded!');
    }

    copyPaperInfo(paperId) {
        const paperCard = document.getElementById(paperId);
        if (!paperCard) return;

        const text = paperCard.innerText;
        navigator.clipboard.writeText(text).then(() => {
            this.showSuccess('Paper info copied to clipboard!');
        });
    }

    downloadPaperInfo(paperId) {
        const paperCard = document.getElementById(paperId);
        if (!paperCard) return;

        const text = paperCard.innerText;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${paperId}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    copyAllResults(mode) {
        const resultsArea = document.getElementById(`results-${mode}`);
        if (!resultsArea) return;

        const text = resultsArea.innerText;
        navigator.clipboard.writeText(text).then(() => {
            this.showSuccess('All results copied to clipboard!');
        });
    }

    downloadAllResults(mode) {
        const resultsArea = document.getElementById(`results-${mode}`);
        if (!resultsArea) return;

        const text = resultsArea.innerText;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `paperqa-results-${mode}-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        this.showSuccess('Results downloaded!');
    }

    initializePaperqaSteps() {
        // Hide all steps except Step 1 (mode selection)
        const wizardSteps = document.querySelectorAll('.wizard-step');
        wizardSteps.forEach((step, index) => {
            if (index === 0) {
                step.classList.remove('hidden'); // Step 1: Mode Selection
            } else {
                step.classList.add('hidden'); // Hide all other steps
            }
        });
    }

    closePaperqa() {
        this.paperqaPanel.classList.remove('active');
    }

    handlePaperqaModeChange(e) {
        const mode = e.target.value;

        // Update card selection styling
        document.querySelectorAll('.mode-card').forEach(card => {
            card.classList.remove('selected');
        });
        const parentCard = e.target.closest('.mode-card');
        if (parentCard) {
            parentCard.classList.add('selected');
        }

        // Show relevant steps based on selected mode
        this.showPaperqaStepsForMode(mode);
    }

    showPaperqaStepsForMode(mode) {
        const wizardSteps = document.querySelectorAll('.wizard-step');

        // Step 1: Mode Selection - always visible
        // Step 2: Topic & Context - always visible after mode selection
        // Step 3: SNP Input - only for 'snps-given' mode
        // Step 4: Preferences - always visible after mode selection

        wizardSteps.forEach((step, index) => {
            if (index === 0) {
                // Step 1: Mode Selection - always visible
                step.classList.remove('hidden');
            } else if (index === 1) {
                // Step 2: Topic & Context - show after mode selection
                step.classList.remove('hidden');
            } else if (index === 2) {
                // Step 3: SNP Input - only show for 'snps-given' mode
                if (mode === 'snps-given') {
                    step.classList.remove('hidden');
                } else {
                    step.classList.add('hidden');
                }
            } else if (index === 3) {
                // Step 4: Preferences - show after mode selection
                step.classList.remove('hidden');
            }
        });

        // Smooth scroll to Step 2 after mode selection
        setTimeout(() => {
            wizardSteps[1]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }

    handlePaperqaOutputChange(e) {
        // Update output option styling
        document.querySelectorAll('.output-card').forEach(card => {
            card.classList.remove('selected');
        });
        const parentCard = e.target.closest('.output-card');
        if (parentCard) {
            parentCard.classList.add('selected');
        }
    }

    handleSnpFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            // Parse SNPs from file (one per line or comma-separated)
            const snps = content.split(/[\n,]+/)
                .map(s => s.trim())
                .filter(s => s.match(/^rs\d+$/i));

            if (snps.length > 0) {
                this.paperqaSnps.value = snps.join('\n');
                this.paperqaLogMessage(`${snps.length} SNPs loaded from file`);
            } else {
                this.showError('No valid SNPs found in file (Format: rs12345)');
            }
        };
        reader.readAsText(file);
    }

    paperqaLogMessage(message) {
        if (this.paperqaLog) {
            const timestamp = new Date().toLocaleTimeString('de-DE');
            this.paperqaLog.textContent += `[${timestamp}] ${message}\n`;
            this.paperqaLog.scrollTop = this.paperqaLog.scrollHeight;
        }
    }

    // ============================================================
    // PaperQA Enhanced UI Methods
    // ============================================================

    switchPaperqaTab(e) {
        const tabName = e.currentTarget.dataset.tab;

        // Update tab buttons
        this.paperqaTabButtons.forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');

        // Update tab panes
        this.paperqaTabPanes.forEach(pane => pane.classList.remove('active'));
        const targetPane = document.getElementById(`pane-${tabName}`);
        if (targetPane) {
            targetPane.classList.add('active');
        }
    }

    switchSnpInputMethod(e) {
        const method = e.currentTarget.dataset.method;

        // Update button styling
        document.querySelectorAll('.input-method').forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');

        // Update content panes
        document.querySelectorAll('.method-pane').forEach(pane => pane.classList.remove('active'));
        const targetPane = document.getElementById(`${method}-input`);
        if (targetPane) {
            targetPane.classList.add('active');
        }
    }

    updateSnpCounter() {
        if (!this.paperqaSnps || !this.snpCountEl) return;

        const snps = this.paperqaSnps.value.split(/[\n,]+/)
            .map(s => s.trim())
            .filter(s => s.match(/^rs\d+$/i));

        this.snpCountEl.textContent = snps.length;
    }

    handleFileDragDrop(e) {
        e.preventDefault();
        e.stopPropagation();

        if (e.type === 'dragenter' || e.type === 'dragover') {
            this.fileDropZone.classList.add('drag-over');
        } else if (e.type === 'dragleave') {
            this.fileDropZone.classList.remove('drag-over');
        } else if (e.type === 'drop') {
            this.fileDropZone.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.paperqaSnpFile.files = files;
                this.handleSnpFileUpload({ target: { files } });
                this.showFileInfo(files[0]);
            }
        }
    }

    showFileInfo(file) {
        if (!this.fileInfo) return;

        const fileName = document.getElementById('file-name');
        const fileSize = document.getElementById('file-size');

        if (fileName) fileName.textContent = file.name;
        if (fileSize) fileSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;

        this.fileDropZone.style.display = 'none';
        this.fileInfo.style.display = 'flex';

        this.updateSnpCounter();
    }

    removeSnpFile() {
        if (this.paperqaSnpFile) this.paperqaSnpFile.value = '';
        if (this.paperqaSnps) this.paperqaSnps.value = '';
        if (this.fileDropZone) this.fileDropZone.style.display = 'flex';
        if (this.fileInfo) this.fileInfo.style.display = 'none';

        this.updateSnpCounter();
    }

    showProgressOverlay(title, message) {
        if (!this.progressOverlay) return;

        if (this.progressTitle) this.progressTitle.textContent = title;
        if (this.progressMessage) this.progressMessage.textContent = message;

        this.progressOverlay.style.display = 'flex';
    }

    hideProgressOverlay() {
        if (this.progressOverlay) {
            this.progressOverlay.style.display = 'none';
        }
    }

    updateProgressMessage(message) {
        if (this.progressMessage) {
            this.progressMessage.textContent = message;
        }
    }

    updateResultsStats(snpCount, paperCount, gwasCount, clinvarCount) {
        if (this.statSnps) this.statSnps.textContent = snpCount;
        if (this.statPapers) this.statPapers.textContent = paperCount;
        if (this.statGwas) this.statGwas.textContent = gwasCount;
        if (this.statClinvar) this.statClinvar.textContent = clinvarCount;

        // Update results badge
        if (this.resultsBadge) {
            this.resultsBadge.textContent = paperCount;
            this.resultsBadge.style.display = paperCount > 0 ? 'inline-block' : 'none';
        }
    }

    filterPaperqaResults(e) {
        const filter = e.currentTarget.dataset.filter;

        // Update button styling
        this.filterBtns.forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');

        // Filter results
        const papers = document.querySelectorAll('.paperqa-paper-card');
        papers.forEach(paper => {
            if (filter === 'all') {
                paper.style.display = 'block';
            } else {
                const source = paper.dataset.source || '';
                if (source.toLowerCase().includes(filter.toLowerCase())) {
                    paper.style.display = 'block';
                } else {
                    paper.style.display = 'none';
                }
            }
        });
    }

    searchPaperqaResults(e) {
        const query = e.target.value.toLowerCase();
        const papers = document.querySelectorAll('.paperqa-paper-card');

        papers.forEach(paper => {
            const text = paper.textContent.toLowerCase();
            if (text.includes(query)) {
                paper.style.display = 'block';
            } else {
                paper.style.display = 'none';
            }
        });
    }

    switchToResultsTab() {
        const resultsTab = document.getElementById('tab-results');
        if (resultsTab) {
            resultsTab.click();
        }
    }

    async startPaperqaAnalysis() {
        console.log('PaperQA Analysis started');

        // Get form values
        const mode = document.querySelector('input[name="paperqa-mode"]:checked')?.value || 'snps-given';
        const topic = this.paperqaTopic?.value?.trim() || '';
        const context = this.paperqaContext?.value?.trim() || '';
        const snpsRaw = this.paperqaSnps?.value?.trim() || '';
        const outputFormat = document.querySelector('input[name="output-format"]:checked')?.value || 'structured';

        console.log('Mode:', mode, 'Topic:', topic, 'SNPs:', snpsRaw);

        // Get preferences
        const preferMeta = document.getElementById('prefer-meta-studies')?.checked || false;
        const preferLarge = document.getElementById('prefer-large-cohort')?.checked || false;
        const preferCaucasian = document.getElementById('prefer-caucasian')?.checked || false;
        const includeCounter = document.getElementById('include-counter-analysis')?.checked || false;

        // Get Sci-Hub preferences
        const enableScihub = document.getElementById('enable-scihub-download')?.checked || false;
        const autoExtract = document.getElementById('auto-extract-fulltext')?.checked || false;

        console.log('Sci-Hub enabled:', enableScihub, 'Auto-extract:', autoExtract);

        // Validate
        if (!topic) {
            console.error('Validation failed: No topic');
            this.showError('Please enter a topic/research question');
            return;
        }

        // ============================================================
        // SPECIAL HANDLING FOR DISCOVER-GENES-SNPS MODE
        // ============================================================
        if (mode === 'discover-genes-snps') {
            await this.runGeneDiscoveryMode(topic, context, outputFormat, enableScihub, autoExtract);
            return;
        }

        // Parse SNPs
        let snps = [];
        if (mode === 'snps-given') {
            snps = snpsRaw.split(/[\n,]+/)
                .map(s => s.trim())
                .filter(s => s.match(/^rs\d+$/i));

            console.log('Parsed SNPs:', snps);

            if (snps.length === 0) {
                console.error('Validation failed: No valid SNPs');
                this.showError('Please enter at least one valid SNP (Format: rs12345)');
                return;
            }
        } else {
            // For search-snps mode, we don't need SNPs upfront
            console.log('Search-SNPs mode - no SNPs validation needed');
        }

        // Show loading state & progress overlay
        if (this.paperqaStartBtn) {
            this.paperqaStartBtn.disabled = true;
            this.paperqaStartBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Analyzing...</span>';
        }
        this.showProgressOverlay('Analysis running...', 'Querying databases');

        // Show log
        if (this.paperqaLogContainer) {
            this.paperqaLogContainer.style.display = 'block';
        }

        // Clear log
        if (this.paperqaLog) {
            this.paperqaLog.textContent = '';
        }
        this.paperqaLogMessage('═══════════════════════════════════════════');
        this.paperqaLogMessage('PaperQA Analysis with Database Integration');
        this.paperqaLogMessage('═══════════════════════════════════════════');
        this.paperqaLogMessage(`Mode: ${mode === 'snps-given' ? 'SNPs provided' : 'Search for SNPs'}`);
        this.paperqaLogMessage(`Topic: ${topic}`);
        if (snps.length > 0) {
            this.paperqaLogMessage(`SNPs: ${snps.join(', ')}`);
        }
        this.paperqaLogMessage('');

        try {
            console.log('Starting analysis. Mode:', mode);

            // ============================================================
            // SPECIAL HANDLING FOR SEARCH-SNPS MODE
            // ============================================================
            if (mode === 'search-snps' && snps.length === 0) {
                this.paperqaLogMessage('PHASE 1: Searching for relevant SNPs...');
                this.paperqaLogMessage('───────────────────────────────────────────');

                // First API call: Find relevant SNPs (LIMITED TO 5 to avoid token limit)
                const snpSearchPrompt = `You are an expert in genetics and pharmacogenomics.

**TASK:** Find the most important SNPs for the following topic:
**Topic:** ${topic}
${context ? `**Context:** ${context}` : ''}

**INSTRUCTIONS:**
1. List the TOP 5 most important SNPs for this topic (MAXIMUM 5!)
2. Provide ONLY the rs-IDs (e.g., rs429358, rs7412)
3. Format: One rs-ID per line, NO additional explanations
4. Only SNPs with the STRONGEST evidence and most well-known associations
5. IMPORTANT: MAXIMUM 5 SNPs!

**EXAMPLE OUTPUT:**
rs429358
rs7412
rs1801133

**YOUR ANSWER (ONLY RS-IDs, MAX 5):**`;

                this.paperqaLogMessage('Searching for relevant SNPs...');
                const snpSearchResponse = await this.callPaperqaAPI(snpSearchPrompt);

                // Parse SNPs from response (LIMIT TO 5 to avoid token overflow)
                const foundSnps = snpSearchResponse
                    .split(/[\n,]+/)
                    .map(s => s.trim())
                    .filter(s => s.match(/^rs\d+$/i))
                    .slice(0, 5); // MAXIMUM 5 SNPs to avoid token limit

                if (foundSnps.length > 0) {
                    snps = foundSnps;
                    this.paperqaLogMessage(`✓ Found SNPs (max 5): ${snps.join(', ')}`);
                    console.log('Found SNPs (limited to 5):', snps);
                } else {
                    this.paperqaLogMessage('⚠️ No SNPs found, using training knowledge...');
                    console.warn('No SNPs found in search mode');
                }
                this.paperqaLogMessage('');
            }

            // ============================================================
            // PHASE 2: Query all scientific databases for each SNP
            // ============================================================
            this.paperqaLogMessage(`PHASE ${mode === 'search-snps' ? '2' : '1'}: Querying scientific databases`);
            this.paperqaLogMessage('───────────────────────────────────────────');

            const allDatabaseResults = {};
            for (const snp of snps) {
                console.log('Querying databases for SNP:', snp);
                this.paperqaLogMessage(`Querying databases for ${snp}...`);
                allDatabaseResults[snp] = await this.queryAllDatabases(snp, topic);

                // Download and extract full papers via Sci-Hub if enabled
                if (enableScihub && autoExtract && allDatabaseResults[snp].pubmed && allDatabaseResults[snp].pubmed.length > 0) {
                    allDatabaseResults[snp].pubmed = await this.downloadAndExtractFullPapers(
                        allDatabaseResults[snp].pubmed,
                        snp
                    );
                }
            }
            console.log('Database queries complete. Results:', allDatabaseResults);

            this.paperqaLogMessage('');
            const finalPhaseNum = mode === 'search-snps' ? '3' : '2';
            this.paperqaLogMessage(`PHASE ${finalPhaseNum}: Claude AI analysis with real data`);
            this.paperqaLogMessage('───────────────────────────────────────────');
            this.paperqaResults.innerHTML = '<div class="paperqa-loading"><div class="paperqa-loading-spinner"></div>Claude is analyzing the data...</div>';

            // ============================================================
            // Build enhanced prompt with real database data
            // ============================================================
            const prompt = this.buildEnhancedPaperqaPrompt(
                mode, topic, context, snps, allDatabaseResults,
                preferMeta, preferLarge, preferCaucasian, includeCounter, outputFormat
            );

            // Call Claude API with the enriched prompt
            this.paperqaLogMessage('Sending data to Claude for analysis...');
            const response = await this.callPaperqaAPI(prompt);

            // ============================================================
            // Display combined results
            // ============================================================
            this.paperqaLogMessage('');
            const displayPhaseNum = mode === 'search-snps' ? '4' : '3';
            this.paperqaLogMessage(`PHASE ${displayPhaseNum}: Formatting results`);
            this.paperqaLogMessage('───────────────────────────────────────────');

            this.displayEnhancedPaperqaResults(response, allDatabaseResults, outputFormat);

            // Local AI Contradiction Detection
            const findings = this.extractKeyFindings(response, allDatabaseResults);
            if (findings.length >= 2) {
                this.paperqaLogMessage('');
                this.paperqaLogMessage('Running local AI contradiction detection...');
                this.paperqaLogMessage('───────────────────────────────────────────');
                const contradictionResult = await this.runLocalContradictionDetection(findings);
                if (contradictionResult && contradictionResult.contradictions.length > 0) {
                    this.displayContradictionResults(contradictionResult);
                    this.paperqaLogMessage(`✓ Contradiction analysis complete`);
                }
            }

            this.paperqaLogMessage('');
            this.paperqaLogMessage('═══════════════════════════════════════════');
            this.paperqaLogMessage('✓ Analysis completed');
            this.paperqaLogMessage('═══════════════════════════════════════════');

        } catch (error) {
            console.error('PaperQA Error:', error);
            this.showError('Error in paper analysis: ' + error.message);
            this.paperqaLogMessage(`✗ ERROR: ${error.message}`);
            this.paperqaResults.innerHTML = `<div class="paperqa-results-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p>Error in analysis</p>
            </div>`;
        } finally {
            if (this.paperqaStartBtn) {
                this.paperqaStartBtn.disabled = false;
                this.paperqaStartBtn.innerHTML = '<span class="btn-icon">🔬</span><span class="btn-text">Start Analysis</span>';
            }
            this.hideProgressOverlay();
        }
    }

    async runGeneDiscoveryMode(topic, context, outputFormat, enableScihub, autoExtract) {
        console.log('Gene Discovery Mode started');
        console.log('Sci-Hub enabled:', enableScihub, 'Auto-extract:', autoExtract);

        // Show loading state
        this.paperqaStartBtn.disabled = true;
        this.paperqaStartBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Discovering...</span>';
        this.showProgressOverlay('Gene Discovery running...', 'Searching scientific literature');

        // Show log
        if (this.paperqaLogContainer) {
            this.paperqaLogContainer.style.display = 'block';
        }

        // Clear log
        if (this.paperqaLog) {
            this.paperqaLog.textContent = '';
        }
        this.paperqaLogMessage('═══════════════════════════════════════════');
        this.paperqaLogMessage('Gene & SNP Discovery Mode');
        this.paperqaLogMessage('═══════════════════════════════════════════');
        this.paperqaLogMessage(`Topic: ${topic}`);
        if (context) {
            this.paperqaLogMessage(`Context: ${context}`);
        }
        this.paperqaLogMessage('');

        try {
            // Build prompt for Claude
            const prompt = `You are an expert in genetics and genomics. Your task is to find ALL relevant genes and SNPs (rs numbers) related to the following research topic.

**Research Topic:** ${topic}
${context ? `**Context:** ${context}` : ''}

**Instructions:**
1. Identify ALL major genes associated with this topic
2. For each gene, list the most important SNPs (rs numbers)
3. Provide the biological function of each gene
4. Include gene-disease/trait associations
5. Include pharmacogenomic relevance if applicable

**Data Sources to Consider:**
- GWAS Catalog findings
- ClinVar clinical variants
- PharmGKB drug-gene interactions
- Published literature (PubMed)

**Output Format:**
For each gene, provide:

---
**Gene: [GENE_NAME]**
- **Function:** [Brief description of gene function]
- **Association:** [Disease/trait/drug associations]
- **Key SNPs:**
  - rs[NUMBER]: [Effect/Association]
  - rs[NUMBER]: [Effect/Association]
  - ...
- **Evidence Level:** [Strong/Moderate/Weak based on number of studies]
- **Clinical Relevance:** [Clinical significance]
- **References:** [Key PMIDs if available]
---

**IMPORTANT:**
- List at least 10-20 genes if available
- For each gene, include 3-10 SNPs if known
- Focus on well-studied, clinically relevant variants
- Include both common and rare variants if relevant
- Indicate which data source(s) support each finding

Start your analysis now:`;

            this.paperqaLogMessage('PHASE 1: Querying Claude AI for gene discovery...');
            this.paperqaLogMessage('───────────────────────────────────────────');
            this.paperqaLogMessage('Sending request to Claude...');
            this.paperqaLogMessage('');

            // Show loading in results area
            this.paperqaResults.innerHTML = '<div class="paperqa-loading"><div class="paperqa-loading-spinner"></div>Discovering genes and SNPs...</div>';

            // Call Claude API
            console.log('=== CALLING CLAUDE API FOR DISCOVERY ===');
            console.log('Prompt length:', prompt.length);
            const response = await this.callPaperqaAPI(prompt);
            console.log('=== CLAUDE RESPONSE RECEIVED ===');
            console.log('Response length:', response ? response.length : 0);
            console.log('Response preview:', response ? response.substring(0, 300) : 'NO RESPONSE');

            if (!response || response.length < 50) {
                throw new Error('Claude returned empty or very short response. Check API key and model settings.');
            }

            this.paperqaLogMessage('✓ Claude analysis complete');
            this.paperqaLogMessage(`Response received: ${response.length} characters`);
            this.paperqaLogMessage('');
            this.paperqaLogMessage('PHASE 2: Processing results...');
            this.paperqaLogMessage('───────────────────────────────────────────');

            // Parse the response
            const results = this.parseGeneDiscoveryResults(response);

            this.paperqaLogMessage(`✓ Found ${results.totalGenes} genes`);
            this.paperqaLogMessage(`✓ Found ${results.totalSNPs} unique SNPs`);
            this.paperqaLogMessage(`✓ Referenced ${results.totalPapers} papers`);
            this.paperqaLogMessage('');

            // Check if SNPs were found
            if (results.totalSNPs === 0) {
                this.paperqaLogMessage('⚠️ No SNPs found - cannot continue with analysis');
                this.paperqaLogMessage('');
                this.paperqaLogMessage('Debug info:');
                this.paperqaLogMessage(`- Response length: ${response.length} chars`);
                this.paperqaLogMessage(`- Genes parsed: ${results.totalGenes}`);
                this.paperqaLogMessage(`- First 500 chars of response: ${response.substring(0, 500)}`);

                this.paperqaResults.innerHTML = `<div class="paperqa-results-placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <p>No SNPs found for this topic</p>
                    <small>Claude found ${results.totalGenes} genes but no SNPs. Check the log for debug info.</small>
                    <details style="margin-top: 20px;">
                        <summary style="cursor: pointer;">Show Claude Response</summary>
                        <pre style="text-align: left; max-height: 400px; overflow-y: auto; padding: 10px; background: #f5f5f5; border-radius: 8px; font-size: 12px; white-space: pre-wrap;">${this.escapeHtml(response)}</pre>
                    </details>
                </div>`;
                return;
            }

            // ============================================================
            // PHASE 3: Query all scientific databases for each SNP
            // ============================================================
            this.paperqaLogMessage('PHASE 3: Querying scientific databases for all SNPs');
            this.paperqaLogMessage('───────────────────────────────────────────');
            this.paperqaLogMessage('This will query GWAS, PubMed, ClinVar, dbSNP, PharmGKB, Ensembl');
            this.paperqaLogMessage('');

            const snps = results.allSNPs;
            const allDatabaseResults = {};

            for (const snp of snps) {
                console.log('Querying databases for SNP:', snp);
                this.paperqaLogMessage(`Querying databases for ${snp}...`);
                allDatabaseResults[snp] = await this.queryAllDatabases(snp, topic);

                // Download and extract full papers via Sci-Hub if enabled
                if (enableScihub && autoExtract && allDatabaseResults[snp].pubmed && allDatabaseResults[snp].pubmed.length > 0) {
                    allDatabaseResults[snp].pubmed = await this.downloadAndExtractFullPapers(
                        allDatabaseResults[snp].pubmed,
                        snp
                    );
                }
            }
            console.log('Database queries complete. Results:', allDatabaseResults);

            this.paperqaLogMessage('');
            this.paperqaLogMessage('PHASE 4: Claude AI analysis with real data');
            this.paperqaLogMessage('───────────────────────────────────────────');
            this.paperqaResults.innerHTML = '<div class="paperqa-loading"><div class="paperqa-loading-spinner"></div>Claude is analyzing the data...</div>';

            // Get preferences (use defaults for discover mode)
            const preferMeta = document.getElementById('prefer-meta-studies')?.checked || false;
            const preferLarge = document.getElementById('prefer-large-cohort')?.checked || false;
            const preferCaucasian = document.getElementById('prefer-caucasian')?.checked || false;
            const includeCounter = true; // ALWAYS include contradiction analysis

            // ============================================================
            // Build enhanced prompt with real database data + contradiction analysis
            // ============================================================
            const analysisPrompt = this.buildEnhancedPaperqaPrompt(
                'discover-genes-snps', topic, context, snps, allDatabaseResults,
                preferMeta, preferLarge, preferCaucasian, includeCounter, outputFormat
            );

            // Call Claude API with the enriched prompt
            this.paperqaLogMessage('Sending data to Claude for comprehensive analysis...');
            this.paperqaLogMessage('✓ Contradiction analysis ENABLED');
            const analysisResponse = await this.callPaperqaAPI(analysisPrompt);

            // ============================================================
            // Display combined results
            // ============================================================
            this.paperqaLogMessage('');
            this.paperqaLogMessage('PHASE 5: Formatting results');
            this.paperqaLogMessage('───────────────────────────────────────────');

            this.displayEnhancedPaperqaResults(analysisResponse, allDatabaseResults, outputFormat);

            // Local AI Contradiction Detection
            const discoveryFindings = this.extractKeyFindings(analysisResponse, allDatabaseResults);
            if (discoveryFindings.length >= 2) {
                this.paperqaLogMessage('');
                this.paperqaLogMessage('Running local AI contradiction detection...');
                this.paperqaLogMessage('───────────────────────────────────────────');
                const contradictionResult = await this.runLocalContradictionDetection(discoveryFindings);
                if (contradictionResult && contradictionResult.contradictions.length > 0) {
                    this.displayContradictionResults(contradictionResult);
                    this.paperqaLogMessage(`✓ Contradiction analysis complete`);
                }
            }

            this.paperqaLogMessage('');
            this.paperqaLogMessage('═══════════════════════════════════════════');
            this.paperqaLogMessage('✓ Complete analysis finished');
            this.paperqaLogMessage('═══════════════════════════════════════════');

            this.showSuccess(`Analysis complete! Found ${results.totalGenes} genes with ${results.totalSNPs} SNPs and analyzed all papers`);

        } catch (error) {
            console.error('Gene Discovery Error:', error);
            this.showError('Error during gene discovery: ' + error.message);
            this.paperqaLogMessage(`✗ ERROR: ${error.message}`);
            this.paperqaResults.innerHTML = `<div class="paperqa-results-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p>Error in gene discovery</p>
                <small>${error.message}</small>
            </div>`;
        } finally {
            // Reset button
            if (this.paperqaStartBtn) {
                this.paperqaStartBtn.disabled = false;
                this.paperqaStartBtn.innerHTML = '<span class="btn-icon">🔬</span><span class="btn-text">Start Analysis</span>';
            }
            this.hideProgressOverlay();
        }
    }

    displayGeneDiscoveryInPaperQA(results, rawResponse) {
        // Build HTML for results
        let html = `
            <div class="gene-discovery-results">
                <div class="discovery-summary">
                    <h3>🔬 Gene & SNP Discovery Results</h3>
                    <div class="discovery-stats">
                        <div class="stat-box">
                            <div class="stat-value">${results.totalGenes}</div>
                            <div class="stat-label">Genes Found</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value">${results.totalSNPs}</div>
                            <div class="stat-label">SNPs Found</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value">${results.totalPapers}</div>
                            <div class="stat-label">Paper References</div>
                        </div>
                    </div>
                </div>

                <div class="gene-cards-container">
        `;

        // Add gene cards
        for (const gene of results.genes) {
            html += `
                <div class="gene-card">
                    <div class="gene-card-header">
                        <h4>🧬 ${gene.name}</h4>
                        <span class="evidence-badge ${gene.evidence.toLowerCase()}">${gene.evidence}</span>
                    </div>
                    <div class="gene-card-body">
                        <p><strong>Function:</strong> ${this.escapeHtml(gene.function)}</p>
                        <p><strong>Association:</strong> ${this.escapeHtml(gene.association)}</p>
                        ${gene.snps.length > 0 ? `
                            <div class="gene-snps">
                                <strong>Key SNPs (${gene.snps.length}):</strong>
                                <div class="snp-tags">
                                    ${gene.snps.map(snp => `<span class="snp-tag">${snp}</span>`).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        html += `
                </div>

                <div class="discovery-actions">
                    <button class="btn-secondary" onclick="app.exportGeneDiscoveryCSV()">
                        📊 Export as CSV
                    </button>
                    <button class="btn-secondary" onclick="app.copyGeneDiscoverySNPs()">
                        📋 Copy All SNPs
                    </button>
                </div>

                <div class="raw-response-section">
                    <details>
                        <summary>📄 View Full Claude Response</summary>
                        <pre class="raw-response-text">${this.escapeHtml(rawResponse)}</pre>
                    </details>
                </div>
            </div>
        `;

        this.paperqaResults.innerHTML = html;

        // Store results for export
        this.lastGeneDiscoveryResults = results;
    }

    exportGeneDiscoveryCSV() {
        if (!this.lastGeneDiscoveryResults) {
            this.showError('No results to export');
            return;
        }

        // Create CSV content
        let csv = 'Gene,Function,Association,SNPs,Evidence Level\n';
        for (const gene of this.lastGeneDiscoveryResults.genes) {
            const snpList = gene.snps.join('; ');
            const functionClean = gene.function.replace(/"/g, '""');
            const associationClean = gene.association.replace(/"/g, '""');
            csv += `"${gene.name}","${functionClean}","${associationClean}","${snpList}","${gene.evidence}"\n`;
        }

        this.downloadFile('gene_discovery_results.csv', csv, 'text/csv');
        this.showSuccess('Results exported as CSV');
    }

    copyGeneDiscoverySNPs() {
        if (!this.lastGeneDiscoveryResults) {
            this.showError('No results to copy');
            return;
        }

        const snpList = this.lastGeneDiscoveryResults.allSNPs.join('\n');
        navigator.clipboard.writeText(snpList)
            .then(() => this.showSuccess(`Copied ${this.lastGeneDiscoveryResults.totalSNPs} SNPs to clipboard`))
            .catch(err => this.showError('Failed to copy to clipboard'));
    }

    buildPaperqaPrompt(mode, topic, context, snps, preferMeta, preferLarge, preferCaucasian, includeCounter, outputFormat) {
        let prompt = `Du bist ein wissenschaftlicher Assistent für SNP- und Paper-Analyse.

**Forschungsthema:** ${topic}
${context ? `**Kontext:** ${context}` : ''}

`;

        if (mode === 'search-snps') {
            prompt += `**Aufgabe:** Suche zunächst relevante SNPs zum Thema "${topic}" und finde dann für jeden SNP relevante wissenschaftliche Paper.

`;
        } else {
            prompt += `**Zu analysierende SNPs:**
${snps.map(s => `- ${s}`).join('\n')}

`;
        }

        prompt += `**Präferenzen für Paper-Auswahl:**
`;
        if (preferMeta) prompt += `- Bevorzuge Meta-Analysen und systematische Reviews\n`;
        if (preferLarge) prompt += `- Bevorzuge Studien mit großen Kohorten (>1000 Teilnehmer)\n`;
        if (preferCaucasian) prompt += `- Bevorzuge Studien mit kaukasischer/europäischer oder gemischter Ethnizität\n`;

        prompt += `
**Für jeden SNP analysiere bis zu 10 relevante Paper und liefere:**

1. **Paper-Metadaten:**
   - Titel, Autoren, Jahr, Journal
   - Studientyp (Meta-Analyse, RCT, Kohortenstudie, etc.)
   - Studiengröße (n=)

2. **Zusammenfassung:** (5 Sätze)
   - Haupterkenntnisse der Studie bezogen auf den SNP

3. **Originalzitate:**
   - 2-3 relevante Zitate aus dem Paper mit Seitenangabe wenn möglich

4. **Genotyp-Analyse:**
   - Welche Genotypen wurden untersucht?
   - Effekte pro Genotyp (z.B. AA, AG, GG)
   - Referenz-Allel vs. Risiko-Allel

5. **Odds Ratio / Effektstärke:**
   - OR mit 95% Konfidenzintervall
   - p-Wert
   - Effektrichtung

6. **Validitätsanalyse:**
   - Stärken der Studie
   - Limitationen
   - Replikation in anderen Studien?

`;

        if (includeCounter) {
            prompt += `7. **Gegen-Analyse:**
   - Gibt es widersprüchliche Studien?
   - Alternative Interpretationen der Daten?

`;
        }

        prompt += `**Am Ende für jeden SNP:**
Erstelle einen wissenschaftlichen Fließtext (5-10 Sätze) der die Erkenntnisse zum jeweiligen Genotyp zusammenfasst und klinisch einordnet.

`;

        if (outputFormat === 'excel') {
            prompt += `**Ausgabeformat:** Strukturiere die Ergebnisse so, dass sie direkt in Excel kopiert werden können (Tab-getrennte Werte oder Markdown-Tabellen).`;
        } else if (outputFormat === 'report') {
            prompt += `**Ausgabeformat:** Erstelle einen wissenschaftlichen Bericht im Paper-Stil mit Einleitung, Methoden, Ergebnissen und Diskussion.`;
        } else {
            prompt += `**Ausgabeformat:** Strukturiertes Format mit klaren Überschriften für jeden Abschnitt.`;
        }

        return prompt;
    }

    // ============================================================
    // Token Reduction: Local Summarizer & Relevance Ranker
    // ============================================================

    /**
     * Summarize paper abstracts using local summarizer service (port 8020).
     * Reduces ~400 token abstracts to ~80 tokens each.
     * Falls back to original abstracts if service is unavailable.
     */
    async summarizeAbstracts(papers) {
        if (!papers || papers.length === 0) return papers;

        // Collect abstracts that can be summarized
        const textsToSummarize = papers.map(p => (p.abstract && p.abstract.length > 150) ? p.abstract : null);
        const hasTexts = textsToSummarize.some(t => t !== null);
        if (!hasTexts) return papers;

        try {
            const response = await fetch('/api/local-models/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    texts: textsToSummarize.map(t => t || ''),
                    max_length: 80,
                    min_length: 20
                })
            });

            if (!response.ok) {
                console.warn('Summarizer service not available, using original abstracts');
                return papers;
            }

            const data = await response.json();
            if (data.error) {
                console.warn('Summarizer error:', data.error);
                return papers;
            }

            const summaries = data.summaries || [];
            let summarized = 0;
            const result = papers.map((paper, i) => {
                if (textsToSummarize[i] && summaries[i] && summaries[i].length < textsToSummarize[i].length) {
                    summarized++;
                    return {
                        ...paper,
                        originalAbstract: paper.abstract,
                        abstract: summaries[i],
                        wasSummarized: true
                    };
                }
                return paper;
            });

            console.log(`Summarized ${summarized}/${papers.length} abstracts (saved ~${Math.round(summarized * 320)} tokens)`);
            this.paperqaLogMessage(`✓ Summarized ${summarized} abstracts locally (token reduction)`);
            return result;
        } catch (error) {
            console.warn('Summarizer service unavailable:', error.message);
            return papers;
        }
    }

    /**
     * Rank papers by relevance to query using local cross-encoder service (port 8021).
     * Returns only top-N most relevant papers.
     * Falls back to all papers if service is unavailable.
     */
    async rankPapersByRelevance(papers, query, topN = 10) {
        if (!papers || papers.length <= topN) return papers;

        try {
            const documents = papers.map(p => {
                const text = p.title || '';
                const abs = p.abstract || '';
                return `${text}. ${abs}`.substring(0, 500);
            });

            const response = await fetch('/api/local-models/rank', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, documents })
            });

            if (!response.ok) {
                console.warn('Ranker service not available, keeping all papers');
                return papers;
            }

            const data = await response.json();
            if (data.error) {
                console.warn('Ranker error:', data.error);
                return papers;
            }

            const rankings = data.rankings || [];
            if (rankings.length === 0) return papers;

            // Take top-N papers by relevance score
            const topRankings = rankings.slice(0, topN);
            const topPapers = topRankings.map(r => ({
                ...papers[r.index],
                relevanceScore: r.score
            }));

            const droppedCount = papers.length - topN;
            console.log(`Ranked ${papers.length} papers, keeping top ${topN} (dropped ${droppedCount}, saved ~${droppedCount * 400} tokens)`);
            this.paperqaLogMessage(`✓ Ranked papers by relevance: kept top ${topN} of ${papers.length} (token reduction)`);
            return topPapers;
        } catch (error) {
            console.warn('Ranker service unavailable:', error.message);
            return papers;
        }
    }

    buildEnhancedPaperqaPrompt(mode, topic, context, snps, databaseResults, preferMeta, preferLarge, preferCaucasian, includeCounter, outputFormat) {
        let prompt = `SNP Analysis: ${topic}${context ? ` | ${context}` : ''}
${mode === 'discover-genes-snps' ? '**MODE: Gene Discovery** — SNPs from literature mining\n' : ''}Sources: GWAS, PubMed (+PMC full text), ClinVar, dbSNP, PharmGKB, Ensembl
"✓ FULL TEXT" papers: analyze completely. "Abstract only": supplement with training knowledge. Include contradictory findings.

`;

        // Add database results for each SNP
        for (const snp of snps) {
            const data = databaseResults[snp] || {};

            prompt += `\n## ${snp}\n`;

            // Check if we have any database results
            const hasDbResults = data.dbsnp || data.ensembl || (data.gwas?.length > 0) || (data.pubmed?.length > 0) || (data.clinvar?.length > 0) || data.pharmgkb;

            if (!hasDbResults) {
                prompt += `⚠️ No DB data found → USE YOUR KNOWLEDGE! Provide 5-10 papers from training!\n\n`;
            }

            // dbSNP Info (compressed)
            if (data.dbsnp) {
                prompt += `### dbSNP: Chr${data.dbsnp.chromosome}:${data.dbsnp.position} | ${data.dbsnp.gene} | ${data.dbsnp.alleles} | MAF=${data.dbsnp.maf}\n\n`;
            }

            // Ensembl Info (compressed)
            if (data.ensembl) {
                prompt += `### Ensembl: ${data.ensembl.minorAllele} | MAF=${data.ensembl.maf} | ${data.ensembl.consequence}\n\n`;
            }

            // GWAS Catalog (top associations)
            if (data.gwas && data.gwas.length > 0) {
                prompt += `### 🌟 GWAS (${data.gwas.length} associations, showing all):\n`;
                data.gwas.forEach((assoc, i) => {
                    prompt += `${i + 1}. ${assoc.trait} | p=${assoc.pValue} | OR=${assoc.orBeta} | ${assoc.riskAllele} | PMID:${assoc.pubmedId} | ${assoc.year}\n`;
                });
                prompt += '\n';
            }

            // PubMed Papers (with full text when available from PMC)
            if (data.pubmed && data.pubmed.length > 0) {
                const fullTextCount = data.pubmed.filter(p => p.hasFullText).length;
                prompt += `### 📚 PubMed Papers (${data.pubmed.length} found, ${fullTextCount} with FULL TEXT from PMC):\n`;
                data.pubmed.forEach((paper, i) => {
                    const textType = paper.hasFullText ? '✓ FULL TEXT' : 'Abstract only';
                    const pmcInfo = paper.pmcId ? ` | PMC ID: ${paper.pmcId}` : '';
                    prompt += `${i + 1}. ${paper.title}\n   Authors: ${paper.authors} | Year: ${paper.year} | Journal: ${paper.journal} | PMID:${paper.pmid}${pmcInfo}\n   [${textType}]${paper.hasAbstract ? `\n   Content: ${paper.abstract}` : ' (no content)'}\n\n`;
                });
            }

            // ClinVar (compressed)
            if (data.clinvar && data.clinvar.length > 0) {
                prompt += `### ClinVar (${data.clinvar.length} entries):\n`;
                data.clinvar.forEach((entry, i) => {
                    prompt += `${i + 1}. ${entry.clinicalSignificance} | ${entry.condition} | ${entry.gene}\n`;
                });
                prompt += '\n';
            }

            // PharmGKB (compressed)
            if (data.pharmgkb) {
                prompt += `### PharmGKB: ${data.pharmgkb.gene} | Annotations: ${data.pharmgkb.clinicalAnnotations?.length || 0}\n\n`;
            }
        }

        // Analysis instructions - compressed for token efficiency
        prompt += `
## ANALYSIS STRUCTURE:

Analyze EACH paper separately. For "✓ FULL TEXT" papers, use all sections (Methods, Results, Discussion). For abstracts, supplement with training knowledge.

### 1. OVERALL SUMMARY:
Overview of SNPs for "${topic}", key findings, clinical relevance, consensus vs. controversies.

### 2. PER-PAPER ANALYSIS (for each paper, min 5-10 per SNP):

**Paper [X]: [Title]**
Authors | Year | Journal | PMID | Design: [GWAS/Meta/RCT/Cohort] | n=[N] | Population
SNPs: ${snps.map(s => `${s}: OR, p-value, effect`).join('; ')}
**Findings:** 5-7 sentences, all key results (not just abstract)
**Genotypes:** AA/AG/GG (or actual alleles) — effect/risk per genotype, 5-10 sentences
**Statistics:** OR [95% CI], p-value, beta, effect direction
**Clinical significance** | **Strengths** | **Limitations**
**Contradictions:** [MANDATORY] Conflicts with other studies? Opposite genotype effects? Alternative interpretations?

### 3. FINAL SYNTHESIS:
- Consensus view | Evidence strength (strong/moderate/weak/conflicting)
- **CONFLICTING FINDINGS SUMMARY:** All contradictions with explanations (population, design, sample size, confounders)
- Clinical recommendations | Knowledge gaps

**RULES:** Analyze ALL papers found. Include training knowledge papers. ALWAYS document contradictions. English only.
`;

        return prompt;
    }

    displayEnhancedPaperqaResults(claudeResponse, databaseResults, outputFormat) {
        if (!claudeResponse) {
            this.paperqaResults.innerHTML = `<div class="paperqa-results-placeholder">
                <p>No results found</p>
            </div>`;
            return;
        }

        // Store results for export
        this.lastPaperqaResults = claudeResponse;
        this.lastDatabaseResults = databaseResults;

        // Build HTML output with improved structure
        let html = '<div class="paperqa-results-content">';

        // Database summary header - compact
        html += '<div class="paperqa-db-summary-compact">';
        let totalGwas = 0, totalPubmed = 0, totalClinvar = 0;
        for (const snp of Object.keys(databaseResults)) {
            const data = databaseResults[snp];
            totalGwas += data.gwas?.length || 0;
            totalPubmed += data.pubmed?.length || 0;
            totalClinvar += data.clinvar?.length || 0;
        }
        html += `<span class="db-badge-compact gwas">🌟 ${totalGwas} GWAS</span>`;
        html += `<span class="db-badge-compact pubmed">📚 ${totalPubmed} PubMed Papers</span>`;
        html += `<span class="db-badge-compact clinvar">🏥 ${totalClinvar} ClinVar</span>`;
        html += `<span class="db-badge-compact dbsnp">🧬 ${Object.keys(databaseResults).length} SNPs</span>`;
        html += '</div>';

        // Parse response into sections for paper-based display
        const sections = claudeResponse.split(/---+/);

        // First section is usually the summary
        if (sections.length > 0 && sections[0].trim()) {
            html += '<div class="paperqa-summary-section">';
            html += '<h2>📊 Overall Summary</h2>';
            html += this.formatMarkdownToHTML(sections[0]);
            html += '</div>';
        }

        // Remaining sections are individual papers
        html += '<div class="paperqa-papers-container">';
        html += '<h2>📚 Detailed Paper Analyses</h2>';

        for (let i = 1; i < sections.length; i++) {
            const section = sections[i].trim();
            if (section) {
                html += '<div class="paperqa-paper-card">';
                html += this.formatMarkdownToHTML(section);
                html += '</div>';
            }
        }

        html += '</div>';
        html += '</div>';

        this.paperqaResults.innerHTML = html;

        // Enable export button
        if (this.paperqaExportBtn) {
            this.paperqaExportBtn.disabled = false;
        }

        // Update statistics
        const snpCount = Object.keys(databaseResults).length;
        const paperCount = sections.length - 1; // Subtract summary section
        this.updateResultsStats(snpCount, paperCount, totalGwas, totalClinvar);

        // Switch to results tab
        this.switchToResultsTab();

        this.paperqaLogMessage(`✓ Results displayed`);
    }

    // ============================================================
    // Local AI Contradiction Detection
    // ============================================================

    extractKeyFindings(claudeResponse, dbResults) {
        if (!claudeResponse) return [];
        const findings = [];
        const sections = claudeResponse.split(/---+/);

        for (let i = 1; i < sections.length; i++) {
            const section = sections[i].trim();
            if (!section) continue;

            // Extract paper title from first heading or bold text
            const titleMatch = section.match(/^#+\s*(.+?)$/m) || section.match(/\*\*(.+?)\*\*/);
            const title = titleMatch ? titleMatch[1].replace(/[*#]/g, '').trim() : `Paper ${i}`;

            // Extract PMID if present
            const pmidMatch = section.match(/PMID[:\s]*(\d+)/i);
            const paperId = pmidMatch ? `PMID:${pmidMatch[1]}` : `paper_${i}`;

            // Extract Main Findings section
            const findingsMatch = section.match(/\*\*(?:Main |Key )?Findings?:?\*\*\s*([\s\S]*?)(?=\n\*\*|$)/i);
            // Fallback: extract first substantive paragraph
            let text = '';
            if (findingsMatch) {
                text = findingsMatch[1].trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
            } else {
                // Take first paragraph that's longer than 50 chars
                const paragraphs = section.split(/\n\n/);
                for (const p of paragraphs) {
                    const clean = p.replace(/[#*\-]/g, '').trim();
                    if (clean.length > 50) {
                        text = clean.replace(/\n/g, ' ').replace(/\s+/g, ' ');
                        break;
                    }
                }
            }

            if (text.length > 30) {
                // Limit text length for NLI models (max ~512 tokens)
                if (text.length > 500) text = text.substring(0, 500);
                findings.push({ id: paperId, title, text });
            }
        }

        return findings;
    }

    async runLocalContradictionDetection(findings) {
        try {
            // Check if any local model is available
            const statusRes = await fetch('/api/local-models/status', { method: 'POST' });
            const status = await statusRes.json();

            const debertaUp = status.deberta && status.deberta.healthy;
            const robertaUp = status.roberta && status.roberta.healthy;

            if (!debertaUp && !robertaUp) {
                this.paperqaLogMessage('Local AI models not available - skipping contradiction detection');
                return null;
            }

            let model = 'deberta';
            if (debertaUp && robertaUp) model = 'both';
            else if (robertaUp) model = 'roberta';

            const modelLabel = model === 'both' ? 'DeBERTa + RoBERTa' : status[model].model;
            this.paperqaLogMessage(`Using ${modelLabel} for contradiction analysis...`);
            this.paperqaLogMessage(`Comparing ${findings.length} paper findings (${findings.length * (findings.length - 1) / 2} pairs)...`);

            const statements = findings.map(f => ({ id: f.id, text: f.text }));

            const res = await fetch('/api/local-models/analyze-contradictions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ statements, model })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || `HTTP ${res.status}`);
            }

            const result = await res.json();
            if (!result.success) throw new Error(result.error || 'Analysis failed');

            const contradictions = (result.contradictions || [])
                .filter(c => c.contradiction_score > 0.5)
                .sort((a, b) => b.contradiction_score - a.contradiction_score);

            this.paperqaLogMessage(`Found ${contradictions.length} contradiction(s) above threshold`);
            return { contradictions, model: result.model, totalPairs: findings.length * (findings.length - 1) / 2 };
        } catch (error) {
            this.paperqaLogMessage(`Contradiction detection error: ${error.message}`);
            console.error('Contradiction detection error:', error);
            return null;
        }
    }

    displayContradictionResults(result) {
        if (!result || !result.contradictions || result.contradictions.length === 0) return;

        const { contradictions, model, totalPairs } = result;

        let html = '<div class="contradiction-results-section">';
        html += '<h2>Contradiction Analysis (Local AI)</h2>';
        html += `<div class="contradiction-summary">`;
        html += `<span class="contradiction-model-badge">${model}</span>`;
        html += `<span>${contradictions.length} contradiction${contradictions.length !== 1 ? 's' : ''} found in ${totalPairs} comparisons</span>`;
        html += '</div>';

        for (const c of contradictions) {
            const score = (c.contradiction_score * 100).toFixed(1);
            const barColor = c.contradiction_score > 0.8 ? '#ef4444' : c.contradiction_score > 0.65 ? '#f59e0b' : '#eab308';
            const label = c.predicted_label || (c.contradiction_score > 0.7 ? 'Contradiction' : 'Possible Contradiction');

            const id1 = c.statement1_id || c.paper1_id || '?';
            const id2 = c.statement2_id || c.paper2_id || '?';

            html += '<div class="contradiction-card">';
            html += '<div class="contradiction-header">';
            html += `<span class="contradiction-label" style="background:${barColor}">${label}</span>`;
            html += `<span class="contradiction-score-text">${score}%</span>`;
            html += '</div>';
            html += `<div class="contradiction-score-bar-bg"><div class="contradiction-score-bar" style="width:${score}%;background:${barColor}"></div></div>`;
            html += '<div class="contradiction-pair">';
            html += `<div class="contradiction-statement"><strong>${id1}:</strong> ${c.paper1_text || c.statement1_text || c.text1 || ''}</div>`;
            html += '<div class="contradiction-vs">VS</div>';
            html += `<div class="contradiction-statement"><strong>${id2}:</strong> ${c.paper2_text || c.statement2_text || c.text2 || ''}</div>`;
            html += '</div>';

            if (c.deberta_score != null && c.roberta_score != null) {
                html += '<div class="contradiction-model-scores">';
                html += `<span>DeBERTa: ${(c.deberta_score * 100).toFixed(1)}%</span>`;
                html += `<span>RoBERTa: ${(c.roberta_score * 100).toFixed(1)}%</span>`;
                html += '</div>';
            }

            html += '</div>';
        }

        html += '</div>';

        // Append to existing results
        if (this.paperqaResults) {
            this.paperqaResults.insertAdjacentHTML('beforeend', html);
        }
    }

    formatMarkdownToHTML(text) {
        let formatted = text
            .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/^\- (.*$)/gim, '<li>$1</li>')
            .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');

        // Wrap lists
        formatted = formatted.replace(/(<li>.*?<\/li>)(\s*<li>)/g, '$1$2');
        formatted = formatted.replace(/(<li>.*<\/li>)+/g, '<ul>$&</ul>');

        // Highlight PMIDs as links with download button
        formatted = formatted.replace(/PMID:\s*(\d+)/g, (match, pmid) => {
            return `<span class="pmid-wrapper">
                <a href="https://pubmed.ncbi.nlm.nih.gov/${pmid}" target="_blank" class="pmid-link">PMID: ${pmid}</a>
                <button class="pmid-download-btn" onclick="app.downloadPaperScihub('${pmid}', null, 'Paper PMID ${pmid}')" title="Download via Sci-Hub">
                    📥
                </button>
            </span>`;
        });

        return `<p>${formatted}</p>`;
    }

    async callPaperqaAPI(prompt) {
        if (!this.apiKey) {
            throw new Error('API key not configured');
        }

        const systemPrompt = `Expert genetics/pharmacogenomics/SNP analyst. 5-10 papers per SNP with full citations. Never say "no data". Use training knowledge freely. Prefer GWAS/meta-analyses/large cohorts. Detailed genotype analysis (5-10 sentences per genotype). Scientific terminology.`;

        this.paperqaLogMessage('Sending request to Claude API...');

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                apiKey: this.apiKey,
                model: this.model,
                messages: [
                    { role: 'user', content: prompt }
                ],
                system: systemPrompt,
                max_tokens: 8000,
                stream: false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        return data.content?.[0]?.text || data.message || '';
    }

    displayPaperqaResults(content, outputFormat) {
        if (!content) {
            this.paperqaResults.innerHTML = `<div class="paperqa-results-placeholder">
                <p>No results found</p>
            </div>`;
            return;
        }

        // Store results for export
        this.lastPaperqaResults = content;

        // Format and display
        let html = '<div class="paperqa-results-content">';

        // Convert markdown to HTML (basic conversion)
        let formattedContent = content
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^\- (.*$)/gim, '<li>$1</li>')
            .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');

        // Wrap lists
        formattedContent = formattedContent.replace(/(<li>.*<\/li>)+/g, '<ul>$&</ul>');

        html += `<p>${formattedContent}</p>`;
        html += '</div>';

        this.paperqaResults.innerHTML = html;

        // Enable export button
        if (this.paperqaExportBtn) {
            this.paperqaExportBtn.disabled = false;
        }
    }

    exportPaperqaResults(format = 'excel') {
        if (!this.lastPaperqaResults) {
            this.showError('No results available to export');
            return;
        }

        const topic = this.paperqaTopic?.value?.trim() || 'PaperQA';
        const filename = `PaperQA_${topic.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}`;

        if (format === 'excel') {
            // Export as TSV (can be opened in Excel)
            this.downloadFile(`${filename}.tsv`, this.lastPaperqaResults, 'text/tab-separated-values');
        } else {
            // Export as Markdown
            this.downloadFile(`${filename}.md`, this.lastPaperqaResults, 'text/markdown');
        }

        this.showSuccess('Results exported');
    }

    copyPaperqaResults() {
        if (!this.lastPaperqaResults) {
            this.showError('No results available to copy');
            return;
        }

        navigator.clipboard.writeText(this.lastPaperqaResults).then(() => {
            this.showSuccess('Results copied to clipboard');
        }).catch(err => {
            this.showError('Error copying: ' + err.message);
        });
    }

    downloadFile(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    clearPaperqaResults() {
        this.paperqaResults.innerHTML = `<div class="paperqa-results-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <path d="M9 15l2 2 4-4"/>
            </svg>
            <p>Results will be displayed here</p>
        </div>`;

        this.lastPaperqaResults = null;
        if (this.paperqaExportBtn) {
            this.paperqaExportBtn.disabled = true;
        }
        if (this.paperqaLog) {
            this.paperqaLog.textContent = '';
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#6366f1'};
            color: white;
            border-radius: 10px;
            font-size: 14px;
            z-index: 2000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    // ============================================================
    // Gene Discovery Methods
    // ============================================================

    parseGeneDiscoveryResults(text) {
        const genes = [];
        const snps = new Set();
        let paperCount = 0;

        console.log('=== PARSING GENE DISCOVERY RESULTS ===');
        console.log('Text length:', text.length);
        console.log('First 500 chars:', text.substring(0, 500));

        // FIRST: Extract ALL SNPs from entire text (robust fallback)
        const allRsMatches = text.matchAll(/rs(\d+)/gi);
        for (const match of allRsMatches) {
            const rsid = `rs${match[1]}`;
            snps.add(rsid);
        }
        console.log('Total SNPs found in text:', snps.size);

        // Count PMIDs in entire text
        const pmidMatches = text.match(/PMID/gi);
        if (pmidMatches) {
            paperCount = pmidMatches.length;
        }

        // Try to parse structured gene sections (marked by ---)
        const sections = text.split(/---+/);
        console.log('Sections found:', sections.length);

        for (const section of sections) {
            if (!section.trim()) continue;

            // Extract gene name - try multiple patterns
            let geneName = null;
            let geneMatch = section.match(/\*\*Gene:\s*([A-Z0-9_-]+)\*\*/i);
            if (!geneMatch) {
                geneMatch = section.match(/##\s*([A-Z0-9_-]+)\s*$/m);
            }
            if (!geneMatch) {
                geneMatch = section.match(/^([A-Z0-9_-]+)\s*$/m);
            }
            if (!geneMatch) continue;

            geneName = geneMatch[1];
            console.log('Found gene:', geneName);

            // Extract SNPs (rs numbers) from this section
            const rsMatches = section.matchAll(/rs(\d+)/gi);
            const geneSNPs = [];
            for (const match of rsMatches) {
                const rsid = `rs${match[1]}`;
                geneSNPs.push(rsid);
            }

            // Extract function - try multiple patterns
            let geneFunction = 'Function not specified';
            let functionMatch = section.match(/\*\*Function:\*\*\s*(.+?)(?=\n\*\*|\n##|$)/s);
            if (!functionMatch) {
                functionMatch = section.match(/Function:\s*(.+?)(?=\n[A-Z]|\n\*\*|$)/s);
            }
            if (functionMatch) {
                geneFunction = functionMatch[1].trim();
            }

            // Extract association - try multiple patterns
            let association = 'Association not specified';
            let assocMatch = section.match(/\*\*Association:\*\*\s*(.+?)(?=\n\*\*|\n##|$)/s);
            if (!assocMatch) {
                assocMatch = section.match(/Association:\s*(.+?)(?=\n[A-Z]|\n\*\*|$)/s);
            }
            if (assocMatch) {
                association = assocMatch[1].trim();
            }

            // Extract evidence level
            let evidence = 'Unknown';
            let evidenceMatch = section.match(/\*\*Evidence Level:\*\*\s*(.+?)(?=\n\*\*|\n##|$)/s);
            if (!evidenceMatch) {
                evidenceMatch = section.match(/Evidence Level:\s*(.+?)(?=\n[A-Z]|\n\*\*|$)/s);
            }
            if (evidenceMatch) {
                evidence = evidenceMatch[1].trim();
            }

            genes.push({
                name: geneName,
                function: geneFunction,
                association: association,
                snps: geneSNPs,
                evidence: evidence,
                section: section.trim()
            });
        }

        // If no structured genes found but SNPs exist, create generic entries
        if (genes.length === 0 && snps.size > 0) {
            console.log('No structured genes found, creating generic entry');
            genes.push({
                name: 'Multiple Genes',
                function: 'Various functions related to the research topic',
                association: 'See detailed analysis',
                snps: Array.from(snps),
                evidence: 'See papers',
                section: text.substring(0, 500)
            });
        }

        const result = {
            genes: genes,
            totalGenes: genes.length,
            totalSNPs: snps.size,
            totalPapers: paperCount,
            allSNPs: Array.from(snps)
        };

        console.log('=== PARSE RESULT ===');
        console.log('Genes:', result.totalGenes);
        console.log('SNPs:', result.totalSNPs);
        console.log('Papers:', result.totalPapers);
        console.log('SNP list:', result.allSNPs);

        return result;
    }

    // ============================================================
    // Paper Library (Sci-Hub Integration)
    // ============================================================

    async downloadPaperScihub(pmid, doi, title) {
        if (!pmid && !doi) {
            this.showError('PMID or DOI required for download');
            return;
        }

        this.showInfo(`Downloading paper via Sci-Hub: ${pmid || doi}...`);

        try {
            const response = await fetch('/api/download-paper-scihub-browser', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pmid, doi })
            });

            const data = await response.json();

            if (data.success) {
                // Save to library
                const paperData = {
                    id: `paper_${Date.now()}`,
                    pmid: pmid || null,
                    doi: doi || null,
                    title: title || `Paper ${pmid || doi}`,
                    filePath: data.file_path,
                    fileSize: data.file_size,
                    mirror: data.mirror,
                    downloadDate: new Date().toISOString()
                };

                this.paperLibrary.push(paperData);
                this.savePaperLibrary();
                this.updatePaperLibraryUI();

                this.showSuccess(`Paper downloaded successfully! ${(data.file_size / 1024 / 1024).toFixed(2)} MB`);
                return paperData;
            } else {
                this.showError(`Download failed: ${data.error}`);
                return null;
            }
        } catch (error) {
            console.error('Sci-Hub download error:', error);
            this.showError(`Download error: ${error.message}`);
            return null;
        }
    }

    savePaperLibrary() {
        localStorage.setItem('paper_library', JSON.stringify(this.paperLibrary));
    }

    async updatePaperLibraryUI() {
        // Load paper collections from server
        try {
            const response = await fetch('/api/paper-collections');
            const data = await response.json();
            const collections = data.collections || [];

            const countEl = document.getElementById('paper-count');
            if (countEl) {
                const totalPapers = collections.reduce((sum, c) => sum + c.pdfCount, 0);
                countEl.textContent = `${collections.length} (${totalPapers} papers)`;
            }

            const content = document.getElementById('paper-library-content');
            if (!content) return;

            if (collections.length === 0) {
                content.innerHTML = `
                    <div class="paper-library-empty">
                        <p>📁 No paper collections yet</p>
                        <small>When you enable "Full-Text Download", papers will be automatically organized into collections by Gene_rsID</small>
                    </div>
                `;
                return;
            }

            content.innerHTML = `
                <div class="paper-collections-header">
                    <h3>📚 Paper Collections (${collections.length})</h3>
                    <small>Organized by Gene + SNP</small>
                </div>
                ${collections.map(collection => `
                    <div class="collection-item" data-collection-id="${collection.id}">
                        <div class="collection-header" onclick="app.toggleCollection('${collection.id}')">
                            <div class="collection-info">
                                <span class="collection-icon">📁</span>
                                <div class="collection-details">
                                    <span class="collection-name">${collection.name}</span>
                                    <span class="collection-meta">
                                        ${collection.gene !== 'Unknown' ? `Gene: ${collection.gene}` : ''}
                                        ${collection.rsid !== 'Unknown' ? `• ${collection.rsid}` : ''}
                                    </span>
                                </div>
                            </div>
                            <div class="collection-stats">
                                <span class="collection-badge">${collection.pdfCount} papers</span>
                                <span class="collection-date">${new Date(collection.created).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div class="collection-content" id="collection-${collection.id}" style="display: none;">
                            <div class="collection-actions">
                                <button class="paper-action-btn primary" onclick="app.openCollectionFolder('${collection.id}')">
                                    📂 Open Folder
                                </button>
                                <button class="paper-action-btn" onclick="app.analyzeCollection('${collection.id}')">
                                    🔍 Analyze All Papers
                                </button>
                                <button class="paper-action-btn danger" onclick="app.deleteCollection('${collection.id}')">
                                    🗑️ Delete Collection
                                </button>
                            </div>
                            <div class="collection-papers">
                                <p>📄 ${collection.pdfCount} PDFs in this collection</p>
                                <small>Path: ${collection.path}</small>
                            </div>
                        </div>
                    </div>
                `).join('')}
            `;
        } catch (error) {
            console.error('Failed to load paper collections:', error);
            const content = document.getElementById('paper-library-content');
            if (content) {
                content.innerHTML = `
                    <div class="paper-library-empty">
                        <p>❌ Failed to load collections</p>
                        <small>${error.message}</small>
                    </div>
                `;
            }
        }
    }

    toggleCollection(collectionId) {
        const content = document.getElementById(`collection-${collectionId}`);
        if (content) {
            content.style.display = content.style.display === 'none' ? 'block' : 'none';
        }
    }

    openCollectionFolder(collectionId) {
        // Use Node.js child_process to open folder
        fetch('/api/open-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ collectionId: collectionId })
        }).then(r => r.json()).then(data => {
            if (data.success) {
                this.showSuccess('Folder opened in file explorer');
            } else {
                this.showError('Failed to open folder');
            }
        });
    }

    async deleteCollection(collectionId) {
        if (!confirm(`Delete collection "${collectionId}"? This will permanently delete all PDFs in this collection.`)) {
            return;
        }

        try {
            const response = await fetch('/api/delete-paper-collection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ collectionId: collectionId })
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess('Collection deleted');
                this.updatePaperLibraryUI();
            } else {
                this.showError('Failed to delete collection: ' + result.error);
            }
        } catch (error) {
            this.showError('Failed to delete collection: ' + error.message);
        }
    }

    async analyzeCollection(collectionId) {
        this.showInfo(`Analyzing all papers in collection ${collectionId}...`);
        // Implementation would load all PDFs and analyze them with Claude
        // For now, just show placeholder
        alert(`This feature will analyze all papers in the collection using Claude.\nComing soon!`);
    }

    togglePaperLibrary() {
        const panel = document.getElementById('paper-library-panel');
        if (panel) {
            panel.classList.toggle('active');
            if (panel.classList.contains('active')) {
                this.updatePaperLibraryUI();
            }
        }
    }

    closePaperLibrary() {
        const panel = document.getElementById('paper-library-panel');
        if (panel) {
            panel.classList.remove('active');
        }
    }

    deletePaper(id) {
        if (confirm('Delete this paper from library?')) {
            this.paperLibrary = this.paperLibrary.filter(p => p.id !== id);
            this.savePaperLibrary();
            this.updatePaperLibraryUI();
            this.showSuccess('Paper deleted');
        }
    }

    clearPaperLibrary() {
        if (this.paperLibrary.length === 0) return;
        if (confirm('Delete all papers from library?')) {
            this.paperLibrary = [];
            this.savePaperLibrary();
            this.updatePaperLibraryUI();
            this.showSuccess('Paper library cleared');
        }
    }

    async extractPaperText(id) {
        const paper = this.paperLibrary.find(p => p.id === id);
        if (!paper) return;

        this.showInfo('Extracting text from PDF...');

        // Generate Python code to extract text
        const code = `
import PyPDF2
import os

pdf_path = r"${paper.filePath}"

if not os.path.exists(pdf_path):
    print("ERROR: PDF file not found at:", pdf_path)
else:
    try:
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            num_pages = len(reader.pages)
            print(f"PDF has {num_pages} pages")
            print("\\n" + "="*80 + "\\n")

            full_text = []
            for i, page in enumerate(reader.pages):
                text = page.extract_text()
                full_text.append(f"--- Page {i+1} ---\\n{text}")

            print("\\n\\n".join(full_text))
    except Exception as e:
        print(f"ERROR: {str(e)}")
`;

        // Execute the code
        try {
            const response = await fetch('/api/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });

            const result = await response.json();

            if (result.success) {
                // Display extracted text in chat
                this.addMessageToChat('assistant', `**Extracted text from: ${paper.title}**\n\n${result.output}`);
                this.showSuccess('Text extracted successfully!');
            } else {
                this.showError(`Text extraction failed: ${result.error}`);
            }
        } catch (error) {
            console.error('Extraction error:', error);
            this.showError(`Extraction error: ${error.message}`);
        }
    }

    async analyzePaper(id) {
        const paper = this.paperLibrary.find(p => p.id === id);
        if (!paper) return;

        // First extract text, then send to Claude for analysis
        this.showInfo('Extracting and analyzing paper...');

        const code = `
import PyPDF2
import os

pdf_path = r"${paper.filePath}"

if not os.path.exists(pdf_path):
    print("ERROR: PDF file not found")
else:
    try:
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            full_text = []
            for page in reader.pages:
                full_text.append(page.extract_text())
            print("\\n\\n".join(full_text))
    except Exception as e:
        print(f"ERROR: {str(e)}")
`;

        try {
            const response = await fetch('/api/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });

            const result = await response.json();

            if (result.success) {
                // Send extracted text to Claude for analysis
                const analysisPrompt = `Analyze this scientific paper in detail:

Title: ${paper.title}
PMID: ${paper.pmid || 'N/A'}
DOI: ${paper.doi || 'N/A'}

Full Text:
${result.output}

Please provide:
1. Main findings and conclusions
2. Methodology used
3. Key results and statistics
4. Clinical relevance
5. Limitations`;

                this.messageInput.value = analysisPrompt;
                this.sendMessage();
                this.showSuccess('Analyzing paper with Claude...');
            } else {
                this.showError(`Analysis failed: ${result.error}`);
            }
        } catch (error) {
            console.error('Analysis error:', error);
            this.showError(`Analysis error: ${error.message}`);
        }
    }

}

// Add notification animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ClaudeScientificApp();
});
