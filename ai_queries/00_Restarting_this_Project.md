# Background

Several months ago, you helped me get started on this project: <https://github.com/Eumaeus/Syntactile>.

Syntactile aims to allow a student to document the syntax of an Ancient Greek sentence as a rooted directed graph.

The current code—html, css, js—is all in `src/index.html`.

Sample output is in `sample_output/analysis.cex`.

A draft of instructions for the user, which you might find helpful for getting back into this project, is in `docs/usage.md`.

This query, and any future ones as we work on this together, will be in `ai_queries`.

I am hoping that this can be a valuable teaching tool for students of Ancient Greek, here in AD 2026. If I assign them to read some sentences from the textbook, the inevitable temptation will be for them just to drop the sentences into some AI_Agent, which will probably do a great job translating. 

But by having them document the syntax into a graph structure, serializing that graph and exporting it, I can (a) see that they have engaged with every word, (b) hope to see precisely where they may have gone wrong, if they did go wrong, and (c) have something concrete to give them credit for.

This would, for students, necessarily be laborious, and it would not replace reading sentences "live" in class. But as a focused exercise in reading slowly, methodically, and completely, it could be very satisfying.

I began this work before understanding and implementing how best to proceed in an ongoing collaboration with Grok. I'm picking it up now. 

As a first step, I would like for both of us to review the existing code, improve or refactor as necessary, and update the README for the repository. If the repo needs re-organization, looking to the future, this would be the time to do it.

## First Steps

As a first step, I would like to confirm that you understand the work we have done and the goals. Since you were instrumental in getting me this far, I doubt we'll have any problem picking up now.

### Step:

I would like the CSS and JS to be pulled out into separate files.

### Step:

Currently, when a user is documenting the syntax, the "Node 1 Relation" and "Node 2 Relation" fields are freeform text-entry fields. I would like those to be menus. 

Initially, I wanted to keep it flexible as I tried different sentences. Now I would like to constrain the choices. When inevitably, as I use this tool with real texts I want to change the list of relations, I can edit the HTMl/JS accordingly. I have put the choices in `docs/usage.md`, but here they are as a list:

- Sentence Adverbial
- Unit Adverbial
- Conjunction
- Apostrophe
- Finite Unit Verb
- Infinitive Unit Verb
- Circumstantial Participle
- Attributive Participle
- Auxiliary Infinitive
- Articular Infinitive
- Adverbial
- Preposition
- Attribute
- Article
- Subject
- Appositive
- Direct Object
- Dative
- Genitive
- Accusative

For the record, the reason there are two possible relations is to account for things like relative pronouns. A relative pronoun might be the direct object of a verb in a main clause, *and* the subject of the relative clause.

### Step:

Currently, when a user saves the state of work as an exported CEX, and reimports it into the webapp, the app populates the syntax graph-data and graph visualization perfectly. 

It does not re-populate the section on token assignment to verbal units, although that data is saved very cleanly in the CEX output file.

### Conclusion:

So this might be enough to start with, as the first concrete steps.

What follows is not for right now, but (for my own thinking) a list of next steps to consider is below.

Thank you for your past help getting me this far and for any future help you can offer!

## Future Steps

- Data-source for sentences
- Generated analysis data in and out
- Morphology
- Visualizations of syntax graphs, and reuse of them.
- Graph comparison for scholarship and grading

----

Conversation started on Grok: <https://x.com/i/grok/share/d9f5a6eae6174ad58c467d12eb380180>