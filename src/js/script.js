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

function exitImportReviewMode() {
    if (justImported) {
        justImported = false;
        updateAssignmentDisplay(); // refresh with normal editing behavior
    }
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
        if (!line || line.startsWith('//') || line.startsWith('label')) continue;
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

    const loadedTokens = [createTokenObject(null, "ROOT", 0, true)];

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


// List of all sentence TSV files (add new ones here when you add more .tsv files)
const sentenceTsvFiles = [
    "Ellipsis_sentences.tsv",
    "Frogs_sentences.tsv",
    ...Array.from({ length: 20 }, (_, i) => `Hansen_Quinn_Sentences_${String(i + 1).padStart(2, '0')}.tsv`),
    "Herodotus_sentences.tsv",
    "Iliad_sentences.tsv"
];


// Initialize DOM elements
const input = document.getElementById('sentence-input');

const editor_field1 =  document.getElementById("editor-name1");
const editor_field2 = document.getElementById("editor-name2");

const ctsUrnDisplay = document.getElementById('cts-urn');
const cite2UrnDisplay = document.getElementById('cite2-urn');
const tokenOutput = document.getElementById('token-output');
const stage1Section = document.getElementById('stage1-section');
const stage2Section = document.getElementById('stage2-section');
const stage3Section = document.getElementById('stage3-section');
const stage4Section = document.getElementById('stage4-section');
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

// URN and text to represent ellipsis
const ellipsisUrnBase = "urn:cite2:fuTeaching:syntax.ellipsis:"
const ellipsisTokenText = "{ … }"

let currentSentencesData = []; // populated when a collection is chosen

const date = new Date().toISOString().split("T")[0];

// input-area


// State management
let tokens = [];
let verbalUnits = [];
let verbalUnitIdCounter = 1;
let sentenceId = generateUUID();
let editingUnitId = null;
let tokenAssignments = []; // { tokenId: number, verbalUnitIds: string[] }
let tokenAnalyses = []; // { tokenId: number, node1Id: number|null, node1Relation: string, node2Id: number|null, node2Relation: string }
let justImported = false;   // ← new flag
let graphNetwork = null;
let ctsUrn = 'urn:cts:greekLit:demos.ad_hoc.default:0';
let cite2Urn = `urn:cite2:analyzer:analysis:${date}-${sentenceId}`;

// Allowed syntactic relations (used for dropdowns)
const RELATION_OPTIONS = [
    "Unit Verb",
    "Unit Infinitive",
    "Unit Participle",
    "-",
    "Subject",
    "Relative Pronoun",
    "Apostrophe",
    "-",
    "Direct Object",
    "Predicative",
    "-",
    "Article",
    "Attribute",
    "Adverbial",
    "Appositive",
    "-",
    "Correlated",
    "-",
    "Auxiliary Infinitive",
    "-",
    "Preposition",
    "Object of Prep.",
    "-",
    "Sentence Adverbial",
    "Unit Adverbial",
    "Conjunction",
    "-",
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
    const result = [createTokenObject(null, "ROOT", 0, true)];

    let displayEnum = 1;
    let currentToken = '';

    for (let i = 0; i < sentence.length; i++) {
        const char = sentence[i];

        if (/\s/.test(char)) {
            if (currentToken) {
                result.push(createTokenObjectForPlainText(currentToken, displayEnum));
                displayEnum++;
                currentToken = '';
            }
            result.push({
                text: char,
                type: 'white-space',
                tokenId: null,
                displayId: null
            });
        } else if (PUNCTUATION.includes(char)) {
            if (currentToken) {
                result.push(createTokenObjectForPlainText(currentToken, displayEnum));
                displayEnum++;
                currentToken = '';
            }
            result.push(createTokenObjectForPlainText(char, displayEnum)); // will set displayId = null inside helper
        } else {
            currentToken += char;
        }
    }

    if (currentToken) {
        result.push(createTokenObjectForPlainText(currentToken, displayEnum));
    }

    return result;
}

// Helper for plain-text mode (no real CTS URN)
function createTokenObjectForPlainText(text, displayNum) {
    const cleanTxt = text.trim();
    const isPunct = PUNCTUATION.includes(cleanTxt);
    return {
        text: cleanTxt,
        type: isPunct ? 'punctuation' : 'lexical',
        tokenId: isPunct ? null : displayNum.toString(),   // use display number as stable string ID
        displayId: isPunct ? null : displayNum
    };
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
            const assignment = tokenAssignments.find(a => a.tokenId === token.tokenId);
            if (assignment && assignment.verbalUnitIds.length > 0) {
                const vuIndex = verbalUnits.findIndex(u => u.id === assignment.verbalUnitIds[0]);
                if (vuIndex !== -1) {
                    span.classList.add(`assigned-vu${Math.min(vuIndex + 1, 5)}`);
                }
            }

            // Click to toggle assignment for currently selected verbal unit
            span.addEventListener('click', () => {
                toggleTokenAssignment(token.tokenId);
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
    exitImportReviewMode();
    updateAssignmentDisplay();
});

// Staged reveal handlers 1
const doneStage1 = document.getElementById('done-stage1');
if (doneStage1 && stage2Section) {
    doneStage1.addEventListener('click', () => {
        stage2Section.style.display = 'block';
        stage2Section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        recenterGraph();
        //Optional: collapse/hide stage1 after proceeding
        //stage1Section.style.display = 'none';
    });
}

// Staged reveal handlers 2
const doneStage2 = document.getElementById('done-stage2');
if (doneStage2 && stage3Section) {
    doneStage2.addEventListener('click', () => {
        stage3Section.style.display = 'block';
        stage3Section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        recenterGraph();
        //Optional: collapse/hide stage2 after proceeding
        //stage2Section.style.display = 'none';
    });
}


// Staged reveal handlers 3
const doneStage3 = document.getElementById('done-stage3');
if (doneStage3 && stage4Section) {
    doneStage3.addEventListener('click', () => {
        stage4Section.style.display = 'block';
        stage4Section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        recenterGraph();
        //Optional: collapse/hide stage2 after proceeding
        //stage2Section.style.display = 'none';
    });
}




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
    verbalUnitSelect.addEventListener('change', () => {
        exitImportReviewMode();
        updateAssignmentDisplay();
    });
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

// Create a token representing ellipsis
function createEllipsisToken() {
    const numberOfTokens = tokens.length;
    const newTokenId = numberOfTokens + 1;
    const newEllipsisTokenUrn = ellipsisUrnBase + newTokenId;
    tokens.push({
        text: ellipsisTokenText,
        type: 'lexical',
        tokenId: newEllipsisTokenUrn,           // preserves numeric IDs or full CTS URNs
        displayId: newTokenId
    })
    updateAssignmentDisplay();
    updateAnalysisTable();
}

// Update token assignment display (with unassigned tokens)
function updateAssignmentDisplay() {
    assignmentDisplay.innerHTML = '';
    const selectedUnitId = verbalUnitSelect.value;

    verbalUnits.forEach(unit => {
        const assignedTokens = tokenAssignments
            .filter(a => a.verbalUnitIds.includes(unit.id))
            .map(a => tokens.find(t => t.tokenId === a.tokenId))
            .filter(Boolean)
            .sort((a, b) => a.tokenId - b.tokenId);

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
                span.addEventListener('click', () => toggleTokenAssignment(token.tokenId));
            }
            tokensContainer.appendChild(span);
        });

        assignmentDisplay.appendChild(row);
    });

    // Unassigned tokens section for the currently selected unit
    if (selectedUnitId) {
        let unassigned;

        if (justImported) {
            // === Post-import "review" mode ===
            // Only show tokens that have ZERO assignments at all
            unassigned = tokens.filter(t =>
                t.type === 'lexical' &&
                t.tokenId !== "root" &&
                !tokenAssignments.some(a => a.tokenId === t.tokenId && a.verbalUnitIds.length > 0)
            );
        } else {
            // === Normal editing mode ===
            // Show tokens not yet assigned to THIS specific Verbal Unit
            // (tokens assigned to other VUs still appear with special styling)
            unassigned = tokens.filter(t =>
                t.type === 'lexical' &&
                t.tokenId !== "root" &&
                !tokenAssignments.some(a => 
                    a.tokenId === t.tokenId && 
                    a.verbalUnitIds.includes(selectedUnitId)
                )
            );
        }

        if (unassigned.length > 0) {
            const unassignedDiv = document.createElement('div');
            unassignedDiv.id = 'unassigned-tokens';
            unassignedDiv.innerHTML = `
                <div class="unit-info">Unassigned Tokens (click to assign):</div>
                <div class="tokens"></div><button id="ellipsisBtn" onclick="createEllipsisToken()">Create Ellipsis Token</button>
            `;
            const container = unassignedDiv.querySelector('.tokens');

            unassigned.forEach(token => {
                const span = document.createElement('span');
                span.className = 'token-lexical';

                const assignment = tokenAssignments.find(a => a.tokenId === token.tokenId);
                const isAssignedElsewhere = assignment && assignment.verbalUnitIds.length > 0;

                if (isAssignedElsewhere && !justImported) {
                    span.classList.add('has-other-assignments');
                    const otherVUs = assignment.verbalUnitIds.join(', ');
                    span.title = `Already assigned to: ${otherVUs} (still assignable here)`;
                }

                span.innerHTML = `${token.text}<sup class="token-id">${token.displayId}</sup>`;
                span.dataset.tokenId = token.tokenId;
                span.addEventListener('click', () => toggleTokenAssignment(token.tokenId));
                container.appendChild(span);
            });

            assignmentDisplay.appendChild(unassignedDiv);
        }
    }
}

