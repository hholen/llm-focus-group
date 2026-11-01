---
name: llm-focus-group
description: Run a focus group of LLMs on a product and its rivals with the llm-focus-group CLI, then read the objections and documentation gaps. Use when someone wants to know why AI agents would or wouldn't recommend a product, or wants to compare docs before and after a change.
---

# llm-focus-group

Drive the CLI. Don't call model APIs yourself.

1. Run `npx llm-focus-group init <folder>` for a new study, or use the study the user names. Put their material in its folders. Include at least one rival, because single-product verdicts mean nothing.
2. Run `npx llm-focus-group run <study.yaml>`. It prints an estimate and asks before spending.
3. Show the user the estimate and let them answer. Use `--yes` only after they have approved that estimate in this conversation: with no terminal, the CLI stops and prints the estimate, so rerun with `--yes` once they agree.
4. Read `report.md`. Lead with objections and documentation gaps. Don't name a winner, and give any pick counts with their sample size.
5. For a before/after, use `npx llm-focus-group diff <run-a> <run-b>`. Report the counts and don't say a change worked.
6. To test a change before building it, write a `probes.yaml` with the change the user would really make, plus a placebo that shouldn't matter. Run `npx llm-focus-group probe <run-folder> <probes.yaml>`, then show the user both wordings and the estimate, and use `--yes` only after they approve. Rerunning reuses the rewrites at no cost. Compare each probe with the placebo. Call the result screening, and confirm a promising change by editing a copy of the material, rerunning the study and using `diff`.
7. Tell the user their material goes to the chosen providers. Check documentation gaps against the real product before calling them product gaps.
