// Generate a simple UUID for sentence ID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function parseCtsRangeUrn(rangeUrn) {
    const parts = rangeUrn.split(':');
    const base = parts.slice(0, -1).join(':') + ':';
    const rangePart = parts[parts.length - 1];
    const [fromPass, toPass] = rangePart.split('-');
    return {
        fromUrn: base + fromPass,
        toUrn: base + toPass,
        fullRange: rangeUrn
    };
}

function createTokenObject(urn, text, displayNum, isRoot = false) {
    const cleanTxt = text.trim();
    const isPunct = PUNCTUATION.includes(cleanTxt);

    return {
        text: cleanTxt,
        type: isPunct ? 'punctuation' : 'lexical',
        tokenId: isRoot ? "root" : urn.trim(),
        displayId: isRoot ? 0 : (isPunct ? null : displayNum)
    };
}

async function fetchAndParseTsv(tsvPath) {
    const resp = await fetch(tsvPath);
    if (!resp.ok) throw new Error(`Failed to load ${tsvPath}`);
    const text = await resp.text();
    const lines = text.trim().split('\n');
    const data = [];
    for (let i = 1; i < lines.length; i++) { // skip comment + header
        const line = lines[i].trim();
        if (!line || line.startsWith('//')) continue;
        const [label, textPath, sentenceUrn] = line.split('\t');
        if (label && textPath && sentenceUrn) {
            data.push({ label: label.trim(), textPath: textPath.trim(), sentenceUrn: sentenceUrn.trim() });
        }
    }
    return data;
}

async function loadTokensFromCex(cexPath, fromUrn, toUrn) {
    const resp = await fetch(cexPath);
    if (!resp.ok) throw new Error(`Failed to load ${cexPath}`);
    const text = await resp.text();
    const lines = text.split('\n');

    let dataStart = false;
    const ctsDataLines = [];
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        if (line === '#!ctsdata') {
            dataStart = true;
            continue;
        }
        if (dataStart && line.startsWith('urn:cts:')) {
            ctsDataLines.push(line);
        }
    }

    const startIdx = ctsDataLines.findIndex(l => l.split('#')[0].trim() === fromUrn);
    const endIdx = ctsDataLines.findIndex(l => l.split('#')[0].trim() === toUrn);

    if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
        throw new Error(`Could not find token range ${fromUrn}–${toUrn} in ${cexPath}`);
    }

    const tokenLines = ctsDataLines.slice(startIdx, endIdx + 1);

    const loadedTokens = [createTokenObject(null, "Sentence Root", 0, true)];

    let displayEnum = 1;

    for (const line of tokenLines) {
        const [urn, txt] = line.split('#');
        if (!urn || !txt) continue;

        const tokenObj = createTokenObject(urn, txt, displayEnum);
        if (!tokenObj.type.includes('punctuation')) {
            displayEnum++;
        }
        loadedTokens.push(tokenObj);
    }

    return loadedTokens;
}

function resetAnalysisState() {
    verbalUnits = [];
    verbalUnitIdCounter = 1;
    tokenAssignments = [];
    tokenAnalyses = [];
    editingUnitId = null;
    sentenceId = generateUUID();
    cite2Urn = `urn:cite2:analyzer:analysis:2025-06-13-${sentenceId}`;
}

// Initialize DOM elements
const input = document.getElementById('sentence-input');
const ctsUrnDisplay = document.getElementById('cts-urn');
const cite2UrnDisplay = document.getElementById('cite2-urn');
const tokenOutput = document.getElementById('token-output');
const stage1Section = document.getElementById('stage1-section');
const stage2Section = document.getElementById('stage2-section');
const verbalUnitForm = document.getElementById('verbal-unit-form');
const verbalUnitIdDisplay = document.getElementById('verbal-unit-id');
const syntacticType = document.getElementById('syntactic-type');
const semanticType = document.getElementById('semantic-type');
const level = document.getElementById('level');
const confirmBtn = document.getElementById('confirm-btn');
const verbalUnitTableBody = document.getElementById('verbal-unit-table-body');
const verbalUnitSelect = document.getElementById('verbal-unit-select');
const assignmentDisplay = document.getElementById('assignment-display');
const analysisTableBody = document.getElementById('analysis-table-body');
const graphContainer = document.getElementById('graph-container');
const exportCexBtn1 = document.getElementById('export-cex1');
const exportCexBtn2 = document.getElementById('export-cex2');
const importCexBtn = document.getElementById('import-cex-btn');
const importCexInput = document.getElementById('import-cex');

