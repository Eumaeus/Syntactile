# Usage Guide: Ancient Greek Syntax Analyzer

This guide explains how to use the Ancient Greek Syntax Analyzer, a web application for students to analyze the syntax of Ancient Greek sentences.

## Getting Started
1. Open `src/index.html` in a modern web browser (e.g., Chrome, Firefox).
2. The textarea is pre-populated with a sentence from Lysias: "περὶ τούτου γὰρ μόνου...".
3. A CTS-URN identifies the sentence (e.g., `urn:cts:greekLit:tlg0054.tlg001.perseus-grc1:1.1.1`).
4. Edit the sentence, load a new one by CTS-URN (in future versions), or import a CEX file to restore an analysis.

## Stages
### Stage 1: Verbal Units and Token Assignment
- **Goal**: Define verbal units (clauses or phrases) and assign tokens to them.
- **Steps**:
  - View the tokenized sentence (lexical tokens in boxes with superscripted IDs, e.g., `περὶ¹`).
  - In the form, define a verbal unit by selecting:
    - **Syntactic Type**: Independent Clause, Subordinate Clause, etc.
    - **Semantic Type**: Transitive, Intransitive, Linking.
    - **Level**: 1–5 (for indentation, e.g., 1 for top-level, 2 for subordinate).
  - Click “Confirm Verbal Unit” to add or “Save Changes” to edit.
  - Edit or delete units using the table’s buttons.
  - Select a verbal unit from the dropdown (e.g., `VU1 (Subordinate Clause)`).
  - In the “Unassigned Tokens” list, click a token to assign it; it moves to the unit’s assigned list (in sentence order) and disappears from “Unassigned Tokens.”
  - Click an assigned token under the selected unit to unassign it, returning it to “Unassigned Tokens.”
  - Switch to a new unit to start with an empty assigned list; switch to a prior unit to restore its state.
  - Tokens can belong to multiple units for nested structures (e.g., an attributive participle within a clause).
  - Token 0 (“Sentence Root”) is reserved for Stage 2 and not shown.
- **Display**:
  - Units show assigned tokens, indented by level, with distinct border colors per unit and the current unit’s tokens highlighted (green background).
  - “Unassigned Tokens” lists tokens available for the current unit.

### Stage 2: Syntactic Relationship Analysis
- **Goal**: Define syntactic relationships to build a directed graph, identified by a CITE2-URN.
- **Steps**:
  - The graph above the table shows a top-down view, rooted at '0: Sentence Root' at the top, with dependent nodes extending downward and edges labeled by relations (e.g., 'sentence adverbial' for γὰρ, 'Unit Verb' for the main verb).
  - In the table, for each token (starting with '0: Sentence Root'):
    - **Token ID** and **Text**: Shown.
    - **Node 1**: Select a token ID to link to (e.g., '0: Sentence Root').
    - **Node 1 Relation**: Enter the relationship (e.g., “sentence adverbial” for γὰρ, “Unit Verb” for the main verb).
    - **Node 2**: Optionally select another token ID.
    - **Node 2 Relation**: Enter the second relationship (if applicable, e.g., for relative pronouns).
  - A main verb linking to '0: Sentence Root' with 'Unit Verb' indicates asyndeton; a linking word (e.g., γὰρ) with 'sentence adverbial' indicates none.
  - Click “Export CEX” to save the analysis as a `.cex` file, capturing the full state.
  - The graph updates as relations are assigned, remaining zoomable.
- **Result**: A graph representing the sentence’s syntactic structure, exportable/importable via CEX.

## Tips
- Import a CEX file to instantly restore both stages, including verbal units, token assignments, relationships, and the graph.
- Changing the input resets all stages unless importing a CEX file.
- Use Edit/Delete in Stage 1 to refine units.
- Tokens can link to one or two other tokens (e.g., relative pronouns to their antecedent and clause role).
- Export CEX to save progress; import to resume exactly where you left off.

## Support
See [development.md](development.md) or file issues on GitHub.