function updateAnalysisTable() {
    analysisTableBody.innerHTML = '';

    // Root row (static)
    const rootRow = document.createElement('tr');
    rootRow.innerHTML = `
        <td>0</td>
        <td>ROOT</td>
        <td><select disabled><option value="">N/A</option></select></td>
        <td><select disabled><option value="">N/A</option></select></td>
        <td><select disabled><option value="">N/A</option></select></td>
        <td><select disabled><option value="">N/A</option></select></td>
    `;
    analysisTableBody.appendChild(rootRow);

    tokens
        .filter(t => t.type === 'lexical' && t.tokenId !== "root")
        .forEach(token => {
            const analysis = tokenAnalyses.find(a => a.tokenId === token.tokenId) || {};

            // For styling selected elements
            selectedClassNameN1Id = analysis.node1Id != undefined ? 'analysis-selected' : '';
            selectedClassNameN2Id = analysis.node2Id ? 'analysis-selected' : '';
            selectedClassNameN1Rel = analysis.node1Relation ? 'analysis-selected' : '';
            selectedClassNameN2Rel = analysis.node2Relation ? 'analysis-selected' : '';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${token.displayId}</td>
                <td>${token.text}</td>
                <td>
                    <select id="node1-${token.tokenId}"
                            class="${selectedClassNameN1Id}" 
                            onchange="updateAnalysis('${token.tokenId}', 'node1Id', this.value, this)">
                        <option value="">Select...</option>
                        <option value="root" ${analysis.node1Id === "root" || analysis.node1Id === "root" ? 'selected' : ''}>
                            0: ROOT
                        </option>
                        ${tokens
                            .filter(u => u.type === 'lexical' && 
                                         u.tokenId !== token.tokenId && 
                                         u.tokenId !== "root")
                            .map(u => `<option value="${u.tokenId}" 
                                ${analysis.node1Id === u.tokenId ? 'selected' : ''}>
                                ${u.displayId}: ${u.text}
                            </option>`)
                            .join('')}
                    </select>
                </td>
                <td>
                    <select id="node1-relation-${token.tokenId}" 
                            class="${selectedClassNameN1Rel}" 
                            onchange="updateAnalysis('${token.tokenId}', 'node1Relation', this.value, this)">
                        <option value="">Select…</option>
                        ${RELATION_OPTIONS.map(rel => {
                            if (rel == "-") {
                                return `<hr>`
                            } else {
                                return `<option value="${rel}" ${analysis.node1Relation === rel ? 'selected' : ''}>${rel}</option>`
                            }
                        }).join('')}
                    </select>
                </td>
                <td>
                    <select id="node2-${token.tokenId}" 
                            class="${selectedClassNameN2Id}" 
                            onchange="updateAnalysis('${token.tokenId}', 'node2Id', this.value, this)">
                        <option value="">Select...</option>
                        <option value="root" ${analysis.node2Id === "root" || analysis.node2Id === "root" ? 'selected' : ''}>
                            0: ROOT
                        </option>
                        ${tokens
                            .filter(u => u.type === 'lexical' && 
                                         u.tokenId !== token.tokenId && 
                                         u.tokenId !== "root")
                            .map(u => `<option value="${u.tokenId}" 
                                ${analysis.node2Id === u.tokenId ? 'selected' : ''}>
                                ${u.displayId}: ${u.text}     <!-- FIXED: was u.tokenId -->
                            </option>`)
                            .join('')}
                    </select>
                </td>
                <td>
                    <select id="node2-relation-${token.tokenId}" 
                            class="${selectedClassNameN2Rel}" 
                            onchange="updateAnalysis('${token.tokenId}', 'node2Relation', this.value, this)">
                        <option value="">-- Select relation --</option>
                         ${RELATION_OPTIONS.map(rel => {
                            if (rel == "-") {
                                return `<hr>`
                            } else {
                                return `<option value="${rel}" ${analysis.node2Relation === rel ? 'selected' : ''}>${rel}</option>`
                            }
                        }).join('')}
                    </select>
                </td>
                 <td>
                    <button onclick="resetTokenAnalysis('${token.tokenId}')" 
                            title="Reset this token's four menus to default"
                            style="font-size: 1.1em; padding: 2px 6px; cursor: pointer;">
                        ↺
                    </button>
                </td>
            `;
            analysisTableBody.appendChild(row);
        });

    updateGraph();
    recenterGraph();
    // cite2UrnDisplay... (keep your existing line)
}

function updateAnalysis(tokenId, field, value, selectElement) {
    if (value == '') {
        selectElement.classList.remove("analysis-selected");
    } else {
        selectElement.classList.add("analysis-selected");
    }

    let analysis = tokenAnalyses.find(a => a.tokenId === tokenId);
    if (!analysis) {
        analysis = { tokenId };
        tokenAnalyses.push(analysis);
    }

    if (field.includes('Id')) {
        if (value === '' || value == null) {
            analysis[field] = null;
        } else if (value === "root" || value === "0") {
            analysis[field] = "root";           // consistent string
        } else {
            analysis[field] = value;            // keep full CTS URN string
        }
    } else {
        analysis[field] = value === '' ? null : value;
    }

    // Clean up empty analyses
    if (!analysis.node1Id && !analysis.node1Relation &&
        !analysis.node2Id && !analysis.node2Relation) {
        tokenAnalyses = tokenAnalyses.filter(a => a.tokenId !== tokenId);
    }

    updateGraph();
}

function updateGraph() {
    const activeTokenIds = new Set(["root"]);

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
        id: 'root',
        label: '0: ROOT',
        color: '#fff9c4',
        font: { size: 14, bold: true }
    }].concat(
        tokens
            .filter(t => t.type === 'lexical' && 
                         activeTokenIds.has(t.tokenId) && 
                         t.tokenId !== "root")
            .map(t => ({
                id: t.tokenId,                              // internal ID (for edges)
                label: `${t.displayId}: ${t.text}`,         // UI label (FIXED)
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
                direction: 'UD',        // ← Try this first (Down-Up)
                sortMethod: 'hubsize',
                levelSeparation: 120,
                nodeSpacing: 100
            }
        },
        nodes: { 
            shape: 'box', 
            color: { border: '#005ea2' } 
        },
        edges: { 
            physics: true,
            font: { size: 10 },
            arrows: { to: { enabled: true, scaleFactor: 0.5 } },
            smooth: { type: "continuous", roundness: 0.18 },
            scaling: {
                label: { enabled: true, min: 10, max: 18 }
            }
        },
        physics: { enabled: true },
        interaction: {
            zoomView: true,
            zoomSpeed: 0.45,           // ← Lower = less brisk (try 0.3–0.6)
            navigationButtons: true,   // Adds built-in zoom +/- and pan controls
            // keyboard: { enabled: true } // optional extra
        }
    };

    if (graphNetwork) graphNetwork.destroy();
    graphNetwork = new vis.Network(graphContainer, data, options);
}

function recenterGraph() {
    if (graphNetwork) {
        graphNetwork.fit({
            animation: { duration: 400, easingFunction: "easeInOutQuad" }
        });
    }
}

// ==================== GRAPH FULLSCREEN ====================

function toggleGraphFullscreen() {
    const container = document.getElementById('graph-container');
    if (!container) return;

    if (!document.fullscreenElement) {
        // Enter fullscreen
        container.requestFullscreen()
            .then(() => {
                refreshGraphAfterResize();
            })
            .catch(err => {
                console.warn("Could not enter fullscreen:", err);
                // Fallback (rarely needed)
                makeGraphFullWindowCSS(container);
            });
    } else {
        // Exit fullscreen
        document.exitFullscreen();
    }
}

// Helper: refresh vis-network after container size changes
function refreshGraphAfterResize() {
    if (!graphNetwork) return;
    
    setTimeout(() => {
        graphNetwork.redraw();
        graphNetwork.fit({ animation: { duration: 300 } });
    }, 120);
}

// Optional CSS fallback (used only if requestFullscreen fails)
function makeGraphFullWindowCSS(container) {
    container.classList.add('graph-fullwindow');
    refreshGraphAfterResize();

    // Add temporary close button overlay if needed
    let closeBtn = document.getElementById('graph-fullwindow-close');
    if (!closeBtn) {
        closeBtn = document.createElement('button');
        closeBtn.id = 'graph-fullwindow-close';
        closeBtn.textContent = '✕ Close Full Window';
        closeBtn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:10000;padding:8px 16px;';
        closeBtn.onclick = () => exitGraphFullWindowCSS(container);
        document.body.appendChild(closeBtn);
    }
}

function exitGraphFullWindowCSS(container) {
    container.classList.remove('graph-fullwindow');
    const closeBtn = document.getElementById('graph-fullwindow-close');
    if (closeBtn) closeBtn.remove();
    refreshGraphAfterResize();
}

// Listen for native fullscreen changes (including ESC key)
document.addEventListener('fullscreenchange', () => {
    const btn = document.getElementById('fullscreen-btn');
    if (!btn) return;

    if (document.fullscreenElement) {
        btn.textContent = '⛶ Exit Fullscreen';
        btn.title = 'Return to normal view';
        refreshGraphAfterResize();
    } else {
        btn.textContent = '⛶ Fullscreen';
        btn.title = 'Toggle fullscreen view of the graph';
        refreshGraphAfterResize();
    }
});

// Export to CEX
function exportCex() {

    let editorName = editor_field1.value.replace(" ", "_")

    let cex = '#!citelibrary\n';
    cex += `name#Ancient Greek Syntax Analysis\n`;
    cex += `urn#${cite2Urn}\n`;
    cex += `text#${ctsUrn}\n`;
    cex += `editor#${editorName}\n`;
    cex += `date#${date}\n\n`;

    cex += '#!citedata\nsentence#ctsurn#text\n';
    cex += `${cite2Urn}#${ctsUrn}#${input.value.replace(/#/g, '\\#')}\n\n`;

    cex += '#!citedata\ntokenId#text#verbalUnitIds\n';
    tokens.filter(t => t.type === 'lexical').forEach(t => {
        const units = tokenAssignments.find(a => a.tokenId === t.tokenId)?.verbalUnitIds.join(',') || '';
        cex += `${t.tokenId}#${t.text.replace(/#/g, '\\#')}#${units}\n`;
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
    a.download = `analysis_${editorName}_${sentenceId}.cex`;
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
        else if (line === 'sentence#ctsurn#text') {
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
                sentenceData = { id: parts[0], ctsurn: parts[1], text: parts[2] };
            } 
            else if (currentBlock === 'tokens' && parts.length >= 3) {
                const tokenEntry = {
                    id: parts[0],
                    text: parts[1],
                    verbalUnitIds: parts[2] ? parts[2].split(',').filter(Boolean) : []
                };
                // Future-proof: read optional 4th column as displayId
                if (parts.length >= 4 && parts[3]) {
                    const parsed = parseInt(parts[3], 10);
                    if (!isNaN(parsed)) tokenEntry.displayId = parsed;
                }
                tokenData.push(tokenEntry);
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

    // === Rebuild tokens from CEX data (safe + future-proof) ===
    tokens = [];
    const seenTokenIds = new Set();
    let displayEnum = 1;

    tokenData.forEach(t => {
        if (!t.id || seenTokenIds.has(t.id)) return; // skip duplicates or empty
        seenTokenIds.add(t.id);

        if (t.id === "root") {
            tokens.unshift(createTokenObject(null, "ROOT", 0, true)); // ensure root is first
        } else {
            const cleanText = (t.text || "").trim();
            if (!cleanText) return;

            const isPunct = PUNCTUATION.includes(cleanText);

            // Future-proof: use explicit displayId from CEX if present, otherwise sequential
            let dispId = null;
            if (typeof t.displayId === 'number' && !isNaN(t.displayId)) {
                dispId = t.displayId;
            } else if (!isPunct) {
                dispId = displayEnum++;
            }

            tokens.push({
                text: cleanText,
                type: isPunct ? 'punctuation' : 'lexical',
                tokenId: t.id,           // preserves numeric IDs or full CTS URNs
                displayId: dispId
            });
        }
    });

    // If root wasn't in the CEX for some reason, add it at the beginning
    if (!tokens.some(t => t.tokenId === "root")) {
        tokens.unshift(createTokenObject(null, "ROOT", 0, true));
    }

    verbalUnits = unitData;
    verbalUnitIdCounter = Math.max(1, ...verbalUnits.map(u => parseInt(u.id.replace('VU', '')) || 0)) + 1;

    tokenAssignments = tokenData
    .filter(t => tokens.some(tok => tok.tokenId === t.id))   // ← changed to t.id
    .map(t => ({
        tokenId: t.id,                                       // ← changed to t.id
        verbalUnitIds: t.verbalUnitIds.filter(id => verbalUnits.some(u => u.id === id))
    }));

    tokenAnalyses = [];
    relationData.forEach(r => {
        if (!r.source || !r.target) return; // safety: skip malformed relations

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
    if (stage3Section) stage3Section.style.display = 'block';
    if (stage4Section) stage4Section.style.display = 'block';
    // if (stage3Section) stage4Section.style.display = 'block';


    justImported = true;
    updateTokenDisplay();
    updateVerbalUnitTable();
    updateVerbalUnitSelect();
    // Staged reveal: hide later stages initially
    if (stage4Section) stage4Section.style.display = 'block';
    // if (stage3Section) stage3Section.style.display = 'none';

    if (verbalUnits.length > 0 && !verbalUnitSelect.value) {
        verbalUnitSelect.value = verbalUnits[0].id;
    }

    updateAssignmentDisplay();
    updateAnalysisTable();
    stage2Section.scrollIntoView({ behavior: 'smooth', block: 'start' });

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
            .filter(t => t.tokenId !== "root")
            .map(t => t.text)
            .join(' ');

        updateTokenDisplay();
        updateVerbalUnitForm();
        updateVerbalUnitTable();
        updateVerbalUnitSelect();
        updateAssignmentDisplay();
        updateAnalysisTable();

        // Show stage 2, hide stage 2 until user clicks Done
        if (stage1Section) stage1Section.style.display = 'block';
        if (stage2Section) stage2Section.style.display = 'block';
        if (stage3Section) stage3Section.style.display = 'block';
        if (stage4Section) stage4Section.style.display = 'block';

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

function textAreaChange() {
    tokens = tokenize(input.value);
    resetAnalysisState();
    updateTokenDisplay();
    updateVerbalUnitForm();
    updateVerbalUnitTable();
    updateVerbalUnitSelect();
    updateAssignmentDisplay();
    updateAnalysisTable();

}

// Synchronize both editor-name-fields
function editor1Changed(val) {
    const e1value = editor_field1.value;
    const e2value = editor_field2.value;
    if (e2value != e1value) {
        editor_field2.value = e1value;
    }
}

function editor2Changed(val) {
    const e1value = editor_field1.value;
    const e2value = editor_field2.value;
    if (e2value != e1value) {
        editor_field1.value = e2value;
    }
}

function resetTokenAnalysis(tokenId) {
    tokenAnalyses = tokenAnalyses.filter(a => a.tokenId !== tokenId);
    updateAnalysisTable();
}

function resetSyntacticStage() {
    if (!confirm("Reset all syntactic relationship analyses for this sentence?")) return;
    tokenAnalyses = [];
    updateAnalysisTable();   // this also calls updateGraph()
}

// Staged reveal: hide later stages initially
if (stage2Section) stage2Section.style.display = 'none';
if (stage3Section) stage3Section.style.display = 'none';
if (stage4Section) stage4Section.style.display = 'none';

//Let's start the graph centered!
recenterGraph();