// Punctuation list (shared)
const PUNCTUATION = [',', '.', ';', ':', '·', '—', '–'];

// List of all sentence TSV files (add new ones here when you add more .tsv files)
const sentenceTsvFiles = [
    "Frogs_sentences.tsv",
    ...Array.from({ length: 20 }, (_, i) => `Hansen_Quinn_Sentences_${String(i + 1).padStart(2, '0')}.tsv`),
    "Herodotus_sentences.tsv",
    "Iliad_sentences.tsv"
];

let currentSentencesData = []; // populated when a collection is chosen

// State management
let tokens = [];
let verbalUnits = [];
let verbalUnitIdCounter = 1;
let sentenceId = generateUUID();
let editingUnitId = null;
let tokenAssignments = []; // { tokenId: number, verbalUnitIds: string[] }
let tokenAnalyses = []; // { tokenId: number, node1Id: number|null, node1Relation: string, node2Id: number|null, node2Relation: string }
let graphNetwork = null;
let ctsUrn = 'urn:cts:greekLit:tlg0054.tlg001.perseus-grc1:1.1.1';
let cite2Urn = `urn:cite2:analyzer:analysis:2025-06-13-${sentenceId}`;

// Allowed syntactic relations (used for dropdowns)
const RELATION_OPTIONS = [
    "Sentence Adverbial",
    "Unit Adverbial",
    "Conjunction",
    "Apostrophe",
    "Finite Unit Verb",
    "Infinitive Unit Verb",
    "Circumstantial Participle",
    "Attributive Participle",
    "Auxiliary Infinitive",
    "Articular Infinitive",
    "Adverbial",
    "Correlated",
    "Preposition",
    "Attribute",
    "Predicative",
    "Subject",
    "Appositive",
    "Direct Object",
    "Dative",
    "Genitive",
    "Accusative",
    "Punctuation"
];

// Default sentence from Homer
const defaultSentence = "μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος οὐλομένην, ἣ μυρί' Ἀχαιοῖς ἄλγε' ἔθηκε.";
input.value = defaultSentence;

// Tokenize the input sentence, adding Token 0 (Sentence Root)
function tokenize(sentence) {
    const tokens = [{ text: "Sentence Root", type: 'lexical', id: 0 }];
    let currentToken = '';
    let lexicalId = 1;
    const punctuation = [',', '.', ';', ':'];

    for (let i = 0; i < sentence.length; i++) {
        const char = sentence[i];
        if (/\s/.test(char)) {
            if (currentToken) {
                tokens.push({ text: currentToken, type: 'lexical', id: lexicalId++ });
                currentToken = '';
            }
            tokens.push({ text: char, type: 'white-space', id: null });
        } else if (punctuation.includes(char)) {
            if (currentToken) {
                tokens.push({ text: currentToken, type: 'lexical', id: lexicalId++ });
                currentToken = '';
            }
            tokens.push({ text: char, type: 'punctuation', id: null });
        } else {
            currentToken += char;
        }
    }
    if (currentToken) {
        tokens.push({ text: currentToken, type: 'lexical', id: lexicalId++ });
    }
    return tokens;
}

// Update inline token display + apply assignment classes
function updateTokenDisplay() {
    tokenOutput.innerHTML = '';
    tokens.forEach((token, index) => {
        if (token.tokenId === "root" || token.displayId === 0) return;

        const span = document.createElement('span');

        if (token.type === 'lexical') {
            span.className = 'token-lexical';
            span.innerHTML = `${token.text}<sup class="token-id">${token.displayId}</sup>`;
            span.dataset.tokenId = token.tokenId;

            // Apply assignment classes for visual feedback
            const assignment = tokenAssignments.find(a => a.tokenId === token.id);
            if (assignment && assignment.verbalUnitIds.length > 0) {
                const vuIndex = verbalUnits.findIndex(u => u.id === assignment.verbalUnitIds[0]);
                if (vuIndex !== -1) {
                    span.classList.add(`assigned-vu${Math.min(vuIndex + 1, 5)}`);
                }
            }

            // Click to toggle assignment for currently selected verbal unit
            span.addEventListener('click', () => {
                toggleTokenAssignment(token.id);
            });

        } else if (token.type === 'white-space') {
            span.className = 'token-white-space';
            span.textContent = token.text;
        } else if (token.type === 'punctuation') {
            span.className = 'token-punctuation';
            span.textContent = token.text;
        }

        tokenOutput.appendChild(span);
    });
    ctsUrnDisplay.textContent = ctsUrn;
}

