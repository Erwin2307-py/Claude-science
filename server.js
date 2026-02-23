// Simple Node.js server for Claude Scientific Assistant
// Handles CORS and proxies requests to Claude API

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

const PORT = 3000;
const ANTHROPIC_API_URL = 'api.anthropic.com';

// Helper: HTTPS/HTTP GET with automatic redirect following (up to maxRedirects)
function httpsGetFollowRedirects(url, options = {}, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        const makeRequest = (currentUrl, redirectsLeft) => {
            const urlObj = new URL(currentUrl);
            const requestModule = urlObj.protocol === 'https:' ? https : http;
            const reqOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                timeout: options.timeout || 30000,
                rejectUnauthorized: options.rejectUnauthorized !== undefined ? options.rejectUnauthorized : true,
                headers: options.headers || {}
            };

            const req = requestModule.get(reqOptions, (res) => {
                if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
                    let redirectUrl = res.headers.location;
                    if (redirectUrl.startsWith('/')) {
                        redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
                    }
                    res.resume();
                    makeRequest(redirectUrl, redirectsLeft - 1);
                } else {
                    resolve(res);
                }
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
        };
        makeRequest(url, maxRedirects);
    });
}

// Helper: Collect response body as Buffer
function collectResponseBuffer(res) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
    });
}

// Helper: Validate PDF buffer (check magic bytes %PDF-)
function isValidPdf(buffer) {
    return buffer && buffer.length > 100 && buffer.slice(0, 5).toString() === '%PDF-';
}

// ============================================================
// Local ML Model Docker Management
// ============================================================

const LOCAL_MODEL_CONFIG = {
    deberta: {
        image: 'paper_qa_docker_2026-deberta:latest',
        port: 8010,
        name: 'paperqa-deberta',
        modelName: 'DeBERTa-v3-large'
    },
    roberta: {
        image: 'paper_qa_docker_2026-roberta-mnli:latest',
        port: 8011,
        name: 'paperqa-roberta',
        modelName: 'RoBERTa-large-MNLI'
    },
    summarizer: {
        port: 8020,
        name: 'paperqa-summarizer',
        modelName: 'Text Summarizer (Falconsai)',
        isLocalScript: true
    },
    ranker: {
        port: 8021,
        name: 'paperqa-ranker',
        modelName: 'Relevance Ranker (MiniLM)',
        isLocalScript: true
    }
};

const MODEL_CACHE_DIR = 'D:\\DockerQAimages\\model-cache';

