You have been helping me with this project: <https://github.com/Eumaeus/Syntactile>. 

It hopes to be a tool for allowing students and scholars to analyze the syntax of Ancient Greek sentences and serialize those analyses in a way that can be usefully compared, visualized, aligned with their source texts and thus used in various ways.

The last conversation we had on this topic is here: <https://x.com/i/grok/share/3e0c1aa031ae4659aa863e8246ee2792>

The code at <https://github.com/Eumaeus/Syntactile> includes a directory, `ai_queries` that contains the history of my requests for help that got the project to its present state. This will be updated in the repository as we go along.

I am working in branch `feature/import-sentences`.

## First, a Little Simplification

I have removed the placeholder "Stage 2: Morphological Analysis." I no longer want to have that in this app. My reasons are:

1. It would add a laborious step to an already complicated process for students.
1. I already have provision for morphological analysis of a tokenized text in the [Dramaturg](https://github.com/Eumaeus/Dramaturg.jl) project, with the added benefit of lexical information as well.
1. Given the above, I really don't want two possibly conflicting sources of morphological identification for the same texts.
1. (Moving to what follows, below) By using the same tokenized texts with the same CTS-URNs, it will be relatively easy, in a later process, to align morphology/lexicography from Dramaturg with syntax from this project.

## Data: Desiderata

If students are going to labor over syntactic analysis of sentences from either a textbook or an Ancient Greek text, their work must be more broadly useful.

Other projects for analyzing Greek syntax sever the connection between the tokens being analyzed and their source text. Some make gestures by adding a CTS-URN to the work-, edition-, or passage-level. But syntactic analysis happens at the token level. I have found after trying for literal years that it is impossible to re-align those analyses with their source-texts using string-matching.

And so I am interested in making sure that the tokens we analyze with this tool have the same identifiers as those same tokens in their textual context elsewhere.

With that, many things are possible.

## Data Sources

I have checked into the repository `src/sentences/` and `src/texts/`.

The latter, `src/texts`, contains `.cex` texts that are tokenized exemplars taken from the [Dramaturg](https://github.com/Eumaeus/Dramaturg.jl) project.

> You helped me with that, and we spent a lot of time fine-tuning the tokenization algorithm and dealing with edge-cases. So the tokenized texts in that project are demonstrably useful. And so we will use them—that particular tokenization with those particular CTS-URNs—here.

The former directory, `src/sentences`, is a directory containing some `.tsv` files. In each, the first, commented-out, line is a label for the file.

There is a header line identifying three columns: `label`, `text`, `sentence`.

"Label" is a human-readable lable for the sentence identified by a line.

"Text" is a relative path (within the `src/` directory) to a `.cex` file of a tokenized text containing tokens cited by CTS-URNs.

"Sentence" is a CTS-URN expressing a range of citable nodes, in this case, a range of citable tokens, the result of the tokenization code in [Dramaturg](https://github.com/Eumaeus/Dramaturg.jl).

## Getting a Sentence

Broadly speaking… From one of the `.tsv` files in `src/sentences` we get the three columns identifying a sentence.

Its `sentence` property is a URN is a range CTS-URN, "from this passage to this other passage". For example:

	urn:cts:greekLit:tlg0012.tlg001.allen:1.1.token.1-1.7.token.8

The part we are interested in is `1.1.token.1-1.7.token.8`.

From this, we can construct a "from-URN" and a "to-URN":

- From: `urn:cts:greekLit:tlg0012.tlg001.allen:1.1.token.1`
- To: `urn:cts:greekLit:tlg0012.tlg001.allen:1.7.token.8`

From the `text` column, we see that this sentence is in `texts/Iliad_tokenized.cex`.

Reading that file, skipping everything until after the `#!ctsdata` line, we can find the "from-URN" and grab it, then grab all following lines until, and including, the line identified with the "to-URN".

Now we have the tokens identified as being part of a sentence, and each token has a very explicit CTS-URN identifier.

## Generating this Source Data

This is a separate problem that we can deal with on another day. I have checked into the repository some sample data that I extracted and scripted into what I think is the propert form.

## Source Data in the WebApp

- I want to keep the current functionality of a text-box into which a user can type or paste a Greek sentence, for *ad hoc* analysis.
- I would like to add "Load Sentence" controls.
- Because I hope to have a number of texts with sentences identified and ready for analysis, this "Load Sentence" should have two parts:
	- One popup menu, populated from the contents of `src/sentences`, specifically, the file-labels in the first, commented, line. For `src/sentences/Frogs_sentences.tsv` this would be "//Aristophanes, Frogs", and the popup menu would have one item in the list as "Aristophanes, Frogs", without the "//".
	- Another popup menu, empty until the user has selected from the previous one, will show the labels for the sentences identified in the `.tsv` identified by the previous menu.
- When the user has made a selection from both of these, the tokens from the correct `.cex` file in `texts/` will be selected, with their URNs as their identifiers, ready to be analyzed as parts of a sentence.

From here, the program can procede as it currently works. BUT, the JS value `ctsUrn`, currently hard-coded at line 41 of `src/script.js` should reflect the range CtsUrn of the selected senence, the `sentence` property from the `.tsv` file in `src/sentences/`.

For the display as the student works, each token in the sentence can have an enumeration, 0…N, which is displayed, but the token's ID should be its CTS-URN.

Those CTS-URN IDs should used as the `tokenId` in the downloaded CEX output.