// Update verbal unit form ID display
function updateVerbalUnitForm() {
    verbalUnitIdDisplay.textContent = editingUnitId || `VU${verbalUnitIdCounter}`;
}

// Handle verbal unit confirmation or editing
confirmBtn.addEventListener('click', () => {
    let unitId;
    if (editingUnitId) {
        const unitIndex = verbalUnits.findIndex(u => u.id === editingUnitId);
        if (unitIndex !== -1) {
            verbalUnits[unitIndex] = {
                id: editingUnitId,
                syntacticType: syntacticType.value,
                semanticType: semanticType.value,
                level: parseInt(level.value)
            };
        }
        editingUnitId = null;
        confirmBtn.textContent = 'Confirm Verbal Unit';
    } else {
        unitId = `VU${verbalUnitIdCounter++}`;
        verbalUnits.push({
            id: unitId,
            syntacticType: syntacticType.value,
            semanticType: semanticType.value,
            level: parseInt(level.value)
        });
    }
    updateVerbalUnitTable();
    syntacticType.selectedIndex = 0;
    semanticType.selectedIndex = 0;
    level.selectedIndex = 0;
    updateVerbalUnitForm();
    updateVerbalUnitSelect();
    updateAssignmentDisplay();
});

// Staged reveal handlers 1
const doneStage1 = document.getElementById('done-stage1');
if (doneStage1 && stage2Section) {
    doneStage1.addEventListener('click', () => {
        stage2Section.style.display = 'block';
        stage2Section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Optional: collapse/hide stage1 after proceeding
        // stage1Section.style.display = 'none';
    });
}

// Staged reveal handlers 2
/*
const doneStage2 = document.getElementById('done-stage2');
if (doneStage2 && stage3Section) {
    console.log("click stage 2");
    doneStage2.addEventListener('click', () => {
        stage3Section.style.display = 'block';
        stage3Section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Optional: collapse/hide stage1 after proceeding
        // stage1Section.style.display = 'none';
    });
}
*/



// Handle verbal unit editing
function editVerbalUnit(id) {
    const unit = verbalUnits.find(u => u.id === id);
    if (unit) {
        editingUnitId = id;
        syntacticType.value = unit.syntacticType;
        semanticType.value = unit.semanticType;
        level.value = unit.level;
        confirmBtn.textContent = 'Save Changes';
        updateVerbalUnitForm();
    }
}

// Handle verbal unit deletion
function deleteVerbalUnit(id) {
    verbalUnits = verbalUnits.filter(u => u.id !== id);
    tokenAssignments.forEach(assignment => {
        assignment.verbalUnitIds = assignment.verbalUnitIds.filter(vuId => vuId !== id);
    });
    tokenAssignments = tokenAssignments.filter(a => a.verbalUnitIds.length > 0);

    updateVerbalUnitTable();
    updateVerbalUnitSelect();
    updateAssignmentDisplay();
    updateAnalysisTable();
}

