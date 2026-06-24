// Generate a simple UUID for sentence ID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
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
const exportCexBtn = document.getElementById('export-cex');
const importCexBtn = document.getElementById('import-cex-btn');
const importCexInput = document.getElementById('import-cex');

// State management
let tokens = [];
let verbalUnits = [];
let verbalUnitIdCounter = 1;
let sentenceId = generateUUID();
let editingUnitId = null;
let tokenAssignments = []; // { tokenId: number, verbalUnitIds: string[] }
let tokenAnalyses = []; // { tokenId: number, node1Id: number, node1Relation: string, node2Id: number, node2Relation: string }
let graphNetwork = null;
let ctsUrn = 'urn:cts:greekLit:tlg0054.tlg001.perseus-grc1:1.1.1';
let cite2Urn = `urn:cite2:analyzer:analysis:2025-06-13-${sentenceId}`;

// Default sentence from Homer
const defaultSentence = "μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος οὐλομένην, ἣ μυρί' Ἀχαιοῖς ἄλγε' ἔθηκε."
// Longer default sentence from Homer
//const defaultSentence = "μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος οὐλομένην, ἣ μυρί' Ἀχαιοῖς ἄλγε' ἔθηκε, πολλὰς δ' ἰφθίμους ψυχὰς Ἄϊδι προΐαψεν ἡρώων, αὐτοὺς δὲ ἑλώρια τεῦχε κύνεσσιν οἰωνοῖσί τε πᾶσι, Διὸς δ' ἐτελείετο βουλή, ἐξ οὗ δὴ τὰ πρῶτα διαστήτην ἐρίσαντε Ἀτρεΐδης τε ἄναξ ἀνδρῶν καὶ δῖος Ἀχιλλεύς."
// Default sentence from Lysias
//const defaultSentence = "περὶ τούτου γὰρ μόνου τοῦ ἀδικήματος καὶ ἐν δημοκρατίᾳ καὶ ὀλιγαρχίᾳ ἡ αὐτὴ τιμωρία τοῖς ἀσθενεστάτοις πρὸς τοὺς τὰ μέγιστα δυναμένους ἀποδέδοται, ὥστε τὸν χείριστον τῶν αὐτῶν τυγχάνειν τῷ βελτίστῳ";
input.value = defaultSentence;

