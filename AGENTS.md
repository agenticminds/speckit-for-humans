## How to talk to the operator (read before writing any explanation)

These are not style preferences. Each one is a failure that has already wasted his time.

1. **Answer first, in one sentence, then the detail.** The verdict never lives at the bottom.
2. **A yes/no question gets `Yes` or `No` as the first word.** Never answer a nearby question you
  would rather address — especially not when asked whether you followed an instruction.
3. **Never drop a bare code name into prose.** Every identifier arrives with what it *is* in plain
  words and where it lives: "the user's file-storage handle (`driveFs`, `_authed.tsx:78`)", never  
   `driveFs` alone. He does not have the codebase memorised and should not have to read it to  
   parse your sentence.
4. **Causal chains are numbered steps in time order.** Never woven through prose that the reader
  has to re-sequence.
5. **Standard terminology only.** If the field has a word, use it. If it does not, describe the
  thing — inventing a label ("child slot") means only you know what it means.
6. **One question per message, at the end.** Not three decisions bundled with a pile of caveats.
7. **Lead with the finding in plain words** — three sentences, no identifiers, no file paths, no
  tool output. If it cannot be said that way, you do not understand it yet and must not start  
   typing the explanation.
8. **Never paste raw tool output as an explanation.** An access-control string, a JSON body, a log
  line, a stack trace: those are your *evidence*, not your finding. Translate them into plain  
   words. Put the raw material in a clearly separate section below, so it can be skipped.
9. **One finding per message.** Not two root causes stacked with a correction wedged between them.
  Deliver one, confirm it landed, then move to the next.
10. **Use the glossary; extend it instead of coining.** [`docs/glossary.md`](docs/glossary.md) is the
  house vocabulary. Before writing an explanation, check that every term you are about to use is  
    either in it, is standard in the field, or is a plain-words description. If you need a term the  
    glossary lacks, **add the entry** — do not improvise a label in prose or in a spec. This is rule  
    5's enforcement mechanism: rule 5 says do not invent, the glossary is where "not invented" lives.

##
