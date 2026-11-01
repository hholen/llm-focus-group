# llm-focus-group

Run a focus group where the participants are LLMs speaking as themselves. Show them your product and its rivals, let them argue across providers, and find out why an AI agent would or wouldn't recommend you.

## Read this first

When we showed models one product at a time, every product ended up chosen, including one they had all rejected after reading. A verdict from a single-product session means nothing. So this tool compares by default, puts objections first, and never names a winner. Treat picks as weak evidence: moderated discussion alone can swing them.

## Try it

```bash
npx llm-focus-group demo                # free, mock replies
npx llm-focus-group init my-study       # sample study with fictional products
npx llm-focus-group run my-study/study.yaml
npx llm-focus-group diff runs/<a> runs/<b>
npx llm-focus-group probe runs/<a> my-study/probes.yaml
npx llm-focus-group models              # current model IDs
```

Want to see the output first? [`examples/report.md`](examples/report.md) is a real report from the sample study, with fictional products and real model replies.

You need one `OPENROUTER_API_KEY`. `run` shows an estimate and asks before spending. If a run stops, `llm-focus-group resume <run-folder>` carries on without repaying finished calls.

Your material is sent to the providers you choose. There is no telemetry.

## What a session does

Each run takes an unprompted ballot, a ballot after reading, control ballots with no discussion, then moderated rounds with private ballots, and closing statements. Product order, seat order and the moderator rotate between runs.

The report leads with evidence warnings, objections and documentation gaps, followed by ballots with sample sizes, discussion effects and transcripts. Set `blind: true` to mask product names, and `searchBallot: true` to test whether a model finds a product by web search. Every seat searches, once per run. OpenRouter models report only the pages they cited, not their queries or everything they saw, and the report says so.

## Testing a change before you build it

A focus group can ask "what if?". After a run, `probe` puts hypothetical changes to the same panel:

```yaml
probes:
  - id: seats-10
    change: "Northdesk's $19/month plan covers up to 10 users instead of 5."
  - id: placebo
    change: "Northdesk's $19/month plan covers up to 6 users instead of 5."
    placebo: true
```

Asking a model "what if it were better?" invites a yes, so probes have guards:

- **A placebo is required.** It's a change that shouldn't matter. If a real probe doesn't move more picks than the placebo, it tells you nothing.
- **The moderator rewrites each probe neutrally**, once, so every model hears the same words. You see both versions and an estimate before ballots run, and a rewrite that changes a number is rejected. Read them anyway, because the check can't catch a change in meaning.
- **Each probe starts from the saved discussion**, so one what-if can't colour the next.

Probes are screening, not proof. Models are reacting to a stated hypothetical just after a discussion. To confirm a result, write the change into a copy of your material, run the study again and use `diff`. Only probe changes you'd really make, and don't publish a claim until it's true.

## Limits

- Models aren't buyers, and this doesn't predict what AI will recommend.
- Model output varies, so a rerun won't match exactly. Each run stores its inputs so you can repeat and compare.
- Objections come from what's in your material. Check documentation gaps against the real product.
- Diff shows counts, and can't prove a change caused a shift. Moves on products you didn't edit are shown as a noise baseline.
- Nothing yet shows that these sessions match how agents behave in the wild.
- Cost figures are estimates.

## Licence

MIT
