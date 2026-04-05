# AI Translation Comparison Research

## Source 1: Nature — Gao et al. (2024)
"Machine translation of Chinese classical poetry: a comparison among ChatGPT, Google Translate, and DeepL Translator"
Humanities and Social Sciences Communications, 11, Article 835 (2024)
URL: https://www.nature.com/articles/s41599-024-03363-0
24k accesses, 49 citations

### Key Findings:
- **ChatGPT outperformed Google Translate and DeepL in ALL evaluation criteria** for poetry translation
- Evaluation criteria: fidelity, fluency, language style, machine translation style
- No significant difference between DeepL and Google Translate
- **Critical finding: prompts matter enormously** — when ChatGPT was given a prompt instructing it to "preserve the rhythm and rhyme of poems," it demonstrated "remarkable ability to retain the beauty of the original poetic language"
- ChatGPT showed proficiency in comprehending common symbols, imagery, and semantic components
- Traditional MT systems (Google, DeepL) struggle with: ambiguity, cultural references, allusions, artistic expression
- The study explicitly notes: "machine translation has frequently been regarded as inferior to human translation, particularly in the realm of literary texts"

### Weaknesses Identified in AI Translators:
1. **Verb richness** — MT fails to capture the diversity of verbs used in literary text
2. **Syntactic diversity** — MT tends toward uniform sentence structures
3. **Contextual/prior knowledge** — MT struggles with ambiguity requiring cultural background
4. **Linking patterns** — MT fails to replicate the discourse-level connections in literary text
5. **Concise/ambiguous language** — Chinese poetry's compression is especially challenging

### Implication for Our Skill:
The study proves that **prompt engineering is the single biggest differentiator** in LLM-based literary translation. Our skill IS essentially a prompt engineering framework. The gap: we need to be MORE specific about what to instruct in the prompt — not just "translate poetically" but specific directives about rhythm, rhyme, imagery, and cultural context.

## Source 2: Yan et al. (2024) — Benchmarking GPT-4 against Human Translators
arXiv:2411.13775v1, Nov 2024
URL: https://arxiv.org/html/2411.13775v1

### Key Findings:
- GPT-4 achieves performance comparable to **junior-level** translators in total errors
- GPT-4 **still lags behind senior translators** with a considerable gap
- GPT-4 maintains consistent quality across resource-rich AND resource-poor language pairs (unlike traditional NMT)
- Used MQM (Multidimensional Quality Metrics) schema for evaluation

### GPT-4's Two Primary Limitations:
1. **Adherence to overly literal translations** — GPT-4 translates too literally, missing idiomatic or creative expression
2. **Lexical inconsistency** — GPT-4 uses different words for the same term across a document, breaking coherence

### Human Translators' Weaknesses (for comparison):
1. **Over-interpretation** — humans sometimes read too much into context
2. **Hallucination** — humans occasionally add information not in the source
3. **Fatigue** — quality degrades over long documents

### GPT-4's Specific Error Categories:
- Weak in **Grammar** and **Named Entity** translation
- Does NOT suffer from human hallucination or fatigue
- Consistent across News, Technology, and Biomedical domains

### Implication for Our Skill:
The skill needs to explicitly counteract GPT-4's two weaknesses:
1. **Anti-literalism directives** — instruct the LLM to prioritize idiomatic expression over word-for-word fidelity
2. **Lexical consistency checks** — instruct the LLM to maintain consistent terminology across the translation