// Update verbal unit table
function updateVerbalUnitTable() {

    console.log('%c[updateVerbalUnitTable] called with', 'color: green', verbalUnits.length, 'units');

    verbalUnitTableBody.innerHTML = '';
    verbalUnits.forEach(unit => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${unit.id}</td>
            <td>${unit.syntacticType}</td>
            <td>${unit.semanticType}</td>
            <td>${unit.level}</td>
            <td>
                <button class="action-btn edit-btn" data-id="${unit.id}">Edit</button>
                <button class="action-btn delete-btn" data-id="${unit.id}">Delete</button>
            </td>
        `;
        verbalUnitTableBody.appendChild(row);
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => editVerbalUnit(btn.dataset.id));
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteVerbalUnit(btn.dataset.id));
    });
}

// Update verbal unit dropdown
function updateVerbalUnitSelect() {
    verbalUnitSelect.innerHTML = verbalUnits.length === 0 
        ? '<option value="">No verbal units defined</option>' 
        : '';

    verbalUnits.forEach(unit => {
        const option = document.createElement('option');
        option.value = unit.id;
        option.textContent = `${unit.id} (${unit.syntacticType})`;
        verbalUnitSelect.appendChild(option);
    });

    verbalUnitSelect.removeEventListener('change', updateAssignmentDisplay);
    verbalUnitSelect.addEventListener('change', updateAssignmentDisplay);

    if (verbalUnits.length > 0 && !verbalUnitSelect.value) {
        verbalUnitSelect.value = verbalUnits[0].id;
        updateAssignmentDisplay();
    }
}

// Toggle token assignment to currently selected verbal unit
function toggleTokenAssignment(tokenId) {
    if (!verbalUnits.length) return;
    const selectedUnitId = verbalUnitSelect.value;
    if (!selectedUnitId) return;

    let assignment = tokenAssignments.find(a => a.tokenId === tokenId);
    if (assignment) {
        if (assignment.verbalUnitIds.includes(selectedUnitId)) {
            assignment.verbalUnitIds = assignment.verbalUnitIds.filter(vuId => vuId !== selectedUnitId);
            if (assignment.verbalUnitIds.length === 0) {
                tokenAssignments = tokenAssignments.filter(a => a.tokenId !== tokenId);
            }
        } else {
            assignment.verbalUnitIds.push(selectedUnitId);
        }
    } else {
        tokenAssignments.push({ tokenId, verbalUnitIds: [selectedUnitId] });
    }

    updateTokenDisplay();
    updateAssignmentDisplay();
}

// Update token assignment display (with unassigned tokens)
function updateAssignmentDisplay() {
    assignmentDisplay.innerHTML = '';
    const selectedUnitId = verbalUnitSelect.value;

    verbalUnits.forEach(unit => {
        const assignedTokens = tokenAssignments
            .filter(a => a.verbalUnitIds.includes(unit.id))
            .map(a => tokens.find(t => t.id === a.tokenId))
            .filter(Boolean)
            .sort((a, b) => a.id - b.id);

        const row = document.createElement('div');
        row.className = `verbal-unit-row level-${unit.level}`;

        const hasTokens = assignedTokens.length > 0;
        row.innerHTML = `
            <div class="unit-info">
                ${unit.id} (${unit.syntacticType}, ${unit.semanticType}, Level ${unit.level})
                ${!hasTokens ? ' — <em>no tokens assigned yet</em>' : ''}
            </div>
            <div class="tokens"></div>
        `;

        const tokensContainer = row.querySelector('.tokens');

        assignedTokens.forEach(token => {
            const span = document.createElement('span');
            const vuIndex = verbalUnits.findIndex(u => u.id === unit.id);
            const isCurrent = unit.id === selectedUnitId;

            span.className = `token-lexical assigned-vu${Math.min(vuIndex + 1, 5)}${isCurrent ? ' current-unit' : ''}`;

            span.innerHTML = `${token.text}<sup class="token-id">${token.displayId}</sup>`;            

            span.dataset.tokenId = token.tokenId;   // still stores the real URN

            if (isCurrent) {
                span.addEventListener('click', () => toggleTokenAssignment(token.id));
            }
            tokensContainer.appendChild(span);
        });

        assignmentDisplay.appendChild(row);
    });

    // Unassigned tokens section for the currently selected unit
    if (selectedUnitId) {
        const unassigned = tokens.filter(t =>
            t.type === 'lexical' &&
            t.tokenId !== "root" &&                    // ← fixed root check
            !tokenAssignments.some(a => 
                a.tokenId === t.tokenId && 
                a.verbalUnitIds.includes(selectedUnitId)
            )
        );

        if (unassigned.length > 0) {
            const unassignedDiv = document.createElement('div');
            unassignedDiv.id = 'unassigned-tokens';
            unassignedDiv.innerHTML = `
            <div class="unit-info">Unassigned Tokens (click to assign):</div>
            <div class="tokens"></div>
            `;
            const container = unassignedDiv.querySelector('.tokens');

            unassigned.forEach(token => {
                const span = document.createElement('span');
                span.className = 'token-lexical';

                const assignment = tokenAssignments.find(a => a.tokenId === token.tokenId);
                const isAssignedElsewhere = assignment && assignment.verbalUnitIds.length > 0;

                if (isAssignedElsewhere) {
                    span.classList.add('has-other-assignments');
                    const otherVUs = assignment.verbalUnitIds.join(', ');
                    span.title = `Already assigned to: ${otherVUs} (still assignable here)`;
                }

                // Use displayId for the visible number
                span.innerHTML = `${token.text}<sup class="token-id">${token.displayId}</sup>`;
                span.dataset.tokenId = token.tokenId;                    // real ID
                span.addEventListener('click', () => toggleTokenAssignment(token.tokenId));
                container.appendChild(span);
            });

            assignmentDisplay.appendChild(unassignedDiv);
        }
    }
}

// Update analysis table with RELATION DROPDOWNS
function updateAnalysisTable() {
    analysisTableBody.innerHTML = '';

    // Sentence Root row
    const rootRow = document.createElement('tr');
    rootRow.innerHTML = `
        <td>0</td>
        <td>Sentence Root</td>
        <td><select disabled><option value="">N/A</option></select></td>
        <td><select disabled><option value="">N/A</option></select></td>
        <td><select disabled><option value="">N/A</option></select></td>
        <td><select disabled><option value="">N/A</option></select></td>
    `;
    analysisTableBody.appendChild(rootRow);

    tokens.filter(t => t.type === 'lexical' && t.id !== 0).forEach(token => {
        const analysis = tokenAnalyses.find(a => a.tokenId === token.id) || {};

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${token.id}</td>
            <td>${token.text}</td>
            <td>
            <select id="node1-${token.id}" onchange="updateAnalysis('${token.tokenId}', 'node1Id', this.value)">
                    <option value="">Select...</option>
                    <option value="0" ${analysis.node1Id === 0 ? 'selected' : ''}>0: Sentence Root</option>
                    ${tokens.filter(u => u.type === 'lexical' && u.id !== token.id && u.id !== 0)
                        .map(u => `<option value="${u.id}" ${analysis.node1Id === u.id ? 'selected' : ''}>${u.id}: ${u.text}</option>`)
                        .join('')}
                </select>
            </td>
            <td>
                <select id="node1-relation-${token.id}" onchange="updateAnalysis(${token.id}, 'node1Relation', this.value)">
                    <option value="">-- Select relation --</option>
                    ${RELATION_OPTIONS.map(rel => 
                        `<option value="${rel}" ${analysis.node1Relation === rel ? 'selected' : ''}>${rel}</option>`
                    ).join('')}
                </select>
            </td>
            <td>
                <select id="node2-${token.id}" onchange="updateAnalysis(${token.id}, 'node2Id', this.value)">
                    <option value="">Select...</option>
                    <option value="0" ${analysis.node2Id === 0 ? 'selected' : ''}>0: Sentence Root</option>
                    ${tokens.filter(u => u.type === 'lexical' && u.id !== token.id && u.id !== 0)
                        .map(u => `<option value="${u.id}" ${analysis.node2Id === u.id ? 'selected' : ''}>${u.id}: ${u.text}</option>`)
                        .join('')}
                </select>
            </td>
            <td>
                <select id="node2-relation-${token.id}" onchange="updateAnalysis(${token.id}, 'node2Relation', this.value)">
                    <option value="">-- Select relation --</option>
                    ${RELATION_OPTIONS.map(rel => 
                        `<option value="${rel}" ${analysis.node2Relation === rel ? 'selected' : ''}>${rel}</option>`
                    ).join('')}
                </select>
            </td>
        `;
        analysisTableBody.appendChild(row);
    });

    updateGraph();
    cite2UrnDisplay.textContent = cite2Urn;
}