function checkLocalModelHealth(port) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/health`, { timeout: 5000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve({ healthy: true, ...result });
                } catch {
                    resolve({ healthy: false, error: 'Invalid JSON response' });
                }
            });
        });
        req.on('error', () => resolve({ healthy: false, error: 'Service not reachable' }));
        req.on('timeout', () => { req.destroy(); resolve({ healthy: false, error: 'Timeout' }); });
    });
}

function startDockerService(serviceName) {
    const config = LOCAL_MODEL_CONFIG[serviceName];
    if (!config) return Promise.resolve({ success: false, error: `Unknown service: ${serviceName}` });

    return new Promise((resolve) => {
        // Remove any stopped container with the same name first
        const rmProc = spawn('docker', ['rm', '-f', config.name]);
        rmProc.on('close', () => {
            const args = [
                'run', '-d', '--rm',
                '-p', `${config.port}:${config.port}`,
                '--name', config.name,
                '-e', 'HF_HOME=/tmp/hf_cache',
                '-e', 'TRANSFORMERS_CACHE=/tmp/hf_cache',
                config.image
            ];

            console.log(`Starting Docker: docker ${args.join(' ')}`);
            const proc = spawn('docker', args);
            let stdout = '', stderr = '';
            proc.stdout.on('data', d => stdout += d.toString());
            proc.stderr.on('data', d => stderr += d.toString());
            proc.on('close', (code) => {
                if (code === 0) {
                    const containerId = stdout.trim().substring(0, 12);
                    console.log(`✓ Docker container started: ${config.name} (${containerId})`);
                    resolve({ success: true, containerId, name: config.name });
                } else {
                    console.error(`✗ Docker start failed for ${config.name}: ${stderr}`);
                    resolve({ success: false, error: stderr.trim() || `Exit code ${code}` });
                }
            });
            proc.on('error', (err) => {
                resolve({ success: false, error: `Docker not available: ${err.message}` });
            });
        });
    });
}

function stopDockerService(serviceName) {
    const config = LOCAL_MODEL_CONFIG[serviceName];
    const containerName = config ? config.name : serviceName;

    return new Promise((resolve) => {
        const proc = spawn('docker', ['stop', containerName]);
        let stderr = '';
        proc.stderr.on('data', d => stderr += d.toString());
        proc.on('close', (code) => {
            if (code === 0) {
                console.log(`✓ Docker container stopped: ${containerName}`);
                resolve({ success: true });
            } else {
                resolve({ success: false, error: stderr.trim() || `Exit code ${code}` });
            }
        });
        proc.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
    });
}

function proxyContradictionRequest(port, statements) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ statements });
        const req = http.request({
            hostname: 'localhost',
            port: port,
            path: '/analyze_contradictions',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
            timeout: 600000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    reject(new Error('Invalid JSON from model service'));
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Model request timed out')); });
        req.write(postData);
        req.end();
    });
}

// MIME types for static files
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, anthropic-version');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // API proxy endpoint with STREAMING support
    if (req.url === '/api/chat' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const requestData = JSON.parse(body);
                const { apiKey, stream, ...claudeRequest } = requestData;

                if (!apiKey) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: { message: 'API key required' } }));
                    return;
                }

                // Add stream parameter to Claude request
                claudeRequest.stream = stream || false;

                // Forward request to Claude API
                const options = {
                    hostname: ANTHROPIC_API_URL,
                    port: 443,
                    path: '/v1/messages',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01'
                    }
                };

                const proxyReq = https.request(options, (proxyRes) => {
                    if (stream) {
                        // Streaming mode: forward chunks as Server-Sent Events
                        res.writeHead(200, {
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            'Connection': 'keep-alive'
                        });

                        proxyRes.on('data', chunk => {
                            res.write(chunk);
                        });

                        proxyRes.on('end', () => {
                            res.end();
                        });
                    } else {
                        // Non-streaming mode: buffer and send complete response
                        let data = '';
                        proxyRes.on('data', chunk => {
                            data += chunk;
                        });

                        proxyRes.on('end', () => {
                            res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
                            res.end(data);
                        });
                    }
                });

                proxyReq.on('error', (error) => {
                    console.error('Proxy error:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: { message: error.message } }));
                });

                proxyReq.write(JSON.stringify(claudeRequest));
                proxyReq.end();

            } catch (error) {
                console.error('Server error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: { message: error.message } }));
            }
        });
        return;
    }

    // ============================================================
    // Scientific Database API Endpoints
    // ============================================================

    // dbSNP Query - Get SNP information from NCBI
    if (req.url === '/api/dbsnp' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { rsid } = JSON.parse(body);
                if (!rsid) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'rsid required' }));
                    return;
                }

                const snpId = rsid.replace(/^rs/i, '');
                const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=snp&id=${snpId}&retmode=json`;

                // Helper to attempt the request with retry on rate-limit (HTML response)
                const attempt = (retryCount) => {
                    https.get(url, (apiRes) => {
                        let data = '';
                        apiRes.on('data', chunk => data += chunk);
                        apiRes.on('end', () => {
                            // NCBI returns HTML error pages on rate-limit instead of JSON
                            if (data.trim().startsWith('<') || data.includes('<!DOCTYPE')) {
                                if (retryCount < 2) {
                                    console.log(`dbSNP rate-limited for ${rsid}, retrying in 1s (attempt ${retryCount + 2}/3)...`);
                                    setTimeout(() => attempt(retryCount + 1), 1000);
                                } else {
                                    console.log(`dbSNP rate-limited for ${rsid}, all retries exhausted`);
                                    res.writeHead(200, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ error: 'NCBI rate limit exceeded, try again later' }));
                                }
                                return;
                            }
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(data);
                        });
                    }).on('error', (err) => {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: err.message }));
                    });
                };
                attempt(0);
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // PubMed Search - Search for papers related to SNP
    if (req.url === '/api/pubmed' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { rsid, topic, maxResults = 20 } = JSON.parse(body);
                if (!rsid) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'rsid required' }));
                    return;
                }

                // SIMPLE AND EFFECTIVE: Just search for the rsID directly
                // PubMed will find all papers that mention it
                const searchLimit = 100; // Get more results

                console.log(`Searching for ${rsid} in PubMed, PMC, and Europe PMC...`);

                const trySearch = (term, db = 'pubmed') => {
                    return new Promise((resolve) => {
                        const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=${db}&term=${encodeURIComponent(term)}&retmax=${searchLimit}&retmode=json&sort=relevance`;

                        https.get(searchUrl, (searchRes) => {
                            let searchData = '';
                            searchRes.on('data', chunk => searchData += chunk);
                            searchRes.on('end', () => {
                                try {
                                    const searchResult = JSON.parse(searchData);
                                    const ids = searchResult.esearchresult?.idlist || [];
                                    console.log(`  ${db}: ${ids.length} papers`);
                                    resolve({ ids, db });
                                } catch (e) {
                                    resolve({ ids: [], db });
                                }
                            });
                        }).on('error', () => resolve({ ids: [], db }));
                    });
                };

                // Europe PMC search
                const tryEuropePMC = (term) => {
                    return new Promise((resolve) => {
                        const searchUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(term)}&format=json&pageSize=${searchLimit}&resultType=core`;

                        https.get(searchUrl, (searchRes) => {
                            let searchData = '';
                            searchRes.on('data', chunk => searchData += chunk);
                            searchRes.on('end', () => {
                                try {
                                    const searchResult = JSON.parse(searchData);
                                    const results = searchResult.resultList?.result || [];
                                    const ids = results
                                        .filter(r => r.pmid)
                                        .map(r => r.pmid);
                                    console.log(`  Europe PMC: ${ids.length} papers with PMIDs`);
                                    if (ids.length > 0) {
                                        console.log(`  Europe PMC first 5 PMIDs: ${ids.slice(0, 5).join(', ')}`);
                                    }
                                    resolve({ ids, db: 'europepmc' });
                                } catch (e) {
                                    resolve({ ids: [], db: 'europepmc' });
                                }
                            });
                        }).on('error', () => resolve({ ids: [], db: 'europepmc' }));
                    });
                };

                // Search in all databases in parallel
                const searchTerm = topic ? `${rsid} ${topic}` : rsid;

                // Search sequentially to avoid NCBI rate limiting (3 req/sec without API key)
                const pubmedResult = await trySearch(searchTerm, 'pubmed');
                await new Promise(resolve => setTimeout(resolve, 400)); // 400ms delay
                const europeResult = await tryEuropePMC(searchTerm);

                // Skip PMC as it returns PMC IDs not PMIDs
                const pmcResult = { ids: [] };

                // Combine and deduplicate IDs
                // IMPORTANT: Only use PubMed and Europe PMC results (which return PMIDs)
                // PMC results return PMC IDs which are incompatible with PubMed efetch
                const allIds = new Set();
                [pubmedResult, europeResult].forEach(result => {
                    result.ids.forEach(id => {
                        // Ensure it's a valid PMID (numeric and reasonable range)
                        // PubMed PMIDs grow ~2M/year. As of 2026, highest is ~42M.
                        // Using 50M as upper bound to stay safe for a few years.
                        const numId = parseInt(id);
                        if (!isNaN(numId) && numId > 0 && numId < 50000000) {
                            allIds.add(id);
                        } else if (numId >= 50000000) {
                            console.log(`  ⚠ Rejecting suspicious PMID ${id} (too high, likely invalid)`);
                        }
                    });
                });

                const ids = Array.from(allIds).slice(0, Math.min(maxResults, 50));

                console.log(`Total unique papers found: ${allIds.size}`);
                console.log(`Returning: ${ids.length} papers`);
                console.log(`First 10 PMIDs: ${ids.slice(0, 10).join(', ')}`);

                if (ids.length === 0) {
                    console.log(`⚠ No papers found for ${rsid} with topic "${topic}"`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ papers: [] }));
                    return;
                }

                // Fetch paper details (with abstracts)
                const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(',')}&retmode=xml`;
                console.log(`Fetching ${ids.length} paper details from PubMed...`);
                console.log(`Fetch URL: ${fetchUrl.substring(0, 150)}...`);

                https.get(fetchUrl, (fetchRes) => {
                    let fetchData = '';
                    fetchRes.on('data', chunk => fetchData += chunk);
                    fetchRes.on('end', async () => {
                        console.log(`Received ${fetchData.length} bytes of XML data`);

                        // Debug: If response is suspiciously small, log it
                        if (fetchData.length < 200) {
                            console.log('⚠ NCBI returned unusually small response:');
                            console.log(fetchData);
                        }

                        // Parse XML to extract abstracts and PMC IDs

                        // Helper function to fetch PMC full text
                        const fetchPMCFullText = (pmcId) => {
                            return new Promise((resolve) => {
                                const pmcUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=${pmcId}&retmode=xml`;
                                https.get(pmcUrl, (pmcRes) => {
                                    let pmcData = '';
                                    pmcRes.on('data', chunk => pmcData += chunk);
                                    pmcRes.on('end', () => {
                                        // Extract full text sections
                                        let fullText = '';

                                        // Try to extract body text
                                        const bodyMatch = pmcData.match(/<body>([\s\S]*?)<\/body>/i);
                                        if (bodyMatch) {
                                            const body = bodyMatch[1];
                                            // Extract all paragraphs
                                            const paragraphs = body.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
                                            if (paragraphs) {
                                                fullText = paragraphs.map(p =>
                                                    p.replace(/<[^>]+>/g, ' ')
                                                     .replace(/\s+/g, ' ')
                                                     .trim()
                                                ).join('\n\n');
                                            }
                                        }

                                        // Limit to 30000 chars
                                        resolve(fullText.substring(0, 30000));
                                    });
                                }).on('error', () => resolve(''));
                            });
                        };

                        // Simple XML parsing for PubMed data
                        const parsePromises = ids.map(async id => {
                            const pmidRegex = new RegExp(`<PMID[^>]*>${id}</PMID>([\\s\\S]*?)(?=<PMID|$)`, 'i');
                            const match = fetchData.match(pmidRegex);

                            if (!match) {
                                console.log(`  ⚠ No match found for PMID ${id}`);
                                return null;
                            }

                            const paperXml = match[0];

                            // Extract title (handle CDATA and special chars)
                            let titleMatch = paperXml.match(/<ArticleTitle>(.*?)<\/ArticleTitle>/is);
                            let title = 'Unknown title';
                            if (titleMatch) {
                                title = titleMatch[1]
                                    .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
                                    .replace(/<[^>]+>/g, '')
                                    .trim();
                            }

                            // Extract abstract (handle multiple AbstractText tags)
                            const abstractMatches = paperXml.match(/<AbstractText[^>]*>(.*?)<\/AbstractText>/gis);
                            let abstract = '';
                            if (abstractMatches) {
                                abstract = abstractMatches.map(a =>
                                    a.replace(/<AbstractText[^>]*>/i, '')
                                     .replace(/<\/AbstractText>/i, '')
                                     .replace(/<[^>]+>/g, '')
                                     .trim()
                                ).join(' ');
                            }

                            // Extract year
                            const yearMatch = paperXml.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/i);
                            const year = yearMatch ? yearMatch[1] : 'Unknown';

                            // Extract journal
                            const journalMatch = paperXml.match(/<Title>([^<]+)<\/Title>/i);
                            const journal = journalMatch ? journalMatch[1] : 'Unknown';

                            // Extract authors
                            const authorMatches = paperXml.match(/<Author[^>]*>[\s\S]*?<LastName>([^<]+)<\/LastName>[\s\S]*?<\/Author>/gi);
                            const authors = authorMatches ? authorMatches.slice(0, 3).map(a => {
                                const lastNameMatch = a.match(/<LastName>([^<]+)<\/LastName>/);
                                return lastNameMatch ? lastNameMatch[1] : '';
                            }).filter(a => a).join(', ') + (authorMatches.length > 3 ? ' et al.' : '') : 'Unknown';

                            // Extract PMC ID
                            const pmcMatch = paperXml.match(/<ArticleId IdType="pmc">(PMC\d+)<\/ArticleId>/i);
                            const pmcId = pmcMatch ? pmcMatch[1] : null;

                            // Extract DOI
                            const doiMatch = paperXml.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/i);
                            const doi = doiMatch ? doiMatch[1] : null;

                            // Fetch full text if PMC ID available
                            let fullText = abstract;
                            let hasFullText = false;

                            if (pmcId) {
                                console.log(`Fetching full text for ${id} (${pmcId})...`);
                                const pmcText = await fetchPMCFullText(pmcId);
                                if (pmcText && pmcText.length > abstract.length) {
                                    fullText = `ABSTRACT:\n${abstract}\n\nFULL TEXT:\n${pmcText}`;
                                    hasFullText = true;
                                    console.log(`✓ Full text fetched for ${id}: ${pmcText.length} chars`);
                                }
                            }

                            return {
                                pmid: id,
                                pmcId: pmcId,
                                doi: doi,
                                title: title,
                                abstract: abstract,
                                fullText: fullText,
                                hasFullText: hasFullText,
                                authors: authors,
                                journal: journal,
                                year: year,
                                openAccessUrl: pmcId ? `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcId}/` : (doi ? `https://doi.org/${doi}` : null)
                            };
                        });

                        // Wait for all papers including full text fetches
                        const results = await Promise.all(parsePromises);
                        const papers = results.filter(p => p !== null);

                        const fullTextCount = papers.filter(p => p.hasFullText).length;
                        console.log(`PubMed query complete: ${papers.length} papers, ${fullTextCount} with full text from PMC`);

                        // Note: Papers can also be downloaded via Sci-Hub using /api/download-paper-scihub
                        // with the PMID for papers without PMC full text

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            papers: papers,
                            scihub_available: true,
                            message: `${fullTextCount}/${papers.length} papers have PMC full text. Others can be downloaded via Sci-Hub.`
                        }));
                    });
                }).on('error', (err) => {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                });
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // ClinVar Query - Get clinical significance
    if (req.url === '/api/clinvar' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { rsid } = JSON.parse(body);
                if (!rsid) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'rsid required' }));
                    return;
                }

                console.log(`ClinVar search for: ${rsid}`);

                // Search ClinVar for the rsid
                const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=clinvar&term=${rsid}[All Fields]&retmode=json&retmax=20`;

                https.get(searchUrl, (searchRes) => {
                    let searchData = '';
                    searchRes.on('data', chunk => searchData += chunk);
                    searchRes.on('end', () => {
                        try {
                            // Check for NCBI rate-limit HTML response
                            if (searchData.trim().startsWith('<') || searchData.includes('<!DOCTYPE')) {
                                console.log(`ClinVar search rate-limited for ${rsid}`);
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ results: [], error: 'NCBI rate limit' }));
                                return;
                            }

                            const searchResult = JSON.parse(searchData);
                            const ids = searchResult.esearchresult?.idlist || [];

                            console.log(`ClinVar: Found ${ids.length} entries`);

                            if (ids.length === 0) {
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ results: [] }));
                                return;
                            }

                            // Delay before second NCBI call to respect rate limits
                            setTimeout(() => {
                                const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=clinvar&id=${ids.join(',')}&retmode=json`;

                                https.get(fetchUrl, (fetchRes) => {
                                    let fetchData = '';
                                    fetchRes.on('data', chunk => fetchData += chunk);
                                    fetchRes.on('end', () => {
                                        // Check for rate-limit on summary fetch too
                                        if (fetchData.trim().startsWith('<') || fetchData.includes('<!DOCTYPE')) {
                                            console.log(`ClinVar summary rate-limited for ${rsid}`);
                                            res.writeHead(200, { 'Content-Type': 'application/json' });
                                            res.end(JSON.stringify({ results: [], error: 'NCBI rate limit' }));
                                            return;
                                        }
                                        res.writeHead(200, { 'Content-Type': 'application/json' });
                                        res.end(fetchData);
                                    });
                                }).on('error', (err) => {
                                    res.writeHead(500, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ error: err.message }));
                                });
                            }, 400);

                        } catch (e) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: e.message }));
                        }
                    });
                }).on('error', (err) => {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                });
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // GWAS Catalog Query - Get GWAS associations (PREFERRED!)
    if (req.url === '/api/gwas' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { rsid } = JSON.parse(body);
                if (!rsid) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'rsid required' }));
                    return;
                }

                // GWAS Catalog REST API
                const url = `https://www.ebi.ac.uk/gwas/rest/api/singleNucleotidePolymorphisms/${rsid}/associations?projection=associationBySnp`;

                https.get(url, (apiRes) => {
                    let data = '';
                    apiRes.on('data', chunk => data += chunk);
                    apiRes.on('end', () => {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(data);
                    });
                }).on('error', (err) => {
                    // Try alternative endpoint if first fails
                    const altUrl = `https://www.ebi.ac.uk/gwas/rest/api/singleNucleotidePolymorphisms/search/findByRsId?rsId=${rsid}`;
                    https.get(altUrl, (altRes) => {
                        let altData = '';
                        altRes.on('data', chunk => altData += chunk);
                        altRes.on('end', () => {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(altData);
                        });
                    }).on('error', (altErr) => {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: altErr.message }));
                    });
                });
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // PharmGKB Query - Get pharmacogenomics data
    if (req.url === '/api/pharmgkb' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { rsid } = JSON.parse(body);
                if (!rsid) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'rsid required' }));
                    return;
                }

                console.log(`PharmGKB search for: ${rsid}`);

                // PharmGKB API
                const url = `https://api.pharmgkb.org/v1/data/variant?symbol=${rsid}`;

                const options = {
                    hostname: 'api.pharmgkb.org',
                    path: `/v1/data/variant?symbol=${rsid}`,
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                };

                https.get(options, (apiRes) => {
                    let data = '';
                    apiRes.on('data', chunk => data += chunk);
                    apiRes.on('end', () => {
                        try {
                            const result = JSON.parse(data);
                            console.log(`PharmGKB: Found ${result.data?.length || 0} variants`);
                        } catch (e) {
                            console.log(`PharmGKB: Response received (${data.length} bytes)`);
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(data);
                    });
                }).on('error', (err) => {
                    console.error(`PharmGKB error: ${err.message}`);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                });
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // Ensembl VEP - Variant Effect Predictor
    if (req.url === '/api/ensembl' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { rsid } = JSON.parse(body);
                if (!rsid) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'rsid required' }));
                    return;
                }

                // Ensembl REST API for variant info
                const options = {
                    hostname: 'rest.ensembl.org',
                    path: `/variation/human/${rsid}?content-type=application/json`,
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };

                https.get(options, (apiRes) => {
                    let data = '';
                    apiRes.on('data', chunk => data += chunk);
                    apiRes.on('end', () => {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(data);
                    });
                }).on('error', (err) => {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                });
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // Python code execution endpoint
    if (req.url === '/api/execute' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { code } = JSON.parse(body);

                if (!code) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'No code provided' }));
                    return;
                }

                // Create temporary Python file
                const tempDir = os.tmpdir();
                const tempFile = path.join(tempDir, `claude_exec_${Date.now()}.py`);

                fs.writeFileSync(tempFile, code, 'utf8');

                // Execute Python with timeout and UTF-8 encoding
                const pythonProcess = spawn('python', ['-u', tempFile], {
                    timeout: 120000,  // 2 Minuten für wissenschaftliche Berechnungen
                    cwd: tempDir,
                    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
                });

                let stdout = '';
                let stderr = '';

                pythonProcess.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                pythonProcess.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                // Set timeout (2 Minuten für wissenschaftliche Berechnungen)
                const timeout = setTimeout(() => {
                    pythonProcess.kill();
                    stderr += '\n[Timeout: Execution exceeded 2 minutes]';
                }, 120000);

                pythonProcess.on('close', (exitCode) => {
                    clearTimeout(timeout);

                    // Clean up temp file
                    try {
                        fs.unlinkSync(tempFile);
                    } catch (e) {
                        // Ignore cleanup errors
                    }

                    // Format long sequences with line breaks (70 chars per line for readability)
                    // Matches DNA/RNA sequences and protein sequences longer than 70 chars
                    const formatSequences = (text) => {
                        // DNA/RNA sequences
                        text = text.replace(/([ATGCUNRYWSMKHBVD]{70,})/gi, (match) => {
                            const lines = [];
                            for (let i = 0; i < match.length; i += 70) {
                                lines.push(match.substring(i, i + 70));
                            }
                            return lines.join('\n');
                        });
                        // Protein sequences (amino acids)
                        text = text.replace(/([ACDEFGHIKLMNPQRSTVWY*]{70,})/g, (match) => {
                            const lines = [];
                            for (let i = 0; i < match.length; i += 70) {
                                lines.push(match.substring(i, i + 70));
                            }
                            return lines.join('\n');
                        });
                        return text;
                    };

                    const formattedOutput = formatSequences(stdout);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: exitCode === 0,
                        output: formattedOutput,
                        rawOutput: stdout,  // Unformatierte Ausgabe für Sequenzerkennung
                        error: stderr,
                        exitCode: exitCode
                    }));
                });

                pythonProcess.on('error', (err) => {
                    clearTimeout(timeout);

                    // Clean up temp file
                    try {
                        fs.unlinkSync(tempFile);
                    } catch (e) {
                        // Ignore cleanup errors
                    }

                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: `Failed to execute Python: ${err.message}. Make sure Python is installed and in PATH.`
                    }));
                });

            } catch (error) {
                console.error('Execute error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // IDAT folder scanning endpoint
    if (req.url === '/api/scan-idat' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { folderPath } = JSON.parse(body);

                if (!folderPath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'No folder path provided' }));
                    return;
                }

                // Check if folder exists
                if (!fs.existsSync(folderPath)) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Folder not found' }));
                    return;
                }

                // Scan for IDAT files
                const files = fs.readdirSync(folderPath);
                const idatFiles = files.filter(f => f.toLowerCase().endsWith('.idat'));

                // Group by sample (Sentrix barcode_position format)
                const samples = {};
                idatFiles.forEach(file => {
                    // Pattern: XXXXXXXXXXXXXX_R0XC0X_Grn.idat or _Red.idat
                    const match = file.match(/^(.+)_(Grn|Red)\.idat$/i);
                    if (match) {
                        const sampleId = match[1];
                        if (!samples[sampleId]) {
                            samples[sampleId] = { grn: null, red: null };
                        }
                        if (match[2].toLowerCase() === 'grn') {
                            samples[sampleId].grn = file;
                        } else {
                            samples[sampleId].red = file;
                        }
                    }
                });

                // Filter complete pairs (need both Grn and Red)
                const completeSamples = Object.entries(samples)
                    .filter(([id, files]) => files.grn && files.red)
                    .map(([id, files]) => ({
                        id,
                        grnFile: files.grn,
                        redFile: files.red,
                        fullPath: path.join(folderPath, files.grn.replace('_Grn.idat', ''))
                    }));

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    folderPath,
                    totalIdatFiles: idatFiles.length,
                    completeSamples: completeSamples.length,
                    samples: completeSamples
                }));

            } catch (error) {
                console.error('Scan IDAT error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // VCF creation from IDAT endpoint
    if (req.url === '/api/create-vcf' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const {
                    idatFolder,
                    outputDir,
                    reference,
                    method,
                    manifestPath,
                    clusterPath,
                    csvManifestPath,
                    genomeFastaPath,
                    useBeagle,
                    useDocker,
                    beagleJarPath,
                    beagleRefPath,
                    gpFilter,
                    chromosomes,
                    usePharmcat,
                    pharmcatJarPath
                } = JSON.parse(body);

                if (!idatFolder || !outputDir) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'IDAT folder and output directory required' }));
                    return;
                }

                // Ensure output directory exists
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                const gtcDir = path.join(outputDir, 'gtc');
                const vcfDir = path.join(outputDir, 'vcf');
                fs.mkdirSync(gtcDir, { recursive: true });
                fs.mkdirSync(vcfDir, { recursive: true });

                const logs = [];
                const log = (msg) => {
                    const timestamp = new Date().toISOString();
                    logs.push(`[${timestamp}] ${msg}`);
                    console.log(`[VCF Creator] ${msg}`);
                };

                // Default paths
                const cliPath = 'C:\\Users\\ErwinSchimak\\Desktop\\idat\\need\\array-analysis-cli\\array-analysis-cli.exe';
                const defaultManifest = manifestPath || 'C:\\Users\\ErwinSchimak\\Desktop\\idat\\need\\Manifest\\NovoScreen01_20032937X376089_A2.bpm';
                const defaultCluster = clusterPath || 'C:\\Users\\ErwinSchimak\\Desktop\\idat\\need\\clusterfile\\Clusterfile_Final_V137.egt';
                const defaultCsvManifest = csvManifestPath || 'C:\\Users\\ErwinSchimak\\Desktop\\idat\\need\\Manifest\\NovoScreen01_20032937X376089_A2.bpm.csv';
                const defaultFasta = genomeFastaPath || 'C:\\Users\\ErwinSchimak\\Desktop\\idat\\need\\hg38\\hg38.fa';

                log(`=== VCF Creation Pipeline ===`);
                log(`Method: ${method || 'cli'}`);
                log(`Input folder: ${idatFolder}`);
                log(`Output directory: ${outputDir}`);
                log(`Reference: ${reference || 'GRCh38'}`);
                log(`Use Beagle: ${useBeagle ? 'Yes' : 'No'}`);
                log(`Use Docker: ${useDocker ? 'Yes' : 'No'}`);
                log(`Use PharmCAT: ${usePharmcat ? 'Yes' : 'No'}`);

                // Generate Python script for VCF creation using CLI tools
                const pythonScript = `
import os
import sys
import json
import subprocess
from pathlib import Path
import glob

# Configuration
IDAT_FOLDER = r"${idatFolder.replace(/\\/g, '\\\\')}"
OUTPUT_DIR = r"${outputDir.replace(/\\/g, '\\\\')}"
GTC_DIR = r"${gtcDir.replace(/\\/g, '\\\\')}"
VCF_DIR = r"${vcfDir.replace(/\\/g, '\\\\')}"
REFERENCE = "${reference || 'GRCh38'}"
METHOD = "${method || 'cli'}"

# Tool paths
CLI_PATH = r"${cliPath.replace(/\\/g, '\\\\')}"
BPM_MANIFEST = r"${defaultManifest.replace(/\\/g, '\\\\')}"
CLUSTER_FILE = r"${defaultCluster.replace(/\\/g, '\\\\')}"
CSV_MANIFEST = r"${defaultCsvManifest.replace(/\\/g, '\\\\')}"
GENOME_FASTA = r"${defaultFasta.replace(/\\/g, '\\\\')}"

USE_BEAGLE = ${useBeagle ? 'True' : 'False'}
USE_DOCKER = ${useDocker ? 'True' : 'False'}
BEAGLE_JAR_PATH = r"${(beagleJarPath || 'C:\\Users\\ErwinSchimak\\Desktop\\idat\\need\\beagle5.jar').replace(/\\/g, '\\\\')}"
BEAGLE_REF_PATH = r"${(beagleRefPath || '').replace(/\\/g, '\\\\')}"
GP_FILTER = ${gpFilter || 0.9}
CHROMOSOMES = ${JSON.stringify(chromosomes || [])}
USE_PHARMCAT = ${usePharmcat ? 'True' : 'False'}
PHARMCAT_JAR_PATH = r"${(pharmcatJarPath || 'C:\\Users\\ErwinSchimak\\Desktop\\idat\\need\\pharmcat-3.0.0-all.jar').replace(/\\/g, '\\\\')}"

def log(msg):
    print(f"[LOG] {msg}", flush=True)

def run_command(cmd, description="", timeout=3600):
    log(f"Running: {description or cmd[:100]}")
    try:
        if isinstance(cmd, list):
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        else:
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        if result.returncode != 0:
            log(f"Warning: {result.stderr[:500] if result.stderr else 'No error message'}")
        return result.returncode == 0, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        log(f"Timeout after {timeout}s")
        return False, "", "Timeout"
    except Exception as e:
        log(f"Error: {e}")
        return False, "", str(e)

def main():
    log("=== IDAT to VCF Pipeline ===")
    log(f"Method: {METHOD}")

    # Step 1: IDAT to GTC conversion
    log("Step 1: Converting IDAT to GTC...")
    gtc_success = idat_to_gtc()

    if not gtc_success:
        log("ERROR: IDAT to GTC conversion failed")
        sys.exit(1)

    # Step 2: GTC to VCF conversion
    log("Step 2: Converting GTC to VCF...")
    vcf_files = gtc_to_vcf()

    if not vcf_files:
        log("ERROR: GTC to VCF conversion failed")
        sys.exit(1)

    log(f"Created {len(vcf_files)} VCF file(s)")

    # Step 3: Beagle Imputation (optional)
    if USE_BEAGLE and vcf_files:
        log("Step 3: Running Beagle Imputation...")
        if USE_DOCKER:
            run_beagle_docker(vcf_files)
        else:
            run_beagle_local(vcf_files)

    # Step 4: PharmCAT analysis (optional)
    if USE_PHARMCAT and vcf_files:
        log("Step 4: Running PharmCAT Analysis...")
        run_pharmcat(vcf_files)

    log("=== Pipeline Complete ===")
    # Output JSON result
    print(json.dumps({"success": True, "vcf_files": vcf_files}))

def idat_to_gtc():
    """Convert IDAT files to GTC using array-analysis-cli"""
    log("Using array-analysis-cli for IDAT -> GTC conversion")

    cmd = [
        CLI_PATH, "genotype", "call",
        "--bpm-manifest", BPM_MANIFEST,
        "--cluster-file", CLUSTER_FILE,
        "--idat-folder", IDAT_FOLDER,
        "--output-folder", GTC_DIR,
        "--num-threads", "4"
    ]

    log(f"Command: {' '.join(cmd)}")
    success, stdout, stderr = run_command(cmd, "IDAT to GTC conversion", timeout=7200)

    if stdout:
        log(f"Output: {stdout[:500]}")

    # Check if GTC files were created
    gtc_files = glob.glob(os.path.join(GTC_DIR, "*.gtc"))
    if gtc_files:
        log(f"Created {len(gtc_files)} GTC file(s)")
        for f in gtc_files:
            log(f"  - {os.path.basename(f)}")
        return True
    else:
        log("No GTC files were created")
        return False

def gtc_to_vcf():
    """Convert GTC files to VCF using array-analysis-cli"""
    log("Using array-analysis-cli for GTC -> VCF conversion")

    # Check if genome fasta exists
    if not os.path.exists(GENOME_FASTA):
        log(f"WARNING: Genome FASTA not found at {GENOME_FASTA}")
        log("Please provide a valid hg38.fa file for VCF conversion")
        return []

    cmd = [
        CLI_PATH, "genotype", "gtc-to-vcf",
        "--bpm-manifest", BPM_MANIFEST,
        "--csv-manifest", CSV_MANIFEST,
        "--genome-fasta-file", GENOME_FASTA,
        "--gtc-folder", GTC_DIR,
        "--output-folder", VCF_DIR
    ]

    log(f"Command: {' '.join(cmd)}")
    success, stdout, stderr = run_command(cmd, "GTC to VCF conversion", timeout=7200)

    if stdout:
        log(f"Output: {stdout[:500]}")

    # Find created VCF files
    vcf_files = glob.glob(os.path.join(VCF_DIR, "*.vcf"))
    if vcf_files:
        log(f"Created {len(vcf_files)} VCF file(s)")
        for f in vcf_files:
            log(f"  - {os.path.basename(f)}")

    return vcf_files

def run_beagle_docker(vcf_files):
    """Run Beagle imputation using Docker container"""
    log("Running Beagle imputation via Docker...")

    # Default to all autosomes + X if no chromosomes specified
    chroms_to_process = CHROMOSOMES if CHROMOSOMES else ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', 'X']
    log(f"Processing chromosomes: {', '.join(chroms_to_process)}")

    for vcf_file in vcf_files:
        vcf_name = os.path.basename(vcf_file)
        sample_base = vcf_name.replace('.vcf', '')

        for chrom in chroms_to_process:
            log(f"Running Docker Beagle imputation on {vcf_name} for chromosome {chrom}...")

            # Run imputation via Docker for this chromosome
            docker_cmd = f'''docker run --rm -v "{VCF_DIR}:/app/input" -v "{VCF_DIR}:/app/output" erwin23071975/beagle-imputation-v3:latest input_vcf={vcf_name} chrom={chrom} out=imputed'''

            success, stdout, stderr = run_command(docker_cmd, f"Docker Beagle chr{chrom}")
            if success:
                log(f"Beagle imputation completed for {vcf_name} chromosome {chrom}")
            else:
                log(f"Beagle imputation failed for {vcf_name} chromosome {chrom}")

def run_beagle_local(vcf_files):
    """Run Beagle imputation using local JAR file"""
    if not os.path.exists(BEAGLE_JAR_PATH):
        log(f"Beagle JAR not found at {BEAGLE_JAR_PATH}")
        return

    for vcf_file in vcf_files:
        vcf_name = os.path.basename(vcf_file)
        output_prefix = os.path.join(VCF_DIR, vcf_name.replace('.vcf', '.imputed'))

        beagle_cmd = f'java -Xmx4g -jar "{BEAGLE_JAR_PATH}" gt="{vcf_file}" out="{output_prefix}" gp=true'
        if BEAGLE_REF_PATH:
            beagle_cmd += f' ref="{BEAGLE_REF_PATH}"'

        log(f"Running local Beagle: {beagle_cmd}")
        success, stdout, stderr = run_command(beagle_cmd, "Local Beagle")

        if success:
            log(f"Local Beagle completed for {vcf_name}")
        else:
            log(f"Local Beagle failed: {stderr[:200] if stderr else 'Unknown error'}")

def run_pharmcat(vcf_files):
    """Run PharmCAT analysis on VCF files"""
    if not os.path.exists(PHARMCAT_JAR_PATH):
        log(f"PharmCAT JAR not found at {PHARMCAT_JAR_PATH}")
        return

    for vcf_file in vcf_files:
        vcf_name = os.path.basename(vcf_file)
        sample_id = vcf_name.replace('.vcf', '')

        pharmcat_cmd = f'java -jar "{PHARMCAT_JAR_PATH}" -vcf "{vcf_file}" -o "{VCF_DIR}"'

        log(f"Running PharmCAT on {vcf_name}...")
        success, stdout, stderr = run_command(pharmcat_cmd, "PharmCAT analysis", timeout=600)

        if success:
            log(f"PharmCAT completed for {vcf_name}")
            report_path = os.path.join(VCF_DIR, f"{sample_id}.report.html")
            if os.path.exists(report_path):
                log(f"PharmCAT report: {report_path}")
        else:
            log(f"PharmCAT failed for {vcf_name}")

if __name__ == "__main__":
    main()
`;

                // Write and execute Python script
                const tempDir = os.tmpdir();
                const scriptFile = path.join(tempDir, `vcf_creator_${Date.now()}.py`);
                fs.writeFileSync(scriptFile, pythonScript, 'utf8');

                log(`Executing VCF creation script...`);

                const pythonProcess = spawn('python', ['-u', scriptFile], {
                    timeout: 3600000,  // 1 hour timeout for VCF creation
                    cwd: tempDir,
                    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
                });

                let stdout = '';
                let stderr = '';

                pythonProcess.stdout.on('data', (data) => {
                    const output = data.toString();
                    stdout += output;
                    // Extract log messages
                    const logLines = output.split('\n').filter(l => l.includes('[LOG]'));
                    logLines.forEach(l => log(l.replace('[LOG] ', '')));
                });

                pythonProcess.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                pythonProcess.on('close', (exitCode) => {
                    // Clean up temp file
                    try {
                        fs.unlinkSync(scriptFile);
                    } catch (e) {}

                    log(`VCF creation process completed with exit code: ${exitCode}`);

                    // Try to parse JSON result from stdout
                    let result = { success: exitCode === 0 };
                    try {
                        const jsonMatch = stdout.match(/\{.*"success".*\}/s);
                        if (jsonMatch) {
                            result = JSON.parse(jsonMatch[0]);
                        }
                    } catch (e) {}

                    // Read VCF file contents for library (raw VCFs)
                    const vcfContents = [];
                    if (result.vcf_files && result.vcf_files.length > 0) {
                        for (const vcfPath of result.vcf_files) {
                            try {
                                if (fs.existsSync(vcfPath)) {
                                    const vcfContent = fs.readFileSync(vcfPath, 'utf8');
                                    const sampleId = path.basename(vcfPath).replace('.snv.vcf', '').replace('.vcf', '');
                                    vcfContents.push({
                                        sampleId: sampleId,
                                        path: vcfPath,
                                        content: vcfContent
                                    });
                                    log(`Read raw VCF file: ${vcfPath} (${vcfContent.length} bytes)`);
                                }
                            } catch (readErr) {
                                log(`Error reading VCF file ${vcfPath}: ${readErr.message}`);
                            }
                        }
                    }

                    // Read imputed VCF files for library
                    const imputedVcfContents = [];
                    try {
                        const vcfDirPath = path.join(outputDir, 'vcf');
                        if (fs.existsSync(vcfDirPath)) {
                            const files = fs.readdirSync(vcfDirPath);
                            const imputedFiles = files.filter(f => f.includes('imputed') && (f.endsWith('.vcf') || f.endsWith('.vcf.gz')));

                            for (const imputedFile of imputedFiles) {
                                const imputedPath = path.join(vcfDirPath, imputedFile);
                                try {
                                    let content;
                                    if (imputedFile.endsWith('.gz')) {
                                        // For gzipped files, read and decompress
                                        const zlib = require('zlib');
                                        const gzContent = fs.readFileSync(imputedPath);
                                        content = zlib.gunzipSync(gzContent).toString('utf8');
                                    } else {
                                        content = fs.readFileSync(imputedPath, 'utf8');
                                    }

                                    const sampleId = imputedFile.replace('.imputed', '').replace('.vcf.gz', '').replace('.vcf', '');
                                    imputedVcfContents.push({
                                        sampleId: sampleId,
                                        path: imputedPath,
                                        content: content
                                    });
                                    log(`Read imputed VCF file: ${imputedPath} (${content.length} bytes)`);
                                } catch (readErr) {
                                    log(`Error reading imputed VCF file ${imputedPath}: ${readErr.message}`);
                                }
                            }
                        }
                    } catch (dirErr) {
                        log(`Error scanning for imputed VCFs: ${dirErr.message}`);
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        ...result,
                        vcfContents,
                        imputedVcfContents,
                        logs,
                        stdout,
                        stderr,
                        exitCode
                    }));
                });

                pythonProcess.on('error', (err) => {
                    try {
                        fs.unlinkSync(scriptFile);
                    } catch (e) {}

                    log(`Error: ${err.message}`);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: err.message,
                        logs
                    }));
                });

            } catch (error) {
                console.error('VCF creation error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // Search SNPs by Gene Name - Uses Ensembl API
    if (req.url === '/api/search-snps-by-gene' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { geneName } = JSON.parse(body);
                if (!geneName) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'geneName required' }));
                    return;
                }

                console.log(`Searching SNPs for gene: ${geneName}`);

                // Step 1: Search for gene ID
                const searchOptions = {
                    hostname: 'rest.ensembl.org',
                    path: `/lookup/symbol/homo_sapiens/${geneName}?content-type=application/json`,
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                };

                https.get(searchOptions, (searchRes) => {
                    let searchData = '';
                    searchRes.on('data', chunk => searchData += chunk);
                    searchRes.on('end', () => {
                        try {
                            const geneInfo = JSON.parse(searchData);

                            if (!geneInfo || !geneInfo.id) {
                                res.writeHead(404, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({
                                    error: `Gene ${geneName} not found`,
                                    snps: []
                                }));
                                return;
                            }

                            console.log(`Found gene ID: ${geneInfo.id}`);

                            // Step 2: Get variants for this gene
                            const variantsOptions = {
                                hostname: 'rest.ensembl.org',
                                path: `/overlap/id/${geneInfo.id}?feature=variation;content-type=application/json`,
                                method: 'GET',
                                headers: { 'Content-Type': 'application/json' }
                            };

                            https.get(variantsOptions, (varRes) => {
                                let varData = '';
                                varRes.on('data', chunk => varData += chunk);
                                varRes.on('end', () => {
                                    try {
                                        const variants = JSON.parse(varData);

                                        // Filter for SNPs (rs IDs) and limit to most important ones
                                        const snps = variants
                                            .filter(v => v.id && v.id.startsWith('rs'))
                                            .map(v => ({
                                                rsid: v.id,
                                                consequence_type: v.consequence_type || 'unknown',
                                                clinical_significance: v.clinical_significance || []
                                            }))
                                            .slice(0, 50); // Limit to first 50 SNPs

                                        console.log(`Found ${snps.length} SNPs for gene ${geneName}`);

                                        res.writeHead(200, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({
                                            gene: geneName,
                                            geneId: geneInfo.id,
                                            snps: snps,
                                            total: snps.length
                                        }));

                                    } catch (e) {
                                        console.error('Parse variants error:', e);
                                        res.writeHead(500, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({ error: e.message }));
                                    }
                                });
                            }).on('error', (err) => {
                                console.error('Variants request error:', err);
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: err.message }));
                            });

                        } catch (e) {
                            console.error('Parse gene error:', e);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: e.message }));
                        }
                    });
                }).on('error', (err) => {
                    console.error('Gene search error:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                });

            } catch (error) {
                console.error('Search SNPs error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // Discover SNPs by Phenotype/Disease - Uses GWAS Catalog API
    if (req.url === '/api/discover-snps-by-phenotype' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { phenotype } = JSON.parse(body);
                if (!phenotype) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'phenotype required' }));
                    return;
                }

                console.log(`Discovering SNPs for phenotype: ${phenotype}`);

                // Known disease-SNP mappings as fallback
                const knownDiseaseSnps = {
                    'alzheimer': ['rs429358', 'rs7412', 'rs3865444', 'rs9331896', 'rs11136000'],
                    'apoe': ['rs429358', 'rs7412', 'rs405509', 'rs440446', 'rs769449'],
                    'breast cancer': ['rs1042522', 'rs80357713', 'rs1799966', 'rs1801516', 'rs2981582'],
                    'diabetes': ['rs7903146', 'rs12255372', 'rs5219', 'rs13266634', 'rs1801282'],
                    'parkinson': ['rs34637584', 'rs356220', 'rs11868035', 'rs823128', 'rs34311866'],
                    'depression': ['rs6265', 'rs4680', 'rs25531', 'rs1360780', 'rs110402'],
                    'cardiovascular': ['rs1333049', 'rs10757274', 'rs2383206', 'rs10757278', 'rs9349379']
                };

                // Helper function to find SNPs via direct association search
                const tryDirectAssociationSearch = () => {
                    console.log('Method 2: Trying direct association search...');
                    const altUrl = `https://www.ebi.ac.uk/gwas/rest/api/associations/search/findByDiseaseTrait?diseaseTrait=${encodeURIComponent(phenotype)}&size=50`;

                    https.get(altUrl, (altRes) => {
                        if (altRes.statusCode !== 200) {
                            console.log(`Association search returned ${altRes.statusCode}, using known SNPs...`);
                            useKnownSnps();
                            return;
                        }

                        let altData = '';
                        altRes.on('data', chunk => altData += chunk);
                        altRes.on('end', () => {
                            try {
                                const assocResult = JSON.parse(altData);
                                const associations = assocResult._embedded?.associations || [];

                                if (associations.length === 0) {
                                    console.log('No associations found, using known SNPs...');
                                    useKnownSnps();
                                    return;
                                }

                                // Extract unique SNPs
                                const snpMap = new Map();
                                associations.forEach(assoc => {
                                    if (assoc.snps && Array.isArray(assoc.snps)) {
                                        assoc.snps.forEach(snp => {
                                            if (snp.rsId && snp.rsId.startsWith('rs')) {
                                                snpMap.set(snp.rsId, {
                                                    rsid: snp.rsId,
                                                    gene: assoc.loci?.[0]?.authorReportedGene || 'unknown',
                                                    trait: assoc.diseaseTrait?.trait || phenotype,
                                                    pvalue: assoc.pvalue || 'N/A',
                                                    riskAllele: assoc.strongestAllele || 'N/A'
                                                });
                                            }
                                        });
                                    }
                                });

                                const snps = Array.from(snpMap.values()).slice(0, 30);

                                console.log(`✓ Found ${snps.length} SNPs via direct association search`);

                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({
                                    phenotype: phenotype,
                                    snps: snps,
                                    total: snps.length,
                                    source: 'gwas_catalog_associations'
                                }));

                            } catch (e) {
                                console.error('Parse association error:', e);
                                useKnownSnps();
                            }
                        });
                    }).on('error', (err) => {
                        console.error('Association search error:', err);
                        useKnownSnps();
                    });
                };

                // Helper function to use known SNPs as last resort
                const useKnownSnps = () => {
                    console.log('Method 3: Using curated SNP database...');

                    // Find matching disease
                    const lowerPhenotype = phenotype.toLowerCase();
                    let matchedSnps = [];

                    for (const [disease, snps] of Object.entries(knownDiseaseSnps)) {
                        if (lowerPhenotype.includes(disease) || disease.includes(lowerPhenotype)) {
                            matchedSnps = snps.map(rsid => ({
                                rsid: rsid,
                                gene: 'various',
                                trait: disease,
                                pvalue: 'N/A',
                                riskAllele: 'N/A'
                            }));
                            break;
                        }
                    }

                    if (matchedSnps.length > 0) {
                        console.log(`✓ Found ${matchedSnps.length} SNPs from curated database`);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            phenotype: phenotype,
                            snps: matchedSnps,
                            total: matchedSnps.length,
                            source: 'curated_database',
                            message: 'Using well-established SNPs from scientific literature'
                        }));
                    } else {
                        console.log('✗ No SNPs found in any source');
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            error: `No SNPs found for "${phenotype}". Try more specific terms like "alzheimer disease", "breast cancer", "type 2 diabetes", "parkinson disease", "depression", or "cardiovascular disease".`,
                            snps: [],
                            suggestions: Object.keys(knownDiseaseSnps)
                        }));
                    }
                };

                // Method 1: Try GWAS Catalog studies endpoint (most reliable)
                console.log('Method 1: Trying GWAS studies endpoint...');
                const studiesUrl = `https://www.ebi.ac.uk/gwas/rest/api/studies/search/findByDiseaseTrait?diseaseTrait=${encodeURIComponent(phenotype)}`;

                https.get(studiesUrl, (searchRes) => {
                    // Check for non-200 status codes
                    if (searchRes.statusCode !== 200) {
                        console.log(`Studies endpoint returned ${searchRes.statusCode}, trying alternative...`);
                        tryDirectAssociationSearch();
                        return;
                    }

                    let searchData = '';
                    searchRes.on('data', chunk => searchData += chunk);
                    searchRes.on('end', () => {
                        try {
                            const studiesResult = JSON.parse(searchData);
                            const studies = studiesResult._embedded?.studies || [];

                            if (studies.length === 0) {
                                console.log('No studies found, trying alternative...');
                                tryDirectAssociationSearch();
                                return;
                            }

                            // Extract SNPs from studies
                            const snpSet = new Set();
                            studies.forEach(study => {
                                if (study.snps) {
                                    study.snps.forEach(snp => {
                                        if (snp.rsId && snp.rsId.startsWith('rs')) {
                                            snpSet.add(snp.rsId);
                                        }
                                    });
                                }
                            });

                            const snps = Array.from(snpSet).slice(0, 30).map(rsid => ({
                                rsid: rsid,
                                gene: 'various',
                                trait: phenotype,
                                pvalue: 'N/A',
                                riskAllele: 'N/A'
                            }));

                            if (snps.length > 0) {
                                console.log(`✓ Found ${snps.length} SNPs from studies endpoint`);
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({
                                    phenotype: phenotype,
                                    snps: snps,
                                    total: snps.length,
                                    source: 'gwas_catalog_studies'
                                }));
                            } else {
                                console.log('No SNPs in studies, trying alternative...');
                                tryDirectAssociationSearch();
                            }

                        } catch (e) {
                            console.error('Parse studies error:', e);
                            tryDirectAssociationSearch();
                        }
                    });
                }).on('error', (err) => {
                    console.error('Studies search error:', err);
                    tryDirectAssociationSearch();
                });

            } catch (error) {
                console.error('Discover SNPs error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // ArXiv Search and Download - Preprint server with full PDFs
    if (req.url === '/api/arxiv' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { rsid, query, topic, maxResults = 20 } = JSON.parse(body);
                const searchTerm = query || (topic ? `${rsid} ${topic}` : rsid) || '';

                console.log(`ArXiv search for: ${searchTerm}`);

                // ArXiv API query
                const encodedQuery = encodeURIComponent(searchTerm);
                const url = `https://export.arxiv.org/api/query?search_query=all:${encodedQuery}&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;

                https.get(url, (apiRes) => {
                    let data = '';
                    apiRes.on('data', chunk => data += chunk);
                    apiRes.on('end', () => {
                        try {
                            // Parse ArXiv XML response
                            const papers = [];
                            const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
                            let match;

                            while ((match = entryRegex.exec(data)) !== null) {
                                const entry = match[1];

                                // Extract fields
                                const idMatch = entry.match(/<id>(.*?)<\/id>/);
                                const titleMatch = entry.match(/<title>(.*?)<\/title>/);
                                const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
                                const publishedMatch = entry.match(/<published>(.*?)<\/published>/);
                                const authorsMatch = entry.matchAll(/<name>(.*?)<\/name>/g);

                                const arxivId = idMatch ? idMatch[1].split('/abs/')[1] : null;
                                const pdfUrl = arxivId ? `https://arxiv.org/pdf/${arxivId}.pdf` : null;

                                const authors = [];
                                for (const authorMatch of authorsMatch) {
                                    authors.push(authorMatch[1]);
                                }

                                if (arxivId) {
                                    papers.push({
                                        arxivId: arxivId,
                                        title: titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : 'Unknown',
                                        abstract: summaryMatch ? summaryMatch[1].trim().replace(/\s+/g, ' ') : '',
                                        authors: authors.join(', '),
                                        published: publishedMatch ? publishedMatch[1].split('T')[0] : 'Unknown',
                                        year: publishedMatch ? publishedMatch[1].split('-')[0] : 'Unknown',
                                        pdfUrl: pdfUrl,
                                        arxivUrl: `https://arxiv.org/abs/${arxivId}`,
                                        source: 'ArXiv',
                                        hasFullText: true // ArXiv always provides full PDFs
                                    });
                                }
                            }

                            console.log(`ArXiv: Found ${papers.length} papers`);

                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({
                                papers: papers,
                                total: papers.length,
                                source: 'arxiv'
                            }));

                        } catch (e) {
                            console.error('ArXiv parse error:', e);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: e.message, papers: [] }));
                        }
                    });
                }).on('error', (err) => {
                    console.error('ArXiv request error:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message, papers: [] }));
                });

            } catch (error) {
                console.error('ArXiv error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message, papers: [] }));
            }
        });
        return;
    }

    // HuggingFace Daily Papers - Recent ML/AI papers
    if (req.url === '/api/huggingface-papers' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { rsid, query, topic, maxResults = 20 } = JSON.parse(body);
                const searchTerm = query || (topic ? `${rsid} ${topic}` : rsid) || '';

                console.log(`HuggingFace Papers search for: ${searchTerm}`);

                // HuggingFace Papers API
                const url = `https://huggingface.co/api/daily_papers`;

                https.get(url, (apiRes) => {
                    let data = '';
                    apiRes.on('data', chunk => data += chunk);
                    apiRes.on('end', () => {
                        try {
                            const dailyPapers = JSON.parse(data);
                            const papers = [];

                            // Filter papers by search term
                            const lowerSearchTerm = searchTerm.toLowerCase();

                            for (const item of dailyPapers) {
                                const title = (item.title || '').toLowerCase();
                                const summary = (item.summary || '').toLowerCase();

                                // Check if search term matches
                                if (title.includes(lowerSearchTerm) || summary.includes(lowerSearchTerm)) {
                                    // Get ArXiv ID if available
                                    let arxivId = null;
                                    let pdfUrl = null;

                                    if (item.paper && item.paper.id) {
                                        arxivId = item.paper.id;
                                        pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
                                    }

                                    // Extract author names from author objects
                                    const authorList = (item.paper && item.paper.authors) || [];
                                    const authorNames = authorList.map(a => a.name || '').filter(Boolean);

                                    papers.push({
                                        title: item.title || 'Unknown',
                                        abstract: item.summary || '',
                                        authors: authorNames.join(', '),
                                        published: item.publishedAt || 'Unknown',
                                        year: item.publishedAt ? item.publishedAt.split('-')[0] : 'Unknown',
                                        arxivId: arxivId,
                                        pdfUrl: pdfUrl,
                                        upvotes: (item.paper && item.paper.upvotes) || 0,
                                        source: 'HuggingFace',
                                        hasFullText: !!pdfUrl
                                    });
                                }

                                if (papers.length >= maxResults) break;
                            }

                            console.log(`HuggingFace: Found ${papers.length} papers`);

                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({
                                papers: papers,
                                total: papers.length,
                                source: 'huggingface'
                            }));

                        } catch (e) {
                            console.error('HuggingFace parse error:', e);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: e.message, papers: [] }));
                        }
                    });
                }).on('error', (err) => {
                    console.error('HuggingFace request error:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message, papers: [] }));
                });

            } catch (error) {
                console.error('HuggingFace error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message, papers: [] }));
            }
        });
        return;
    }

    // Multi-Source Paper Scraper (Crawly) - Scrapes from multiple sources
    if (req.url === '/api/crawly-scraper' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { rsid, query, topic, sources } = JSON.parse(body);
                const searchTerm = query || (topic ? `${rsid} ${topic}` : rsid) || '';
                const activeSources = sources || ['biorxiv', 'medrxiv'];

                console.log(`Crawly multi-source scraper for: ${searchTerm}`);
                console.log(`Sources:`, activeSources);

                // Use Python with scrapy or beautifulsoup for robust scraping
                const pythonScript = `
import json
import sys
import re

# Try imports
try:
    import requests
    from bs4 import BeautifulSoup
    import urllib.parse
except ImportError:
    print(json.dumps({"error": "Required libraries not installed. Install with: pip install requests beautifulsoup4"}))
    sys.exit(0)

search_term = "${searchTerm.replace(/"/g, '\\"')}"
sources = ${JSON.stringify(activeSources)}

papers = []

# BioRxiv Scraper
if 'biorxiv' in sources:
    try:
        url = f"https://www.biorxiv.org/search/{urllib.parse.quote(search_term)}"
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        response = requests.get(url, headers=headers, timeout=10)

        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')

            # Find paper entries
            for item in soup.find_all('div', class_='highwire-cite-metadata'):
                try:
                    title_elem = item.find('span', class_='highwire-cite-title')
                    title = title_elem.text.strip() if title_elem else 'Unknown'

                    # Get PDF link
                    pdf_link = None
                    link_elem = item.find('a', class_='highwire-cite-linked-title')
                    if link_elem and link_elem.get('href'):
                        article_url = 'https://www.biorxiv.org' + link_elem['href']
                        pdf_link = article_url.replace('/content/', '/content/').replace('.short', '.full.pdf')

                    papers.append({
                        'title': title,
                        'source': 'BioRxiv',
                        'pdfUrl': pdf_link,
                        'hasFullText': bool(pdf_link)
                    })

                    if len(papers) >= 10:
                        break
                except Exception as e:
                    continue
    except Exception as e:
        print(f"BioRxiv error: {e}", file=sys.stderr)

# MedRxiv Scraper
if 'medrxiv' in sources:
    try:
        url = f"https://www.medrxiv.org/search/{urllib.parse.quote(search_term)}"
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        response = requests.get(url, headers=headers, timeout=10)

        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')

            for item in soup.find_all('div', class_='highwire-cite-metadata'):
                try:
                    title_elem = item.find('span', class_='highwire-cite-title')
                    title = title_elem.text.strip() if title_elem else 'Unknown'

                    pdf_link = None
                    link_elem = item.find('a', class_='highwire-cite-linked-title')
                    if link_elem and link_elem.get('href'):
                        article_url = 'https://www.medrxiv.org' + link_elem['href']
                        pdf_link = article_url.replace('/content/', '/content/').replace('.short', '.full.pdf')

                    papers.append({
                        'title': title,
                        'source': 'MedRxiv',
                        'pdfUrl': pdf_link,
                        'hasFullText': bool(pdf_link)
                    })

                    if len(papers) >= 20:
                        break
                except Exception as e:
                    continue
    except Exception as e:
        print(f"MedRxiv error: {e}", file=sys.stderr)

print(json.dumps({"papers": papers, "total": len(papers)}))
`;

                // Execute Python script
                const tempDir = os.tmpdir();
                const scriptFile = path.join(tempDir, `crawly_scraper_${Date.now()}.py`);
                fs.writeFileSync(scriptFile, pythonScript, 'utf8');

                const pythonProcess = spawn('python', ['-u', scriptFile], {
                    timeout: 60000,
                    cwd: tempDir,
                    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
                });

                let stdout = '';
                let stderr = '';

                pythonProcess.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                pythonProcess.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                pythonProcess.on('close', (exitCode) => {
                    try {
                        fs.unlinkSync(scriptFile);
                    } catch (e) {}

                    try {
                        const result = JSON.parse(stdout);
                        console.log(`Crawly: Found ${result.papers?.length || 0} papers from ${activeSources.join(', ')}`);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(result));
                    } catch (e) {
                        console.error(`Crawly parse error: ${e.message}`);
                        if (stderr) console.error(`Crawly stderr: ${stderr}`);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            error: 'Failed to parse scraper results',
                            papers: []
                        }));
                    }
                });

                pythonProcess.on('error', (err) => {
                    try {
                        fs.unlinkSync(scriptFile);
                    } catch (e) {}

                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message, papers: [] }));
                });

            } catch (error) {
                console.error('Crawly scraper error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message, papers: [] }));
            }
        });
        return;
    }

    // Paper Collection Management - Save/List/Delete paper collections
    if (req.url === '/api/paper-collections' && req.method === 'GET') {
        try {
            const papersDir = path.join(__dirname, 'paper_collections');

            // Create directory if it doesn't exist
            if (!fs.existsSync(papersDir)) {
                fs.mkdirSync(papersDir, { recursive: true });
            }

            // List all collections (folders)
            const collections = [];
            const folders = fs.readdirSync(papersDir);

            for (const folder of folders) {
                const folderPath = path.join(papersDir, folder);
                const stats = fs.statSync(folderPath);

                if (stats.isDirectory()) {
                    // Count PDFs in folder
                    const files = fs.readdirSync(folderPath);
                    const pdfCount = files.filter(f => f.endsWith('.pdf')).length;

                    // Read metadata if exists
                    let metadata = {};
                    const metaFile = path.join(folderPath, 'metadata.json');
                    if (fs.existsSync(metaFile)) {
                        try {
                            metadata = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
                        } catch (e) {}
                    }

                    collections.push({
                        id: folder,
                        name: folder,
                        path: folderPath,
                        pdfCount: pdfCount,
                        created: stats.birthtime,
                        modified: stats.mtime,
                        gene: metadata.gene || 'Unknown',
                        rsid: metadata.rsid || 'Unknown',
                        topic: metadata.topic || ''
                    });
                }
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ collections: collections }));

        } catch (error) {
            console.error('Paper collections error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // Save paper to collection
    if (req.url === '/api/save-paper-to-collection' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const { gene, rsid, pdfPath, title, metadata } = JSON.parse(body);

                // Create collection folder name: GENE_rsID
                const collectionName = `${gene || 'Unknown'}_${rsid || 'Unknown'}`;
                const papersDir = path.join(__dirname, 'paper_collections');
                const collectionPath = path.join(papersDir, collectionName);

                // Create collection directory
                if (!fs.existsSync(collectionPath)) {
                    fs.mkdirSync(collectionPath, { recursive: true });
                }

                // Copy PDF/TXT to collection
                if (pdfPath && fs.existsSync(pdfPath)) {
                    // Detect file extension from source file
                    const fileExt = path.extname(pdfPath) || '.pdf';
                    const filename = title ? `${title.substring(0, 50).replace(/[\/\\:*?"<>|]/g, '_')}${fileExt}` : path.basename(pdfPath);
                    const destPath = path.join(collectionPath, filename);
                    fs.copyFileSync(pdfPath, destPath);
                    console.log(`✓ Saved paper to collection: ${filename}`);

                    // Save/update metadata
                    const metaFile = path.join(collectionPath, 'metadata.json');
                    let existingMeta = {};
                    if (fs.existsSync(metaFile)) {
                        try {
                            existingMeta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
                        } catch (e) {}
                    }

                    const updatedMeta = {
                        ...existingMeta,
                        gene: gene,
                        rsid: rsid,
                        topic: metadata?.topic || existingMeta.topic || '',
                        lastUpdated: new Date().toISOString(),
                        papers: [...(existingMeta.papers || []), {
                            filename: filename,
                            title: title,
                            added: new Date().toISOString(),
                            ...metadata
                        }]
                    };

                    fs.writeFileSync(metaFile, JSON.stringify(updatedMeta, null, 2), 'utf8');

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        collection: collectionName,
                        path: destPath
                    }));
                } else {
                    console.error(`File not found: ${pdfPath}`);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Paper file not found or path is invalid' }));
                }

            } catch (error) {
                console.error('Save paper error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // Open folder in file explorer
    if (req.url === '/api/open-folder' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const { collectionId } = JSON.parse(body);
                const papersDir = path.join(__dirname, 'paper_collections');
                const collectionPath = path.join(papersDir, collectionId);

                if (fs.existsSync(collectionPath)) {
                    // Open folder in Windows Explorer
                    const { exec } = require('child_process');
                    exec(`explorer "${collectionPath}"`, (error) => {
                        if (error) {
                            console.error('Failed to open folder:', error);
                        }
                    });

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Collection not found' }));
                }

            } catch (error) {
                console.error('Open folder error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // Delete paper collection
    if (req.url === '/api/delete-paper-collection' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const { collectionId } = JSON.parse(body);
                const papersDir = path.join(__dirname, 'paper_collections');
                const collectionPath = path.join(papersDir, collectionId);

                if (fs.existsSync(collectionPath)) {
                    // Delete all files in collection
                    const files = fs.readdirSync(collectionPath);
                    for (const file of files) {
                        fs.unlinkSync(path.join(collectionPath, file));
                    }
                    // Delete folder
                    fs.rmdirSync(collectionPath);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Collection not found' }));
                }

            } catch (error) {
                console.error('Delete collection error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // Download ArXiv PDF directly
    if (req.url === '/api/download-arxiv-pdf' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { arxivId, pdfUrl } = JSON.parse(body);
                if (!arxivId && !pdfUrl) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'ArXiv ID or PDF URL required' }));
                    return;
                }

                const downloadUrl = pdfUrl || `https://arxiv.org/pdf/${arxivId}.pdf`;
                console.log(`Downloading ArXiv PDF: ${downloadUrl}`);

                try {
                    // Use redirect-following helper (ArXiv often returns 301/302)
                    const pdfRes = await httpsGetFollowRedirects(downloadUrl, { timeout: 30000 });

                    if (pdfRes.statusCode === 200) {
                        const pdfBuffer = await collectResponseBuffer(pdfRes);

                        // Validate PDF
                        if (!isValidPdf(pdfBuffer)) {
                            console.log(`ArXiv download returned non-PDF content (${pdfBuffer.length} bytes)`);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: false, error: 'Downloaded content is not a valid PDF' }));
                            return;
                        }

                        // Save to temp directory
                        const tempDir = path.join(__dirname, 'temp_papers');
                        if (!fs.existsSync(tempDir)) {
                            fs.mkdirSync(tempDir, { recursive: true });
                        }

                        const filename = `${arxivId || 'arxiv'}_${Date.now()}.pdf`.replace(/[\/\\:*?"<>|]/g, '_');
                        const filepath = path.join(tempDir, filename);
                        fs.writeFileSync(filepath, pdfBuffer);

                        console.log(`ArXiv PDF saved: ${filepath} (${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: true,
                            file_path: filepath,
                            file_size: pdfBuffer.length,
                            arxivId: arxivId,
                            message: 'ArXiv PDF downloaded successfully'
                        }));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: `Download failed with status ${pdfRes.statusCode}`
                        }));
                    }
                } catch (fetchErr) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: fetchErr.message }));
                }

            } catch (error) {
                console.error('ArXiv download error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // Google Scholar Search - Find papers via Google Scholar
    if (req.url === '/api/google-scholar' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { rsid, topic, maxResults = 20 } = JSON.parse(body);
                if (!rsid) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'rsid required' }));
                    return;
                }

                console.log(`Google Scholar search for: ${rsid} ${topic || ''}`);

                // Build search query
                const searchTerm = topic ? `${rsid} ${topic}` : rsid;

                // Use SerpAPI-like approach or direct scraping
                // For now, we'll use a Python script with scholarly library
                const pythonScript = `
import json
import sys

# Try to import scholarly
try:
    from scholarly import scholarly
    scholarly_available = True
except ImportError as e:
    scholarly_available = False
    error_msg = str(e)
    if "formatargspec" in error_msg:
        print(json.dumps({"error": "scholarly library incompatible with Python 3.13. Use Python 3.11 or 3.12, or try: pip install --upgrade wrapt scholarly", "papers": []}))
    else:
        print(json.dumps({"error": f"scholarly library not installed: {error_msg}", "papers": []}))
    sys.exit(0)

search_query = "${searchTerm.replace(/"/g, '\\"')}"
max_results = ${maxResults}

results = []
try:
    search = scholarly.search_pubs(search_query)
    for i, pub in enumerate(search):
        if i >= max_results:
            break

        # Extract paper info
        paper = {
            'title': pub.get('bib', {}).get('title', 'Unknown'),
            'authors': ', '.join(pub.get('bib', {}).get('author', [])),
            'year': pub.get('bib', {}).get('pub_year', 'Unknown'),
            'journal': pub.get('bib', {}).get('venue', 'Unknown'),
            'abstract': pub.get('bib', {}).get('abstract', ''),
            'citations': pub.get('num_citations', 0),
            'url': pub.get('pub_url', ''),
            'eprint_url': pub.get('eprint_url', ''),
            'source': 'Google Scholar'
        }
        results.append(paper)

    print(json.dumps({"papers": results, "total": len(results)}))
except Exception as e:
    print(json.dumps({"error": str(e), "papers": []}))
`;

                // Execute Python script
                const tempDir = os.tmpdir();
                const scriptFile = path.join(tempDir, `scholar_search_${Date.now()}.py`);
                fs.writeFileSync(scriptFile, pythonScript, 'utf8');

                const pythonProcess = spawn('python', ['-u', scriptFile], {
                    timeout: 60000,
                    cwd: tempDir,
                    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
                });

                let stdout = '';
                let stderr = '';

                pythonProcess.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                pythonProcess.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                pythonProcess.on('close', (exitCode) => {
                    try {
                        fs.unlinkSync(scriptFile);
                    } catch (e) {}

                    try {
                        const result = JSON.parse(stdout);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(result));
                    } catch (e) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            error: 'Failed to parse Google Scholar results',
                            papers: []
                        }));
                    }
                });

                pythonProcess.on('error', (err) => {
                    try {
                        fs.unlinkSync(scriptFile);
                    } catch (e) {}

                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message, papers: [] }));
                });

            } catch (error) {
                console.error('Google Scholar error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message, papers: [] }));
            }
        });
        return;
    }

    // Unpaywall API - Find open access versions
    if (req.url === '/api/unpaywall' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { doi } = JSON.parse(body);
                if (!doi) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'DOI required' }));
                    return;
                }

                console.log(`Querying Unpaywall for DOI: ${doi}`);

                // Unpaywall API requires email
                const email = 'research@novogenia.com';
                const url = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${email}`;

                https.get(url, (apiRes) => {
                    let data = '';
                    apiRes.on('data', chunk => data += chunk);
                    apiRes.on('end', () => {
                        if (apiRes.statusCode === 200) {
                            try {
                                const result = JSON.parse(data);
                                const oaLocation = result.best_oa_location;

                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({
                                    success: true,
                                    is_oa: result.is_oa || false,
                                    oa_status: result.oa_status || 'closed',
                                    pdf_url: oaLocation?.url_for_pdf || null,
                                    landing_page: oaLocation?.url_for_landing_page || null,
                                    version: oaLocation?.version || null,
                                    license: oaLocation?.license || null
                                }));
                            } catch (e) {
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ success: false, error: 'Parse error' }));
                            }
                        } else {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({
                                success: false,
                                error: `Unpaywall returned ${apiRes.statusCode}`
                            }));
                        }
                    });
                }).on('error', (err) => {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: err.message }));
                });

            } catch (error) {
                console.error('Unpaywall error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // Download paper via Browser (Puppeteer) - Opens paper page and saves as PDF
    if (req.url === '/api/download-paper-browser' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { url, doi, pmid } = JSON.parse(body);
                if (!url && !doi && !pmid) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'URL, DOI, or PMID required' }));
                    return;
                }

                console.log(`Browser-based download for: ${url || doi || pmid}`);

                // Try to load puppeteer
                let puppeteer;
                try {
                    puppeteer = require('puppeteer');
                } catch (e) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: 'Puppeteer not installed. Install with: npm install puppeteer'
                    }));
                    return;
                }

                // Determine URL to visit
                let pageUrl = url;
                if (!pageUrl && doi) {
                    pageUrl = `https://doi.org/${doi}`;
                } else if (!pageUrl && pmid) {
                    pageUrl = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
                }

                const tempDir = path.join(__dirname, 'temp_papers');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                // STEP 1: If URL looks like a direct PDF link, try downloading it directly first
                if (pageUrl && pageUrl.match(/\.pdf($|\?)/i)) {
                    try {
                        console.log(`Trying direct PDF download: ${pageUrl}`);
                        const directRes = await httpsGetFollowRedirects(pageUrl, {
                            timeout: 30000,
                            rejectUnauthorized: false,
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                        });

                        if (directRes.statusCode === 200) {
                            const pdfBuffer = await collectResponseBuffer(directRes);
                            if (isValidPdf(pdfBuffer)) {
                                const filename = `${doi || pmid || 'paper'}_${Date.now()}.pdf`.replace(/[\/\\:*?"<>|]/g, '_');
                                const filepath = path.join(tempDir, filename);
                                fs.writeFileSync(filepath, pdfBuffer);

                                console.log(`Direct PDF download success: ${filepath} (${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({
                                    success: true,
                                    file_path: filepath,
                                    file_size: pdfBuffer.length,
                                    url: pageUrl,
                                    message: 'PDF downloaded directly'
                                }));
                                return;
                            } else {
                                console.log(`Direct download returned non-PDF (${pdfBuffer.length} bytes), falling back to browser render`);
                            }
                        }
                    } catch (directErr) {
                        console.log(`Direct download failed: ${directErr.message}, falling back to browser render`);
                    }
                }

                // STEP 2: Use Puppeteer to render page as PDF
                const browser = await puppeteer.launch({
                    headless: 'new',
                    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
                });

                try {
                    const page = await browser.newPage();
                    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

                    console.log(`Navigating to: ${pageUrl}`);
                    await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Check if the page loaded actual paper content (not just a paywall/login page)
                    const pageText = await page.evaluate(() => document.body?.innerText?.length || 0);
                    if (pageText < 500) {
                        console.log(`Page has very little text (${pageText} chars), likely a paywall or redirect page`);
                    }

                    const filename = `${doi || pmid || 'paper'}_${Date.now()}.pdf`.replace(/[\/\\:*?"<>|]/g, '_');
                    const filepath = path.join(tempDir, filename);

                    await page.pdf({
                        path: filepath,
                        format: 'A4',
                        printBackground: true,
                        margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' }
                    });

                    await browser.close();

                    const stats = fs.statSync(filepath);

                    // Validate generated PDF has meaningful content (not just a tiny paywall page)
                    if (stats.size < 5000) {
                        console.log(`Generated PDF too small (${stats.size} bytes), likely not a real paper`);
                        try { fs.unlinkSync(filepath); } catch(e) {}
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Generated PDF too small - page likely behind paywall'
                        }));
                        return;
                    }

                    console.log(`PDF saved: ${filepath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        file_path: filepath,
                        file_size: stats.size,
                        url: pageUrl,
                        message: 'PDF downloaded via browser'
                    }));
                } catch (browserErr) {
                    try { await browser.close(); } catch(e) {}
                    throw browserErr;
                }

            } catch (error) {
                console.error('Browser download error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // Advanced Paper Downloader - Uses multiple Python libraries as fallbacks
    if (req.url === '/api/download-paper-advanced' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { pmid, doi, title } = JSON.parse(body);
                if (!pmid && !doi) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'PMID or DOI required' }));
                    return;
                }

                console.log(`Advanced paper download: ${pmid || doi}`);

                // Compute the correct output directory (project temp_papers, not OS temp)
                const projectTempPapers = path.join(__dirname, 'temp_papers').replace(/\\/g, '\\\\');

                // Python script that tries multiple download methods
                const pythonScript = `
import sys
import os
import json
import warnings
warnings.filterwarnings('ignore')

# Try to import available libraries
available_methods = []

# Method 1: scihub.py (zaytoun/scihub)
try:
    from scihub import SciHub
    available_methods.append('scihub_zaytoun')
except ImportError:
    pass

# Method 2: scidownl (gadilashashank/Sci-Hub)
try:
    import scidownl
    available_methods.append('scidownl')
except ImportError:
    pass

# Method 3: requests + BeautifulSoup (manual scraping)
try:
    import requests
    from bs4 import BeautifulSoup
    available_methods.append('manual_scrape')
except ImportError:
    pass

# Method 4: LibGen API
try:
    import requests
    available_methods.append('libgen')
except ImportError:
    pass

pmid = "${pmid || ''}"
doi = "${doi || ''}"
identifier = doi if doi else pmid

# Use the project temp_papers directory (passed from Node.js), not __file__ relative path
output_dir = r"${projectTempPapers}"
os.makedirs(output_dir, exist_ok=True)

downloaded = False
file_path = None
method_used = None

def is_valid_pdf(filepath):
    """Check if file starts with %PDF- magic bytes"""
    try:
        with open(filepath, 'rb') as f:
            header = f.read(5)
            return header == b'%PDF-'
    except:
        return False

def check_dns_blocked(host):
    """Check if a host is DNS-blocked (resolves to Cisco Umbrella block IP)"""
    import socket
    try:
        ip = socket.gethostbyname(host)
        # 146.112.61.106 = Cisco Umbrella/OpenDNS block IP
        if ip == '146.112.61.106':
            return True
    except:
        pass
    return False

# Quick DNS check for Sci-Hub availability
scihub_blocked = False
try:
    scihub_blocked = check_dns_blocked('sci-hub.se')
    if scihub_blocked:
        print("⚠ Sci-Hub/LibGen domains are DNS-blocked on this network (Cisco Umbrella)", file=sys.stderr)
except:
    pass

# Try Method 1: scihub.py (zaytoun) - uses fetch() API
if 'scihub_zaytoun' in available_methods and not downloaded and not scihub_blocked:
    try:
        print("Trying scihub.py (zaytoun)...", file=sys.stderr)
        sh = SciHub()
        result = sh.fetch(identifier)
        if result and 'pdf' in result:
            filename = f"{identifier.replace('/', '_')}.pdf"
            file_path = os.path.join(output_dir, filename)
            with open(file_path, 'wb') as f:
                f.write(result['pdf'])
            if is_valid_pdf(file_path):
                downloaded = True
                method_used = 'scihub_zaytoun'
                print(f"✓ Downloaded via scihub.py: {file_path}", file=sys.stderr)
            else:
                print("scihub.py returned non-PDF content, removing", file=sys.stderr)
                os.remove(file_path)
                file_path = None
    except Exception as e:
        print(f"scihub.py failed: {e}", file=sys.stderr)

# Try Method 2: scidownl (gadilashashank)
if 'scidownl' in available_methods and not downloaded and not scihub_blocked:
    try:
        print("Trying scidownl...", file=sys.stderr)
        paper = scidownl.scihub_download(identifier, paper_type="doi" if doi else "pmid", out=output_dir)
        if paper and os.path.exists(paper) and is_valid_pdf(paper):
            file_path = paper
            downloaded = True
            method_used = 'scidownl'
            print(f"✓ Downloaded via scidownl: {file_path}", file=sys.stderr)
        elif paper and os.path.exists(paper):
            print("scidownl returned non-PDF content, removing", file=sys.stderr)
            os.remove(paper)
    except Exception as e:
        print(f"scidownl failed: {e}", file=sys.stderr)

# Try Method 3: Manual Sci-Hub scraping
if 'manual_scrape' in available_methods and not downloaded and not scihub_blocked:
    try:
        print("Trying manual Sci-Hub scraping...", file=sys.stderr)
        mirrors = [
            'https://sci-hub.se',
            'https://sci-hub.st',
            'https://sci-hub.ru'
        ]

        session = requests.Session()
        session.verify = False
        session.headers.update({'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})

        for mirror in mirrors:
            try:
                url = f"{mirror}/{identifier}"
                response = session.get(url, timeout=10)

                if response.status_code == 200 and 'opendns.com' not in response.text and 'Cisco Umbrella' not in response.text:
                    soup = BeautifulSoup(response.text, 'html.parser')

                    # Find PDF link
                    pdf_link = None
                    for tag in soup.find_all(['iframe', 'embed']):
                        src = tag.get('src', '')
                        if '.pdf' in src:
                            pdf_link = src
                            break

                    if pdf_link:
                        if not pdf_link.startswith('http'):
                            pdf_link = mirror + pdf_link

                        pdf_response = session.get(pdf_link, timeout=30)
                        if pdf_response.status_code == 200 and pdf_response.content[:5] == b'%PDF-':
                            filename = f"{identifier.replace('/', '_')}.pdf"
                            file_path = os.path.join(output_dir, filename)
                            with open(file_path, 'wb') as f:
                                f.write(pdf_response.content)
                            downloaded = True
                            method_used = f'manual_scrape_{mirror}'
                            print(f"✓ Downloaded via manual scraping: {file_path}", file=sys.stderr)
                            break
                        else:
                            print(f"  {mirror}: PDF content invalid or blocked", file=sys.stderr)
                    else:
                        print(f"  {mirror}: No PDF link found in page", file=sys.stderr)
                elif response.status_code == 403:
                    print(f"  {mirror}: Blocked (403)", file=sys.stderr)
            except Exception as e:
                print(f"  {mirror}: {e}", file=sys.stderr)
                continue
    except Exception as e:
        print(f"Manual scraping failed: {e}", file=sys.stderr)

# Try Method 4: LibGen (with SSL verification disabled)
if 'libgen' in available_methods and not downloaded and doi and not scihub_blocked:
    try:
        print("Trying LibGen...", file=sys.stderr)
        session = requests.Session()
        session.verify = False
        session.headers.update({'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})

        search_url = f"https://libgen.is/scimag/?q={doi}"
        response = session.get(search_url, timeout=10)

        if response.status_code == 200 and 'opendns.com' not in response.text:
            soup = BeautifulSoup(response.text, 'html.parser')
            download_link = None
            for link in soup.find_all('a'):
                href = link.get('href', '')
                if 'libgen.li' in href or 'download' in href.lower():
                    download_link = href
                    break

            if download_link:
                if not download_link.startswith('http'):
                    download_link = 'https://libgen.is' + download_link

                pdf_response = session.get(download_link, timeout=30)
                if pdf_response.status_code == 200 and pdf_response.content[:5] == b'%PDF-':
                    filename = f"{identifier.replace('/', '_')}.pdf"
                    file_path = os.path.join(output_dir, filename)
                    with open(file_path, 'wb') as f:
                        f.write(pdf_response.content)
                    downloaded = True
                    method_used = 'libgen'
                    print(f"✓ Downloaded via LibGen: {file_path}", file=sys.stderr)
                else:
                    print("LibGen: Downloaded content is not a valid PDF", file=sys.stderr)
    except Exception as e:
        print(f"LibGen failed: {e}", file=sys.stderr)

# Return result
if downloaded and file_path and os.path.exists(file_path):
    file_size = os.path.getsize(file_path)
    print(json.dumps({
        "success": True,
        "file_path": file_path,
        "file_size": file_size,
        "method": method_used,
        "available_methods": available_methods,
        "dns_blocked": scihub_blocked
    }))
else:
    print(json.dumps({
        "success": False,
        "error": "All download methods failed" + (" (Sci-Hub/LibGen DNS-blocked on this network)" if scihub_blocked else ""),
        "available_methods": available_methods,
        "tried_methods": available_methods,
        "dns_blocked": scihub_blocked
    }))
`;

                // Execute Python script
                const tempDir = os.tmpdir();
                const scriptFile = path.join(tempDir, `paper_download_${Date.now()}.py`);
                fs.writeFileSync(scriptFile, pythonScript, 'utf8');

                const pythonProcess = spawn('python', ['-u', scriptFile], {
                    timeout: 60000,
                    cwd: tempDir,
                    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
                });

                let stdout = '';
                let stderr = '';

                pythonProcess.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                pythonProcess.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                pythonProcess.on('close', (exitCode) => {
                    try {
                        fs.unlinkSync(scriptFile);
                    } catch (e) {}

                    try {
                        const result = JSON.parse(stdout);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(result));
                    } catch (e) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Failed to parse download result',
                            stderr: stderr
                        }));
                    }
                });

                pythonProcess.on('error', (err) => {
                    try {
                        fs.unlinkSync(scriptFile);
                    } catch (e) {}

                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: err.message }));
                });

            } catch (error) {
                console.error('Advanced download error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // Search Sci-Hub by topic and download papers
    if (req.url === '/api/scihub-topic-search' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { topic, rsid, maxResults = 20 } = JSON.parse(body);
                if (!topic) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'topic required' }));
                    return;
                }

                console.log(`Sci-Hub topic search for: ${topic} ${rsid || ''}`);

                // Python script to search Sci-Hub by topic
                const pythonScript = `
import sys
import json
import re

try:
    import requests
    from bs4 import BeautifulSoup
    import urllib.parse
    import urllib3
except ImportError:
    print(json.dumps({"error": "Required libraries not installed. Install with: pip install requests beautifulsoup4", "papers": []}))
    sys.exit(0)

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Create a requests session with SSL verification disabled
scraper = requests.Session()
scraper.verify = False
scraper.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
})

topic = "${topic.replace(/"/g, '\\"')}"
rsid = "${rsid || ''}"
max_results = ${maxResults}

# Combine topic and rsid for search
search_query = f"{topic} {rsid}".strip()
print(f"Searching Sci-Hub for: {search_query}", file=sys.stderr)

papers = []

# Method 1: Use Google Scholar to find papers, then check Sci-Hub availability
try:
    # Search Google Scholar for papers
    search_url = f"https://scholar.google.com/scholar?q={urllib.parse.quote(search_query)}"

    response = scraper.get(search_url, timeout=15)

    if response.status_code == 200:
        soup = BeautifulSoup(response.text, 'html.parser')

        # Find paper entries
        for result in soup.find_all('div', class_='gs_ri')[:max_results]:
            try:
                # Extract title
                title_elem = result.find('h3', class_='gs_rt')
                if not title_elem:
                    continue

                title = title_elem.get_text()
                # Remove [PDF] or [HTML] tags
                title = re.sub(r'\\[PDF\\]|\\[HTML\\]', '', title).strip()

                # Extract link
                link_elem = title_elem.find('a')
                url = link_elem.get('href', '') if link_elem else ''

                # Try to extract DOI from various places
                doi = None

                # Check in the snippet text
                snippet = result.get_text()
                doi_match = re.search(r'doi:?\\s*([\\d.]+/[\\S]+)', snippet, re.IGNORECASE)
                if doi_match:
                    doi = doi_match.group(1).strip()

                # Check in gs_a (author/journal info)
                gs_a = result.find('div', class_='gs_a')
                if gs_a and not doi:
                    doi_match = re.search(r'doi:?\\s*([\\d.]+/[\\S]+)', gs_a.get_text(), re.IGNORECASE)
                    if doi_match:
                        doi = doi_match.group(1).strip()

                # If we have a DOI, check Sci-Hub availability
                scihub_available = False
                scihub_url = None

                if doi:
                    # Try to access via Sci-Hub
                    scihub_mirrors = [
                        'https://sci-hub.st',
                        'https://sci-hub.se',
                        'https://sci-hub.ee'
                    ]

                    for mirror in scihub_mirrors:
                        try:
                            scihub_check_url = f"{mirror}/{doi}"
                            scihub_response = scraper.head(scihub_check_url, timeout=10, allow_redirects=True)
                            if scihub_response.status_code == 200:
                                scihub_available = True
                                scihub_url = scihub_check_url
                                print(f"✓ Found on Sci-Hub: {title[:50]}...", file=sys.stderr)
                                break
                        except Exception as e:
                            print(f"Mirror {mirror} check failed: {e}", file=sys.stderr)
                            continue

                papers.append({
                    'title': title,
                    'doi': doi,
                    'url': url,
                    'scihub_available': scihub_available,
                    'scihub_url': scihub_url,
                    'source': 'Scholar + Sci-Hub'
                })

            except Exception as e:
                print(f"Error parsing result: {e}", file=sys.stderr)
                continue

except Exception as e:
    print(f"Scholar search error: {e}", file=sys.stderr)

# Method 2: Direct Sci-Hub search (if available)
try:
    scihub_mirrors = [
        'https://sci-hub.st',
        'https://sci-hub.se',
        'https://sci-hub.ee'
    ]

    for mirror in scihub_mirrors:
        try:
            # Try direct search on Sci-Hub
            search_url = f"{mirror}/search?q={urllib.parse.quote(search_query)}"
            response = scraper.get(search_url, timeout=15)

            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')

                # Parse search results (structure varies by mirror)
                for result in soup.find_all(['div', 'tr'], class_=['result', 'paper'])[:max_results]:
                    try:
                        title_elem = result.find(['a', 'span'], class_=['title'])
                        if not title_elem:
                            continue

                        title = title_elem.get_text().strip()
                        link = result.find('a', href=True)

                        if link:
                            papers.append({
                                'title': title,
                                'scihub_url': mirror + link['href'],
                                'scihub_available': True,
                                'source': 'Sci-Hub Direct'
                            })
                            print(f"✓ Direct Sci-Hub result: {title[:50]}...", file=sys.stderr)
                    except:
                        continue

                if papers:
                    break  # Found results on this mirror

        except Exception as e:
            print(f"Mirror {mirror} error: {e}", file=sys.stderr)
            continue

except Exception as e:
    print(f"Direct Sci-Hub search error: {e}", file=sys.stderr)

# Deduplicate by title
seen_titles = set()
unique_papers = []
for paper in papers:
    title_lower = paper['title'].lower()
    if title_lower not in seen_titles:
        seen_titles.add(title_lower)
        unique_papers.append(paper)

print(json.dumps({
    'papers': unique_papers[:max_results],
    'total': len(unique_papers),
    'source': 'Sci-Hub Topic Search'
}))
`;

                // Execute Python script
                const tempDir = os.tmpdir();
                const scriptFile = path.join(tempDir, `scihub_topic_${Date.now()}.py`);
                fs.writeFileSync(scriptFile, pythonScript, 'utf8');

                const pythonProcess = spawn('python', ['-u', scriptFile], {
                    timeout: 60000,
                    cwd: tempDir,
                    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
                });

                let stdout = '';
                let stderr = '';

                pythonProcess.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                pythonProcess.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                pythonProcess.on('close', (exitCode) => {
                    try {
                        fs.unlinkSync(scriptFile);
                    } catch (e) {}

                    console.log('Sci-Hub search stderr:', stderr);

                    try {
                        const result = JSON.parse(stdout);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(result));
                    } catch (e) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            error: 'Failed to parse Sci-Hub search results',
                            papers: []
                        }));
                    }
                });

                pythonProcess.on('error', (err) => {
                    try {
                        fs.unlinkSync(scriptFile);
                    } catch (e) {}

                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message, papers: [] }));
                });

            } catch (error) {
                console.error('Sci-Hub topic search error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message, papers: [] }));
            }
        });
        return;
    }

    // NEW: Sci-Hub Browser Download (bypasses DDoS-Guard/hCaptcha with Puppeteer)
    if (req.url === '/api/download-paper-scihub-browser' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { pmid, doi } = JSON.parse(body);
                if (!pmid && !doi) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'PMID or DOI required' }));
                    return;
                }

                const identifier = pmid || doi;
                console.log(`🌐 Sci-Hub Browser Download: ${identifier}`);

                // Try to load puppeteer
                let puppeteer;
                try {
                    puppeteer = require('puppeteer');
                } catch (e) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: 'Puppeteer not installed'
                    }));
                    return;
                }

                const scihubMirrors = [
                    'https://sci-hub.se',
                    'https://sci-hub.st',
                    'https://sci-hub.ru',
                    'https://sci-hub.ren'
                ];

                let browser = null;
                let success = false;
                let resultData = null;
                let dnsBlocked = false;

                for (const mirror of scihubMirrors) {
                    if (dnsBlocked) break;

                    try {
                        const scihubUrl = `${mirror}/${identifier}`;
                        console.log(`  🔍 Trying ${mirror}...`);

                        browser = await puppeteer.launch({
                            headless: 'new',
                            args: [
                                '--no-sandbox',
                                '--disable-setuid-sandbox',
                                '--disable-dev-shm-usage',
                                '--ignore-certificate-errors',
                                '--ignore-certificate-errors-spki-list'
                            ]
                        });

                        const page = await browser.newPage();
                        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

                        await page.goto(scihubUrl, {
                            waitUntil: 'networkidle0',
                            timeout: 30000
                        });

                        // Check for DNS-level blocking (OpenDNS/Cisco Umbrella redirect)
                        const pageUrl = page.url();
                        const pageContent = await page.content();
                        if (pageUrl.includes('opendns.com') || pageContent.includes('opendns.com') || pageContent.includes('Cisco Umbrella')) {
                            console.log(`  ⚠ Sci-Hub DNS-blocked on this network (Cisco Umbrella)`);
                            dnsBlocked = true;
                            await browser.close();
                            browser = null;
                            break;
                        }

                        await new Promise(resolve => setTimeout(resolve, 3000));

                        // Try to find PDF embed/iframe
                        const pdfUrl = await page.evaluate(() => {
                            const embed = document.querySelector('embed[type="application/pdf"]');
                            if (embed && embed.src) return embed.src;

                            const iframe = document.querySelector('iframe[src*=".pdf"]');
                            if (iframe && iframe.src) return iframe.src;

                            const link = document.querySelector('a[href*=".pdf"]');
                            if (link && link.href) return link.href;

                            return null;
                        });

                        if (pdfUrl) {
                            console.log(`  ✅ Found PDF: ${pdfUrl.substring(0, 60)}...`);

                            const pdfPage = await browser.newPage();
                            const response = await pdfPage.goto(pdfUrl, { waitUntil: 'networkidle0', timeout: 30000 });
                            const pdfBuffer = await response.buffer();

                            // Validate PDF
                            if (!isValidPdf(pdfBuffer)) {
                                console.log(`  ❌ Downloaded content is not a valid PDF (${pdfBuffer.length} bytes)`);
                                await browser.close();
                                browser = null;
                                continue;
                            }

                            const tempDir = path.join(__dirname, 'temp_papers');
                            if (!fs.existsSync(tempDir)) {
                                fs.mkdirSync(tempDir, { recursive: true });
                            }

                            const filename = `${identifier.replace(/[\/\\:*?"<>|]/g, '_')}.pdf`;
                            const filepath = path.join(tempDir, filename);
                            fs.writeFileSync(filepath, pdfBuffer);

                            const stats = fs.statSync(filepath);
                            console.log(`  💾 Saved: ${(stats.size / 1024).toFixed(0)} KB`);

                            resultData = {
                                success: true,
                                pmid: pmid || null,
                                doi: doi || null,
                                mirror: mirror,
                                file_path: filepath,
                                file_size: stats.size,
                                message: 'PDF downloaded via browser'
                            };

                            success = true;
                            await browser.close();
                            break;
                        } else {
                            console.log(`  ❌ No PDF found on ${mirror}`);
                        }

                        await browser.close();
                        browser = null;

                    } catch (error) {
                        console.log(`  ⚠ Error with ${mirror}: ${error.message}`);
                        if (browser) {
                            try { await browser.close(); } catch(e) {}
                            browser = null;
                        }
                    }
                }

                if (success) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(resultData));
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: dnsBlocked
                            ? 'Sci-Hub domains are DNS-blocked on this network (Cisco Umbrella/OpenDNS)'
                            : 'Paper not found on any Sci-Hub mirror',
                        dns_blocked: dnsBlocked
                    }));
                }

            } catch (error) {
                console.error('Sci-Hub browser download error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // Download papers via Sci-Hub using Puppeteer (bypasses DDoS-Guard/hCaptcha)
    if (req.url === '/api/download-paper-scihub' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { pmid, doi } = JSON.parse(body);
                if (!pmid && !doi) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'PMID or DOI required' }));
                    return;
                }

                console.log(`Downloading paper via Sci-Hub (HTTP): ${pmid || doi}`);

                // NOTE: This endpoint uses HTTP scraping, NOT Puppeteer
                // Sci-Hub mirrors to try
                const scihubMirrors = [
                    'https://sci-hub.se',
                    'https://sci-hub.st',
                    'https://sci-hub.ru',
                    'https://sci-hub.ee',
                    'https://sci-hub.ren',
                    'https://sci-hub.wf'
                ];

                let mirrorIndex = 0;
                let pdfBuffer = null;

                const tryNextMirror = () => {
                    if (mirrorIndex >= scihubMirrors.length) {
                        console.log('All Sci-Hub mirrors failed');
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Paper not found on any Sci-Hub mirror'
                        }));
                        return;
                    }

                    const mirror = scihubMirrors[mirrorIndex];
                    const identifier = pmid || doi;
                    const scihubUrl = `${mirror}/${identifier}`;

                    console.log(`Trying mirror ${mirrorIndex + 1}/${scihubMirrors.length}: ${mirror}`);

                    // Disable SSL verification for Sci-Hub (self-signed certificates)
                    const requestOptions = {
                        rejectUnauthorized: false,
                        timeout: 15000 // 15 second timeout
                    };

                    https.get(scihubUrl, requestOptions, (scihubRes) => {
                        // Detect DNS-level blocking (Cisco Umbrella returns 403 with redirect)
                        if (scihubRes.statusCode === 403) {
                            let body403 = '';
                            scihubRes.on('data', chunk => body403 += chunk);
                            scihubRes.on('end', () => {
                                if (body403.includes('opendns.com') || body403.includes('Cisco Umbrella')) {
                                    console.log(`⚠ Sci-Hub DNS-blocked on this network (Cisco Umbrella). Skipping all mirrors.`);
                                    res.writeHead(200, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({
                                        success: false,
                                        error: 'Sci-Hub domains are DNS-blocked on this network (Cisco Umbrella/OpenDNS)',
                                        dns_blocked: true
                                    }));
                                } else {
                                    console.log(`Mirror ${mirror} returned 403`);
                                    mirrorIndex++;
                                    tryNextMirror();
                                }
                            });
                            return;
                        }

                        let html = '';
                        scihubRes.on('data', chunk => html += chunk);
                        scihubRes.on('end', () => {
                            // Detect Cloudflare challenge pages
                            if (html.includes('cf_chl_opt') || html.includes('challenge-error-text')) {
                                console.log(`Mirror ${mirror} returned Cloudflare challenge (needs browser)`);
                                mirrorIndex++;
                                tryNextMirror();
                                return;
                            }

                            // Try to find PDF URL in HTML
                            let pdfMatch = html.match(/location\.href='(\/downloads[^']+\.pdf)'/);
                            if (!pdfMatch) pdfMatch = html.match(/<iframe[^>]+src="([^"]+\.pdf[^"]*)"/i);
                            if (!pdfMatch) pdfMatch = html.match(/<embed[^>]+src="([^"]+\.pdf[^"]*)"/i);
                            if (!pdfMatch) pdfMatch = html.match(/<button[^>]+onclick="location\.href='([^']+\.pdf[^']*)'/i);
                            if (!pdfMatch) pdfMatch = html.match(/<a[^>]+href="([^"]+\.pdf[^"]*)"/i);
                            if (!pdfMatch) pdfMatch = html.match(/(https?:\/\/[^\s<>"]+\.pdf)/);
                            if (!pdfMatch) pdfMatch = html.match(/pdf_url\s*=\s*["']([^"']+\.pdf[^"']*)["']/i);

                            if (pdfMatch) {
                                let pdfUrl = pdfMatch[1] || pdfMatch[0];

                                if (pdfUrl.startsWith('/')) {
                                    pdfUrl = mirror + pdfUrl;
                                } else if (!pdfUrl.startsWith('http')) {
                                    pdfUrl = mirror + '/' + pdfUrl;
                                }

                                console.log(`Found PDF URL: ${pdfUrl}`);

                                const pdfRequest = pdfUrl.startsWith('https') ? https : http;
                                const pdfOptions = pdfUrl.startsWith('https') ? { rejectUnauthorized: false, timeout: 30000 } : { timeout: 30000 };
                                pdfRequest.get(pdfUrl, pdfOptions, (pdfRes) => {
                                    const chunks = [];
                                    pdfRes.on('data', chunk => chunks.push(chunk));
                                    pdfRes.on('end', () => {
                                        pdfBuffer = Buffer.concat(chunks);

                                        // Validate PDF content
                                        if (!isValidPdf(pdfBuffer)) {
                                            console.log(`Downloaded content from ${mirror} is not a valid PDF (${pdfBuffer.length} bytes)`);
                                            mirrorIndex++;
                                            tryNextMirror();
                                            return;
                                        }

                                        console.log(`Downloaded valid PDF: ${pdfBuffer.length} bytes`);

                                        const tempDir = path.join(__dirname, 'temp_papers');
                                        if (!fs.existsSync(tempDir)) {
                                            fs.mkdirSync(tempDir, { recursive: true });
                                        }

                                        const filename = `${pmid || doi.replace(/\//g, '_')}.pdf`;
                                        const filepath = path.join(tempDir, filename);
                                        fs.writeFileSync(filepath, pdfBuffer);

                                        res.writeHead(200, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({
                                            success: true,
                                            pmid: pmid || null,
                                            doi: doi || null,
                                            mirror: mirror,
                                            file_path: filepath,
                                            file_size: pdfBuffer.length,
                                            message: 'PDF downloaded successfully. Use Python for text extraction.'
                                        }));
                                    });
                                }).on('error', (err) => {
                                    console.log(`PDF download error: ${err.message}`);
                                    mirrorIndex++;
                                    tryNextMirror();
                                });
                            } else {
                                console.log(`No PDF found on ${mirror}`);
                                mirrorIndex++;
                                tryNextMirror();
                            }
                        });
                    }).on('error', (err) => {
                        console.log(`Mirror ${mirror} error: ${err.message}`);
                        mirrorIndex++;
                        tryNextMirror();
                    });
                };

                tryNextMirror();

            } catch (error) {
                console.error('Sci-Hub download error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // PMC Full-Text API proxy (to avoid CORS)
    if (req.url === '/api/pmc-fulltext' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const { pmcId } = JSON.parse(body);
                if (!pmcId) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'PMC ID required' }));
                    return;
                }

                console.log(`Fetching PMC full text: ${pmcId}`);

                const pmcUrl = `https://www.ncbi.nlm.nih.gov/research/bionlp/RESTful/pmcoa.cgi/BioC_json/${pmcId}/unicode`;

                https.get(pmcUrl, (pmcRes) => {
                    let data = '';
                    pmcRes.on('data', chunk => data += chunk);
                    pmcRes.on('end', () => {
                        try {
                            const pmcRaw = JSON.parse(data);
                            // PMC BioNLP API returns an array: [{documents: [{passages: [...]}]}]
                            const pmcData = Array.isArray(pmcRaw) ? pmcRaw[0] : pmcRaw;
                            if (pmcData && pmcData.documents && pmcData.documents[0]) {
                                const fullText = pmcData.documents[0].passages.map(p => p.text).join('\n\n');
                                console.log(`✓ PMC full text retrieved: ${Math.round(fullText.length / 1024)} KB`);

                                // Save full text to file
                                const tempDir = path.join(__dirname, 'temp_papers');
                                if (!fs.existsSync(tempDir)) {
                                    fs.mkdirSync(tempDir, { recursive: true });
                                }

                                const filename = `PMC${pmcId}_${Date.now()}.txt`;
                                const filepath = path.join(tempDir, filename);
                                fs.writeFileSync(filepath, fullText, 'utf8');
                                console.log(`✓ PMC full text saved: ${filepath}`);

                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({
                                    success: true,
                                    pmcId: pmcId,
                                    fullText: fullText,
                                    length: fullText.length,
                                    file_path: filepath,
                                    file_type: 'txt',
                                    source: 'PMC API'
                                }));
                            } else {
                                res.writeHead(404, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ success: false, error: 'No full text available' }));
                            }
                        } catch (e) {
                            console.error('PMC parse error:', e.message);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: false, error: 'Failed to parse PMC response' }));
                        }
                    });
                }).on('error', (err) => {
                    console.error('PMC API error:', err.message);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: err.message }));
                });

            } catch (error) {
                console.error('PMC full-text error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // ============================================================
    // Local ML Model Endpoints
    // ============================================================

    // POST /api/local-models/status — Check health of local model services
    if (req.url === '/api/local-models/status' && req.method === 'POST') {
        try {
            const [debertaHealth, robertaHealth, summarizerHealth, rankerHealth] = await Promise.all([
                checkLocalModelHealth(LOCAL_MODEL_CONFIG.deberta.port),
                checkLocalModelHealth(LOCAL_MODEL_CONFIG.roberta.port),
                checkLocalModelHealth(LOCAL_MODEL_CONFIG.summarizer.port),
                checkLocalModelHealth(LOCAL_MODEL_CONFIG.ranker.port)
            ]);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                deberta: { ...debertaHealth, port: LOCAL_MODEL_CONFIG.deberta.port, model: LOCAL_MODEL_CONFIG.deberta.modelName },
                roberta: { ...robertaHealth, port: LOCAL_MODEL_CONFIG.roberta.port, model: LOCAL_MODEL_CONFIG.roberta.modelName },
                summarizer: { ...summarizerHealth, port: LOCAL_MODEL_CONFIG.summarizer.port, model: LOCAL_MODEL_CONFIG.summarizer.modelName },
                ranker: { ...rankerHealth, port: LOCAL_MODEL_CONFIG.ranker.port, model: LOCAL_MODEL_CONFIG.ranker.modelName }
            }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // POST /api/local-models/start — Start Docker containers for model services
    if (req.url === '/api/local-models/start' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { services } = JSON.parse(body);
                const toStart = services || ['deberta'];
                const results = {};

                for (const svc of toStart) {
                    if (!LOCAL_MODEL_CONFIG[svc]) {
                        results[svc] = { started: false, error: `Unknown service: ${svc}` };
                        continue;
                    }
                    // Check if already running
                    const health = await checkLocalModelHealth(LOCAL_MODEL_CONFIG[svc].port);
                    if (health.healthy) {
                        results[svc] = { started: true, alreadyRunning: true, model: LOCAL_MODEL_CONFIG[svc].modelName };
                        continue;
                    }
                    const result = await startDockerService(svc);
                    results[svc] = { started: result.success, containerId: result.containerId, error: result.error };
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(results));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // POST /api/local-models/stop — Stop Docker containers
    if (req.url === '/api/local-models/stop' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { services } = JSON.parse(body);
                const toStop = services || ['deberta', 'roberta'];
                const results = {};

                for (const svc of toStop) {
                    results[svc] = await stopDockerService(svc);
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(results));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // POST /api/local-models/analyze-contradictions — Proxy contradiction analysis to local models
    if (req.url === '/api/local-models/analyze-contradictions' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { statements, model } = JSON.parse(body);

                if (!statements || !Array.isArray(statements) || statements.length < 2) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'At least 2 statements required' }));
                    return;
                }

                const useModel = model || 'deberta';
                console.log(`Contradiction analysis: ${statements.length} statements, model: ${useModel}`);

                if (useModel === 'both') {
                    // Run both models in parallel and merge results
                    const [debertaResult, robertaResult] = await Promise.all([
                        proxyContradictionRequest(LOCAL_MODEL_CONFIG.deberta.port, statements),
                        proxyContradictionRequest(LOCAL_MODEL_CONFIG.roberta.port, statements)
                    ]);

                    // Merge: average the scores from both models
                    const merged = {
                        success: true,
                        model: 'DeBERTa + RoBERTa (ensemble)',
                        models_used: ['DeBERTa-v3-large', 'RoBERTa-large-MNLI'],
                        contradictions: []
                    };

                    const debertaContradictions = debertaResult.contradictions || [];
                    const robertaContradictions = robertaResult.contradictions || [];

                    // Index roberta results by pair for fast lookup
                    const robertaMap = {};
                    for (const c of robertaContradictions) {
                        const key = `${c.statement1_id || c.paper1_id}__${c.statement2_id || c.paper2_id}`;
                        robertaMap[key] = c;
                    }

                    for (const dc of debertaContradictions) {
                        const key = `${dc.statement1_id || dc.paper1_id}__${dc.statement2_id || dc.paper2_id}`;
                        const rc = robertaMap[key];
                        const avgScore = rc
                            ? (dc.contradiction_score + rc.contradiction_score) / 2
                            : dc.contradiction_score;

                        merged.contradictions.push({
                            ...dc,
                            contradiction_score: avgScore,
                            deberta_score: dc.contradiction_score,
                            roberta_score: rc ? rc.contradiction_score : null
                        });
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(merged));
                } else {
                    // Single model
                    const config = LOCAL_MODEL_CONFIG[useModel];
                    if (!config) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: `Unknown model: ${useModel}` }));
                        return;
                    }

                    const result = await proxyContradictionRequest(config.port, statements);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        model: config.modelName,
                        ...result
                    }));
                }
            } catch (error) {
                console.error('Contradiction analysis error:', error.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // POST /api/local-models/summarize — Proxy to local summarizer service
    if (req.url === '/api/local-models/summarize' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const postData = body;
                const proxyReq = http.request({
                    hostname: 'localhost',
                    port: LOCAL_MODEL_CONFIG.summarizer.port,
                    path: '/summarize',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
                    timeout: 120000
                }, (proxyRes) => {
                    let data = '';
                    proxyRes.on('data', chunk => data += chunk);
                    proxyRes.on('end', () => {
                        res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
                        res.end(data);
                    });
                });
                proxyReq.on('error', (err) => {
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Summarizer service not available: ' + err.message }));
                });
                proxyReq.on('timeout', () => { proxyReq.destroy(); });
                proxyReq.write(postData);
                proxyReq.end();
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // POST /api/local-models/rank — Proxy to local relevance ranking service
    if (req.url === '/api/local-models/rank' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const postData = body;
                const proxyReq = http.request({
                    hostname: 'localhost',
                    port: LOCAL_MODEL_CONFIG.ranker.port,
                    path: '/rank',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
                    timeout: 120000
                }, (proxyRes) => {
                    let data = '';
                    proxyRes.on('data', chunk => data += chunk);
                    proxyRes.on('end', () => {
                        res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
                        res.end(data);
                    });
                });
                proxyReq.on('error', (err) => {
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Ranker service not available: ' + err.message }));
                });
                proxyReq.on('timeout', () => { proxyReq.destroy(); });
                proxyReq.write(postData);
                proxyReq.end();
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // Handle favicon.ico request
    if (req.url === '/favicon.ico') {
        res.writeHead(204); // No Content
        res.end();
        return;
    }

    // Serve static files
    // Remove query parameters for cache busting
    let urlPath = req.url.split('?')[0];
    let filePath = urlPath === '/' ? '/index.html' : urlPath;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

// Get local IP address
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const LOCAL_IP = getLocalIP();

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   Novogenia Scientific Assistant Server                    ║
║                                                            ║
║   Lokal:      http://localhost:${PORT}                       ║
║   Netzwerk:   http://${LOCAL_IP}:${PORT}                       ║
║                                                            ║
║   Öffne eine dieser URLs im Browser.                       ║
║                                                            ║
║   Drücke Ctrl+C zum Beenden.                               ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
});