// Tokenize the input sentence, adding Token 0 (Sentence Root)
function tokenize(sentence) {
    const tokens = [{ text: "Sentence Root", type: 'lexical', id: 0 }]; // Add Token 0
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

// Update inline token display for Stage 1 (exclude Token 0)
function updateTokenDisplay() {
    tokenOutput.innerHTML = '';
    tokens.forEach((token, index) => {
        if (token.id === 0) return; // Skip Token 0
        const span = document.createElement('span');
        if (token.type === 'lexical') {
            span.className = 'token-lexical';
            span.innerHTML = `${token.text}<sup class="token-id">${token.id}</sup>`;
            span.dataset.index = index;
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
        unitId = editingUnitId;
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
    updateTokenDisplay();
    updateVerbalUnitSelect();
    updateAssignmentDisplay();
}

// Update verbal unit table
function updateVerbalUnitTable() {
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
    verbalUnitSelect.innerHTML = verbalUnits.length === 0 ? '<option value="">No verbal units defined</option>' : '';
    verbalUnits.forEach(unit => {
        const option = document.createElement('option');
        option.value = unit.id;
        option.textContent = `${unit.id} (${unit.syntacticType})`;
        verbalUnitSelect.appendChild(option);
    });
    // Reattach change event listener (Fixed CEX import bug)
    verbalUnitSelect.removeEventListener('change', updateAssignmentDisplay);
    verbalUnitSelect.addEventListener('change', updateAssignmentDisplay);
    // Select first unit if available
    if (verbalUnits.length > 0 && !verbalUnitSelect.value) {
        verbalUnitSelect.value = verbalUnits[0].id;
        updateAssignmentDisplay();
    }
}

// Toggle token assignment
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
    updateAssignmentDisplay();
}

// Update token assignment display
function updateAssignmentDisplay() {
    assignmentDisplay.innerHTML = '';
    const selectedUnitId = verbalUnitSelect.value;

    const unitDisplayData = verbalUnits.map(unit => {
        const assignedTokens = tokenAssignments
            .filter(a => a.verbalUnitIds.includes(unit.id))
            .map(a => tokens.find(t => t.id === a.tokenId))
            .filter(t => t)
            .sort((a, b) => a.id - b.id);
        const firstTokenId = assignedTokens.length > 0 ? assignedTokens[0].id : Infinity;
        return { unit, assignedTokens, firstTokenId };
    }).sort((a, b) => a.firstTokenId - b.firstTokenId);

    unitDisplayData.forEach(({ unit, assignedTokens }) => {
        if (assignedTokens.length > 0) {
            const row = document.createElement('div');
            row.className = `verbal-unit-row level-${unit.level}`;
            row.innerHTML = `
                <div class="unit-info">${unit.id} (${unit.syntacticType}, ${unit.semanticType}, Level ${unit.level})</div>
                <div class="tokens"></div>
            `;
            const tokensContainer = row.querySelector('.tokens');
            assignedTokens.forEach(token => {
                const span = document.createElement('span');
                const vuIndex = verbalUnits.findIndex(u => u.id === unit.id);
                const isCurrentUnit = unit.id === selectedUnitId;
                span.className = `token-lexical assigned-vu${Math.min(vuIndex + 1, 5)}${isCurrentUnit ? ' current-unit' : ''}`;
                span.innerHTML = `${token.text}<sup class="token-id">${token.id}</sup>`;
                span.dataset.tokenId = token.id;
                if (isCurrentUnit) {
                    span.addEventListener('click', () => toggleTokenAssignment(token.id));
                }
                tokensContainer.appendChild(span);
            });
            assignmentDisplay.appendChild(row);
        }
    });

    if (selectedUnitId) {
        const unassignedTokens = tokens.filter(t => 
            t.type === 'lexical' && t.id !== 0 && 
            !tokenAssignments.some(a => a.tokenId === t.id && a.verbalUnitIds.includes(selectedUnitId))
        );
        const unassignedDiv = document.createElement('div');
        unassignedDiv.id = 'unassigned-tokens';
        unassignedDiv.innerHTML = '<div class="unit-info">Unassigned Tokens:</div><div class="tokens"></div>';
        const tokensContainer = unassignedDiv.querySelector('.tokens');
        unassignedTokens.forEach(token => {
            const span = document.createElement('span');
            span.className = 'token-lexical';
            span.innerHTML = `${token.text}<sup class="token-id">${token.id}</sup>`;
            span.dataset.tokenId = token.id;
            span.addEventListener('click', () => toggleTokenAssignment(token.id));
            tokensContainer.appendChild(span);
        });
        assignmentDisplay.appendChild(unassignedDiv);
    }
}

// Update analysis table
function updateAnalysisTable() {
    analysisTableBody.innerHTML = '';
    // Add Sentence Root row
    const rootRow = document.createElement('tr');
    rootRow.innerHTML = `
        <td>0</td>
        <td>Sentence Root</td>
        <td><select id="node1-0" disabled><option value="">N/A</option></select></td>
        <td><input type="text" id="node1-relation-0" disabled></td>
        <td><select id="node2-0" disabled><option value="">N/A</option></select></td>
        <td><input type="text" id="node2-relation-0" disabled></td>
    `;
    analysisTableBody.appendChild(rootRow);

    tokens.filter(t => t.type === 'lexical' && t.id !== 0).forEach(token => {
        const analysis = tokenAnalyses.find(a => a.tokenId === token.id) || {};
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${token.id}</td>
            <td>${token.text}</td>
            <td><select id="node1-${token.id}" onchange="updateAnalysis(${token.id}, 'node1Id', this.value)">
                <option value="">Select...</option>
                <option value="0" ${analysis.node1Id === 0 ? 'selected' : ''}>0: Sentence Root</option>
                ${tokens.filter(u => u.type === 'lexical' && u.id !== token.id && u.id !== 0).map(u => `<option value="${u.id}" ${analysis.node1Id === u.id ? 'selected' : ''}>${u.id}: ${u.text}</option>`).join('')}
            </select></td>
            <td><input type="text" id="node1-relation-${token.id}" value="${analysis.node1Relation || ''}" oninput="updateAnalysis(${token.id}, 'node1Relation', this.value)" autocomplete="on"></td>
            <td><select id="node2-${token.id}" onchange="updateAnalysis(${token.id}, 'node2Id', this.value)">
                <option value="">Select...</option>
                <option value="0" ${analysis.node2Id === 0 ? 'selected' : ''}>0: Sentence Root</option>
                ${tokens.filter(u => u.type === 'lexical' && u.id !== token.id && u.id !== 0).map(u => `<option value="${u.id}" ${analysis.node2Id === u.id ? 'selected' : ''}>${u.id}: ${u.text}</option>`).join('')}
            </select></td>
            <td><input type="text" id="node2-relation-${token.id}" value="${analysis.node2Relation || ''}" oninput="updateAnalysis(${token.id}, 'node2Relation', this.value)" autocomplete="on"></td>
        `;
        analysisTableBody.appendChild(row);
    });
    updateGraph();
    cite2UrnDisplay.textContent = cite2Urn;
}

// Update token relationship (Fixed relationship bug)
function updateAnalysis(tokenId, field, value) {
    let analysis = tokenAnalyses.find(a => a.tokenId === tokenId);
    if (!analysis) {
        analysis = { tokenId };
        tokenAnalyses.push(analysis);
    }
    // Parse node IDs as numbers to avoid undefined (Fixed relationship bug)
    analysis[field] = value === '' ? null : (field.includes('Id') ? parseInt(value, 10) : value);
    // Clean up empty analyses
    if (!analysis.node1Id && !analysis.node1Relation && !analysis.node2Id && !analysis.node2Relation) {
        tokenAnalyses = tokenAnalyses.filter(a => a.tokenId !== tokenId);
    }
    updateGraph();
}

// Graph visualization
function updateGraph() {
    const activeTokenIds = new Set([0]); // Always include Sentence Root
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
    }].concat(tokens.filter(t => t.type === 'lexical' && activeTokenIds.has(t.id) && t.id !== 0).map(t => ({
        id: t.id,
        label: `${t.id}: ${t.text}`,
        color: '#e6f0fa',
        font: { size: 12 }
    })));

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

    const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
    const options = {
        layout: {
            hierarchical: {
                direction: 'UD', // Top-down
                sortMethod: 'hubsize',
                parentCentralization: true,
                levelSeparation: 150,
                nodeSpacing: 200
            }
        },
        nodes: {
            shape: 'box',
            color: { border: '#005ea2' }
        },
        edges: {
            font: { size: 10 },
            arrows: { to: { enabled: true, scaleFactor: 0.5 } }
        },
        physics: { enabled: false }
    };
    if (graphNetwork) graphNetwork.destroy();
    graphNetwork = new vis.Network(graphContainer, data, options);
}

// Export state to CEX
function exportCex() {
    let cex = '#!citelibrary\n';
    cex += `name#Ancient Greek Syntax Analysis\n`;
    cex += `urn#${cite2Urn}\n`;
    cex += `text#${ctsUrn}\n\n`;

    cex += '#!citedata\n';
    cex += 'sentence#text\n';
    cex += `${sentenceId}#${input.value.replace(/#/g, '\\#')}\n\n`;

    cex += '#!citedata\n';
    cex += 'tokenId#text#verbalUnitIds\n';
    tokens.filter(t => t.type === 'lexical').forEach(t => {
        const units = tokenAssignments.find(a => a.tokenId === t.id)?.verbalUnitIds.join(',') || '';
        cex += `${t.id}#${t.text.replace(/#/g, '\\#')}#${units}\n`;
    });
    cex += '\n';

    cex += '#!citedata\n';
    cex += 'unitId#syntacticType#semanticType#level\n';
    verbalUnits.forEach(u => {
        cex += `${u.id}#${u.syntacticType.replace(/#/g, '\\#')}#${u.semanticType.replace(/#/g, '\\#')}#${u.level}\n`;
    });
    cex += '\n';

    cex += '#!citerelations\n';
    cex += 'source#target#relation\n';
    tokenAnalyses.forEach(a => {
        if (a.node1Id !== null && a.node1Relation && a.node1Id !== undefined) {
            cex += `${a.tokenId}#${a.node1Id}#${a.node1Relation.replace(/#/g, '\\#')}\n`;
        }
        if (a.node2Id !== null && a.node2Relation && a.node2Id !== undefined) {
            cex += `${a.tokenId}#${a.node2Id}#${a.node2Relation.replace(/#/g, '\\#')}\n`;
        }
    });

    const blob = new Blob([cex], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analysis.cex';
    a.click();
    URL.revokeObjectURL(url);
}

// Import state from CEX (Fixed CEX import bug)
function importCex(fileContent) {
    const lines = fileContent.split('\n');
    let currentBlock = '';
    let sentenceData = {};
    let tokenData = [];
    let unitData = [];
    let relationData = [];

    // Parse CEX
    lines.forEach(line => {
        line = line.trim();
        if (line.startsWith('#!citelibrary')) {
            currentBlock = 'citelibrary';
        } else if (line.startsWith('#!citedata') && line.includes('sentence#text')) {
            currentBlock = 'sentence';
        } else if (line.startsWith('#!citedata') && line.includes('tokenId#text#verbalUnitIds')) {
            currentBlock = 'tokens';
        } else if (line.startsWith('#!citedata') && line.includes('unitId#syntacticType#semanticType#level')) {
            currentBlock = 'units';
        } else if (line.startsWith('#!citerelations')) {
            currentBlock = 'relations';
        } else if (line && !line.startsWith('#')) {
            const parts = line.split('#').map(p => p.replace(/\\#/g, '#'));
            if (currentBlock === 'citelibrary') {
                const [key, value] = parts;
                if (key === 'urn') cite2Urn = value;
                if (key === 'text') ctsUrn = value;
            } else if (currentBlock === 'sentence' && parts.length >= 2) {
                sentenceData = { id: parts[0], text: parts[1] };
            } else if (currentBlock === 'tokens' && parts.length >= 3) {
                tokenData.push({ id: parseInt(parts[0]), text: parts[1], verbalUnitIds: parts[2].split(',').filter(id => id) });
            } else if (currentBlock === 'units' && parts.length >= 4) {
                unitData.push({ id: parts[0], syntacticType: parts[1], semanticType: parts[2], level: parseInt(parts[3]) });
            } else if (currentBlock === 'relations' && parts.length >= 3) {
                relationData.push({ source: parseInt(parts[0]), target: parseInt(parts[1]), relation: parts[2] });
            }
        }
    });

    // Update state
    sentenceId = sentenceData.id || generateUUID();
    input.value = sentenceData.text || defaultSentence;
    tokens = tokenize(input.value); // Includes Token 0
    verbalUnits = unitData;
    verbalUnitIdCounter = Math.max(...verbalUnits.map(u => parseInt(u.id.replace('VU', '')) || 0)) + 1 || 1;
    tokenAssignments = tokenData
        .filter(t => tokens.some(tok => tok.id === t.id))
        .map(t => ({ tokenId: t.id, verbalUnitIds: t.verbalUnitIds.filter(id => verbalUnits.some(u => u.id === id)) }));
    tokenAnalyses = [];
    relationData.forEach(r => {
        if (tokens.some(t => t.id === r.source) || r.source === 0) {
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
        }
    });

    // Refresh UI (Fixed CEX import bug)
    stage1Section.style.display = 'block';
    stage2Section.style.display = 'block';
    updateTokenDisplay();
    updateVerbalUnitTable();
    updateVerbalUnitSelect();
    updateAssignmentDisplay();
    updateAnalysisTable();
}

// Event listeners for export/import
exportCexBtn.addEventListener('click', exportCex);
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

// Handle input changes
input.addEventListener('input', () => {
    const sentence = input.value.trim();
    tokens = tokenize(sentence);
    verbalUnits = [];
    verbalUnitIdCounter = 1;
    sentenceId = generateUUID();
    tokenAssignments = [];
    tokenAnalyses = [];
    ctsUrn = '';
    cite2Urn = `urn:cite2:analyzer:analysis:2025-06-13-${sentenceId}`;
    updateTokenDisplay();
    updateVerbalUnitTable();
    updateVerbalUnitSelect();
    updateAssignmentDisplay();
    updateAnalysisTable();
});

// Initialize with default sentence
tokens = tokenize(defaultSentence);
updateTokenDisplay();
updateVerbalUnitForm();
updateVerbalUnitTable();
updateVerbalUnitSelect();
updateAssignmentDisplay();
updateAnalysisTable();