// Update a single analysis entry
function updateAnalysis(tokenId, field, value) {
    let analysis = tokenAnalyses.find(a => a.tokenId === tokenId);
    if (!analysis) {
        analysis = { tokenId };
        tokenAnalyses.push(analysis);
    }

    if (field.includes('Id')) {
        analysis[field] = value === '' ? null : parseInt(value, 10);
    } else {
        analysis[field] = value === '' ? null : value;
    }

    // Clean up empty entries
    if (!analysis.node1Id && !analysis.node1Relation && !analysis.node2Id && !analysis.node2Relation) {
        tokenAnalyses = tokenAnalyses.filter(a => a.tokenId !== tokenId);
    }

    updateGraph();
}

// Graph visualization with vis.js
function updateGraph() {
    const activeTokenIds = new Set([0]);
    tokenAnalyses.forEach(analysis => {
        if (analysis.node1Id !== null && analysis.node1Relation) {
            activeTokenIds.add(analysis.tokenId);
            activeTokenIds.add(analysis.node1Id);
        }
        if (analysis.node2Id !== null && analysis.node2Relation) {
            activeTokenIds.add(analysis.tokenId);
            activeTokenIds.add(analysis.node2Id);
        }
    });

    const nodes = [{
        id: '0',
        label: '0: Sentence Root',
        color: '#fff9c4',
        font: { size: 14, bold: true }
    }].concat(
        tokens.filter(t => t.type === 'lexical' && activeTokenIds.has(t.id) && t.id !== 0)
            .map(t => ({
                id: t.id,
                label: `${t.id}: ${t.text}`,
                color: '#e6f0fa',
                font: { size: 12 }
            }))
    );

    const edges = [];
    tokenAnalyses.forEach(analysis => {
        if (analysis.node1Id !== null && analysis.node1Relation && activeTokenIds.has(analysis.tokenId)) {
            edges.push({
                from: analysis.tokenId,
                to: analysis.node1Id,
                label: analysis.node1Relation,
                arrows: 'to'
            });
        }
        if (analysis.node2Id !== null && analysis.node2Relation && activeTokenIds.has(analysis.tokenId)) {
            edges.push({
                from: analysis.tokenId,
                to: analysis.node2Id,
                label: analysis.node2Relation,
                arrows: 'to'
            });
        }
    });

    const data = {
        nodes: new vis.DataSet(nodes),
        edges: new vis.DataSet(edges)
    };

    const options = {
        layout: {
            hierarchical: {
                direction: 'UD',
                sortMethod: 'hubsize',
                levelSeparation: 150,
                nodeSpacing: 200
            }
        },
        nodes: { shape: 'box', color: { border: '#005ea2' } },
        edges: { font: { size: 10 }, arrows: { to: { enabled: true, scaleFactor: 0.5 } } },
        physics: { enabled: false }
    };

    if (graphNetwork) graphNetwork.destroy();
    graphNetwork = new vis.Network(graphContainer, data, options);
}

