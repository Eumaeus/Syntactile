# Texts for Syntactile

The source-texts for syntactic analysis in Syntactile are formatted as *tokenized exemplars of specific editions of texts, cited by CTS-URN.*

The texts included here are tokenized from editions used in the [Dramaturg project](https://github.com/Eumaeus/Dramaturg.jl), tokenized by the Julia code in that project, based on a specific set of rules for tokenization.

## Why this Matters

A goal of the present tools for syntactic analysis is to create analyses that align specifically with other useful digital editions.

[Dramaturg](https://github.com/Eumaeus/Dramaturg.jl) takes digital editions of texts and creates enriched online reading environments [like this one](https://folio3.furman.edu/dramaturg/).

The "enrichment" is based on the fact that the base texts are tokenized, with each word being given a very specific CTS-URN citation. This allows us to identify that word with no ambiguity, and that allows us to connect each word with other information—morphology, lexicography, comments, and ideally syntax.

The output of Syntactile identifies the Greek words being analyzed with CTS-URN citation. If we use the same text, with the word-tokens having the same CTS-URN identifiers, as texts in another reading environment, the two projects can work together and complement each other.

