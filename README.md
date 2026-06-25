# Ancient Greek Syntax Analyzer

A web application for students to tokenize and analyze the syntax of Ancient Greek sentences, designed for educational use in classical studies. Supports four stages: tokenization, clause analysis (“verbal units”), assignment of tokens to verbal units, morphological identification, and syntactic relationship analysis.

Greek words are canonically identified with CTS-URNs. CITE2-URNs as identifiers for analyses.

Analyses can be exported as a `.cex` file, which can be re-imported for further work or revision. 

## Features
- Input an Ancient Greek sentence (pre-populated with a Lysias sentence, identified by CTS-URN).
- **Stage 1: Sentence Adverbial Identification**:
  - Tokenize into white-space, punctuation, and lexical tokens (IDs 1, 2, …).
  - Select a sentence adverbial (yellow highlight) or asyndeton (`ROOT⁰` token).
  - Sets the root for a syntax graph.
- **Stage 2: Clause/Phrase Analysis**:
  - Define verbal units with IDs (e.g., `VU1`), Syntactic Type, Semantic Type, Level (1–5).
  - Form displays ID; table allows Edit/Delete.
- **Stage 3: Token Assignment**:
  - Assign tokens to verbal units via “Unassigned Tokens” list (pre-populated).
  - Tokens can belong to multiple units (e.g., for nested clauses and participles).
  - Tokens display in sentence order.
  - Unassign by clicking assigned tokens per unit. Adverbial/`ROOT⁰` ineligible.
  - Displays units with tokens, indented by level (1em/level).
- **Stage 4: Morphological Descripton of Tokens
- **Stage 5: Syntactic Relationship Analysis**:
  - Define relationships between tokens (Node 1, Node 1 Relation, Node 2, Node 2 Relation).
  - Inline table editing with dropdowns for token IDs and text inputs for relations.
  - Visualizes a directed graph (vis.js) rooted at adverbial/`ROOT⁰`.
  - Analysis identified by CITE2-URN.
- Modern, minimalist UI with clear instructions.
- Prepares for CSV/TSV export with `sentenceId`.

## Installation

1. Clone the repository.
1. Navigate to the `src` directory.
1. Start a server.
1. Visit the address.