// Export to CEX
function exportCex() {
    let cex = '#!citelibrary\n';
    cex += `name#Ancient Greek Syntax Analysis\n`;
    cex += `urn#${cite2Urn}\n`;
    cex += `text#${ctsUrn}\n\n`;

    cex += '#!citedata\nsentence#text\n';
    cex += `${sentenceId}#${input.value.replace(/#/g, '\\#')}\n\n`;

    cex += '#!citedata\ntokenId#text#verbalUnitIds\n';
    tokens.filter(t => t.type === 'lexical').forEach(t => {
        const units = tokenAssignments.find(a => a.tokenId === t.id)?.verbalUnitIds.join(',') || '';
        cex += `${t.id}#${t.text.replace(/#/g, '\\#')}#${units}\n`;
    });
    cex += '\n';

    cex += '#!citedata\nunitId#syntacticType#semanticType#level\n';
    verbalUnits.forEach(u => {
        cex += `${u.id}#${u.syntacticType.replace(/#/g, '\\#')}#${u.semanticType.replace(/#/g, '\\#')}#${u.level}\n`;
    });
    cex += '\n';

    cex += '#!citerelations\nsource#target#relation\n';
    tokenAnalyses.forEach(a => {
        if (a.node1Id !== null && a.node1Relation) {
            cex += `${a.tokenId}#${a.node1Id}#${a.node1Relation.replace(/#/g, '\\#')}\n`;
        }
        if (a.node2Id !== null && a.node2Relation) {
            cex += `${a.tokenId}#${a.node2Id}#${a.node2Relation.replace(/#/g, '\\#')}\n`;
        }
    });

    const blob = new Blob([cex], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis_${sentenceId}.cex`;
    a.click();
    URL.revokeObjectURL(url);
}

// Import a CEX file of analysis and update the page to reflect
function importCex(fileContent) {
    const lines = fileContent.split('\n');
    let currentBlock = '';
    let sentenceData = {};
    let tokenData = [];
    let unitData = [];
    let relationData = [];

    lines.forEach(line => {
        line = line.trim();
        if (!line) return;

        // === Detect block headers (handles headers on next line) ===
        if (line.startsWith('#!citelibrary')) {
            currentBlock = 'citelibrary';
        } 
        else if (line.startsWith('#!citedata')) {
            currentBlock = 'awaitingHeader';
        } 
        else if (line === 'sentence#text') {
            currentBlock = 'sentence';
        } 
        else if (line === 'tokenId#text#verbalUnitIds') {
            currentBlock = 'tokens';
        } 
        else if (line === 'unitId#syntacticType#semanticType#level') {
            currentBlock = 'units';
        } 
        else if (line.startsWith('#!citerelations')) {
            currentBlock = 'relations';
        } 
        // === Parse actual data lines ===
        else if (!line.startsWith('#')) {
            const parts = line.split('#').map(p => p.replace(/\\#/g, '#'));

            if (currentBlock === 'citelibrary') {
                if (parts[0] === 'urn') cite2Urn = parts[1];
                if (parts[0] === 'text') ctsUrn = parts[1];
            } 
            else if (currentBlock === 'sentence' && parts.length >= 2) {
                sentenceData = { id: parts[0], text: parts[1] };
            } 
            else if (currentBlock === 'tokens' && parts.length >= 3) {
                tokenData.push({
                    id: parts[0], // was parseInt(parts[0])
                    text: parts[1],
                    verbalUnitIds: parts[2].split(',').filter(Boolean)
                });
            } 
            else if (currentBlock === 'units' && parts.length >= 4) {
                unitData.push({
                    id: parts[0],
                    syntacticType: parts[1],
                    semanticType: parts[2],
                    level: parseInt(parts[3])
                });
            } 
            else if (currentBlock === 'relations' && parts.length >= 3) {
                relationData.push({
                    source: parts[0], // was parseInt
                    target: parts[1], // was parseInt
                    relation: parts[2]
                });
            }
        }
    });

    // === Restore application state ===
    sentenceId = sentenceData.id || generateUUID();
    input.value = sentenceData.text || defaultSentence;
    tokens = tokenize(input.value);
    verbalUnits = unitData;
    verbalUnitIdCounter = Math.max(1, ...verbalUnits.map(u => parseInt(u.id.replace('VU', '')) || 0)) + 1;

    tokenAssignments = tokenData
        .filter(t => tokens.some(tok => tok.id === t.id))
        .map(t => ({
            tokenId: t.id,
            verbalUnitIds: t.verbalUnitIds.filter(id => verbalUnits.some(u => u.id === id))
        }));

    tokenAnalyses = [];
    relationData.forEach(r => {
        let analysis = tokenAnalyses.find(a => a.tokenId === r.source);
        if (!analysis) {
            analysis = { tokenId: r.source };
            tokenAnalyses.push(analysis);
        }
        if (!analysis.node1Id) {
            analysis.node1Id = r.target;
            analysis.node1Relation = r.relation;
        } else if (!analysis.node2Id) {
            analysis.node2Id = r.target;
            analysis.node2Relation = r.relation;
        }
    });

    // === Refresh the entire UI ===
    if (stage1Section) stage1Section.style.display = 'block';
    if (stage2Section) stage2Section.style.display = 'block';
    // if (stage3Section) stage2Section.style.display = 'block';

    updateTokenDisplay();
    updateVerbalUnitTable();
    updateVerbalUnitSelect();
    // Staged reveal: hide later stages initially
    if (stage2Section) stage2Section.style.display = 'none';
    // if (stage3Section) stage3Section.style.display = 'none';

    if (verbalUnits.length > 0 && !verbalUnitSelect.value) {
        verbalUnitSelect.value = verbalUnits[0].id;
    }

    updateAssignmentDisplay();
    updateAnalysisTable();
}

// Button listeners
exportCexBtn1.addEventListener('click', exportCex);
exportCexBtn2.addEventListener('click', exportCex);
importCexBtn.addEventListener('click', () => importCexInput.click());
importCexInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => importCex(event.target.result);
        reader.readAsText(file);
        e.target.value = '';
    }
});

// === Load Sentence UI wiring ===
const collectionSelect = document.getElementById('collection-select');
const sentenceSelect = document.getElementById('sentence-select');
const loadBtn = document.getElementById('load-sentence-btn');

async function populateCollections() {
    collectionSelect.innerHTML = '<option value="">-- Select a collection --</option>';
    try {
        const collections = [];
        await Promise.all(sentenceTsvFiles.map(async (file) => {
            try {
                const resp = await fetch(`sentences/${file}`);
                const txt = await resp.text();
                const firstLine = txt.split('\n')[0].trim().replace(/^\/\//, '').trim();
                collections.push({ display: firstLine || file, tsvFile: file });
            } catch (e) {
                console.warn(`Could not load label for ${file}`, e);
            }
        }));
        collections.sort((a, b) => a.display.localeCompare(b.display));
        collections.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.tsvFile;
            opt.textContent = c.display;
            collectionSelect.appendChild(opt);
        });
    } catch (e) {
        console.error('Failed to populate collections', e);
    }
}

collectionSelect.addEventListener('change', async () => {
    sentenceSelect.innerHTML = '<option value="">-- Select sentence --</option>';
    sentenceSelect.disabled = true;
    loadBtn.disabled = true;
    currentSentencesData = [];

    if (!collectionSelect.value) return;

    try {
        currentSentencesData = await fetchAndParseTsv(`sentences/${collectionSelect.value}`);
        currentSentencesData.forEach((s, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = s.label;
            sentenceSelect.appendChild(opt);
        });
        sentenceSelect.disabled = false;
    } catch (e) {
        console.error(e);
        alert('Failed to load sentence list. Check console.');
    }
});

sentenceSelect.addEventListener('change', () => {
    loadBtn.disabled = !sentenceSelect.value;
});

loadBtn.addEventListener('click', async () => {
    if (!sentenceSelect.value) return;
    const idx = parseInt(sentenceSelect.value);
    const sentenceInfo = currentSentencesData[idx];
    if (!sentenceInfo) return;

    try {
        const { fromUrn, toUrn, fullRange } = parseCtsRangeUrn(sentenceInfo.sentenceUrn);
        const loadedTokens = await loadTokensFromCex(sentenceInfo.textPath, fromUrn, toUrn);

        resetAnalysisState();
        tokens = loadedTokens;
        ctsUrn = fullRange;
        ctsUrnDisplay.textContent = ctsUrn;

        // Optional: rough reconstruction of sentence text for the export block
        input.value = tokens
            .filter(t => t.id !== 0)
            .map(t => t.text)
            .join(' ');

        updateTokenDisplay();
        updateVerbalUnitForm();
        updateVerbalUnitTable();
        updateVerbalUnitSelect();
        updateAssignmentDisplay();
        updateAnalysisTable();

        // Show stage 1, hide stage 2 until user clicks Done
        if (stage1Section) stage1Section.style.display = 'block';
        if (stage2Section) stage2Section.style.display = 'none';

        // Scroll to tokens
        document.getElementById('token-output').scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
        console.error(e);
        alert('Failed to load sentence tokens: ' + e.message);
    }
});

// Initialize collections on page load
populateCollections();

// Initial load
tokens = tokenize(defaultSentence);
updateTokenDisplay();
updateVerbalUnitForm();
updateVerbalUnitTable();
updateVerbalUnitSelect();
updateAssignmentDisplay();
updateAnalysisTable();

// Staged reveal: hide later stages initially
if (stage2Section) stage2Section.style.display = 'none';
// if (stage3Section) stage3Section.style.display = 'none';