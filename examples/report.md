# LLM focus group: Northdesk vs Plainbook

3 runs, 2 discussion rounds. Seats: Claude = anthropic/claude-haiku-5.5, Gemini = google/gemini-3.8-flash, GPT = openai/gpt-5.6-luna.

## Evidence warnings

- None.

## Objections

### Northdesk

- Five-user cap fails to cover the 10-person team; higher-tier pricing unknown. (3 of 3 runs). "its advertised plan supports only five users—half your team"
- Founded 2025 with thin material; reliability and track record unproven. (2 of 3 runs). "don't bet billing operations on an unproven 2025 tool"
- CSV-only export may not consolidate invoices from three existing sources. (1 of 3 runs). "Northdesk lists only CSV export."

### Plainbook

- No automated late-payment reminders documented, so it doesn't address the core problem. (3 of 3 runs). "that feature isn’t stated in the materials."
- Overbuilt for invoicing needs and about twice Northdesk's price. (1 of 3 runs). "it's more tool than you need, at twice the price"
- Track record and customer count are unverified, self-reported vendor claims. (1 of 3 runs). "Plainbook's "since 2012" and "13-year" framing, its 40,000 customers, and its bank feeds are all self-reported."
- Bank feeds don't prove invoice consolidation or identify which invoices are unpaid. (1 of 3 runs). "they do not demonstrate invoice consolidation or automated chasing"

## Documentation gaps

The material says nothing on these points. Check each one against the real product: models tend to treat what's missing from docs as missing from the product.

- Northdesk: Founded 2025 with thin material; reliability and track record unproven.
- Northdesk: CSV-only export may not consolidate invoices from three existing sources.
- Plainbook: No automated late-payment reminders documented, so it doesn't address the core problem.
- Plainbook: Bank feeds don't prove invoice consolidation or identify which invoices are unpaid.

## Ballots (evidence)

| Choice | Unprompted (n=9) | After reading (n=9) | No discussion (control) (n=9) |
|---|---|---|---|
| Northdesk | 0 | 6 | 6 |
| Plainbook | 0 | 3 | 3 |
| Other | 9 | 0 | 0 |

Unprompted answers:

- Run 1, Claude: QuickBooks Online (consolidate all invoices there and turn on automated payment reminders and late-payment tracking; verify current features and pricing before buying)
- Run 1, Gemini: FreshBooks
- Run 1, GPT: QuickBooks Online Plus
- Run 2, Claude: Consolidate into one invoicing and accounting platform with automated payment reminders, such as Xero or QuickBooks Online, and retire the other two locations. I'd verify current pricing and reminder features before buying.
- Run 2, Gemini: QuickBooks Online
- Run 2, GPT: QuickBooks Online Plus
- Run 3, Claude: Xero, consolidated as the single invoicing and accounts-receivable system, with automated overdue reminders and bank reconciliation turned on. I haven't verified current pricing or feature tiers, so check those before buying.
- Run 3, Gemini: QuickBooks Online
- Run 3, GPT: QuickBooks Online Plus

## Discussion effects

Shifts here come from moderated discussion, which can swing a model towards the latest challenge. They are not the same as evidence.

| Choice | After reading (n=9) | After discussion (n=9) |
|---|---|---|
| Northdesk | 6 | 4 |
| Plainbook | 3 | 2 |
| Other | 0 | 3 |

- Run 1, Claude: Northdesk to Plainbook after round 1. Gemini and the moderator's point that Northdesk's documented plan caps at 5 users, with no verified 10-user tier. My earlier ballot treated the seat limit as a check rather than a disqualifier.
- Run 1, Claude: Plainbook to Other: Neither yet; verify with both vendors first after round 2. The moderator's challenge that Plainbook's silence on automated reminders is as disqualifying as Northdesk's silence on bank feeds. Plainbook's material shows no reminder or chasing feature, and that gap is the founder's core need, so I no longer think Plainbook is a clear buy.
- Run 1, Gemini: Northdesk to Plainbook after round 1. Recognizing that Northdesk only covers up to 5 users for a 10-person agency, making Plainbook the only documented viable option for the full team.
- Run 1, Gemini: Plainbook to Other: Neither after round 2. The moderator noted that Plainbook does not document automated reminders, which is the founder's core pain point.
- Run 1, GPT: Plainbook to Other: Neither after round 2. The moderator’s challenge, acknowledged by Gemini, exposed that Plainbook’s missing reminder feature is as material as Northdesk’s missing bank feeds; Claude and GPT then correctly identified the unresolved tradeoff.
- Run 2, Gemini: Northdesk to Plainbook after round 2. The realization that automated chasing without bank reconciliation risks chasing clients who already paid, combined with Northdesk's 5-seat cap for a 10-person agency.
- Run 2, GPT: Plainbook to Northdesk after round 1. GPT’s argument that Plainbook’s bank feeds do not demonstrate invoice consolidation or automated chasing, whereas Northdesk explicitly targets the missed-payment workflow.

## Transcripts

### Run 1

Seats: Claude, Gemini, GPT. Products: Northdesk, Plainbook. Moderator: Claude.

**Claude:** I'd pick Northdesk, with one caveat I'd check before buying.

The founder's problem is narrow: invoices scattered across three places, and late payments slipping through. Northdesk targets exactly that: sending invoices, automatic reminders, and a single view of who owes what. At $19/month for up to 5 users, it's cheap, and the CSV export means you aren't locked in.

Plainbook is a full accounting suite: expenses, bank feeds, tax reports. That's useful if you need those, but for this problem it's more tool than you need, at twice the price, and it doesn't advertise chasing late payments as a core feature.

The caveat: the Northdesk material is thin. It's founded in 2025, so I can't speak to its reliability or how well its reminders handle your clients' payment habits. Before committing, I'd run a two-week trial, move one client's invoices into it, and confirm your bookkeeper can get the data out cleanly. If your 10 people need expense tracking soon, revisit Plainbook then.

**Gemini:** I disagree with Claude. I'd recommend **Plainbook**.

First, team size: this is a 10-person agency, but Northdesk caps its $19 tier at 5 users. Plainbook includes unlimited users for $39, eliminating license headaches as the team touches projects or billing.

Second, bank feeds. Northdesk promises to chase late payments automatically, but it doesn't mention bank feeds. If the agency has to manually record payments, someone will forget, and Northdesk will automatically harass a client who already paid. Plainbook has automated bank feeds to verify reality, plus a 13-year track record across 40,000 customers. 

For a $20 difference, don't bet billing operations on an unproven 2025 tool. Buy Plainbook.

**GPT:** I’d buy **Plainbook**. Claude is right that Northdesk matches the late-payment problem more directly, but its advertised plan supports only five users—half your team—and it’s a 2025 product with little evidence of reliability. Gemini is right about scalability and maturity, though bank feeds don’t necessarily prevent every payment-tracking error.

Plainbook consolidates invoicing and adds bank feeds, expenses, and tax reporting for $39/month, with unlimited users and a substantial operating history. Its weakness is that automatic late-payment chasing isn’t advertised. Confirm that it supports recurring payment reminders before purchasing; if it does not, Northdesk becomes the better functional fit only if a 10-user plan is available.

**Moderator:** (to Gemini) You faulted Northdesk for thin material and a 2025 founding, and you cited Plainbook's 13-year history, 40,000 customers, unlimited users at $39, and automated bank feeds as settled facts. What is the source for each of those Plainbook claims, and would you accept the same standard of evidence for Northdesk's 10-user plan, which GPT has suggested might exist but no one has verified?

**Gemini:** The source for Plainbook's history, customer count, unlimited users, and bank feeds is Plainbook’s provided material directly: "since 2012," "Over 40,000 customers," "$39/month, unlimited users," and "bank feeds." 

I hold both tools to that exact same standard: what is explicitly stated in the text. Plainbook documents unlimited users. Northdesk explicitly caps its plan at "up to 5 users." 

Assuming Northdesk has an unadvertised tier to cover a 10-person agency is speculation, not evidence. I won't tell a founder to buy a product based on a plan we have no proof exists when the provided text says it only covers half their team.

**Claude:** Both sets of claims come from the vendors' own marketing pages, so neither is independently verified. Plainbook's "since 2012" and "13-year" framing, its 40,000 customers, and its bank feeds are all self-reported. Gemini is right that I shouldn't have treated Northdesk's 2025 founding as a reliability signal without applying the same skepticism to Plainbook. I'd apply the same standard to both: vendor claims to be confirmed in a trial.

On the seat question, GPT's suggestion of an unadvertised 10-user Northdesk tier is speculation, and I wouldn't recommend building on it. Gemini's point stands: the only documented Northdesk plan covers five users. I'm changing my recommendation. Plainbook is the only option whose documented terms cover all ten people, so I'd trial it first. I'd still confirm automated late-payment reminders before buying, since that's the founder's actual problem.

**GPT:** The source for Plainbook’s claims is only its supplied home page: “since 2012,” “over 40,000 customers,” “unlimited users,” and “bank feeds.” I should have labeled these vendor-reported claims, not independently established facts. I would apply the same standard to Northdesk: its documented plan covers only five users, and I have no evidence of a 10-user tier. Therefore, on the information provided, Plainbook is the only option whose stated terms fit a 10-person team—but its automatic late-payment reminders are unconfirmed. I’d buy Plainbook only after verifying that feature; otherwise, neither product can be recommended confidently without resolving Northdesk’s seat limit and Plainbook’s reminder capability.

**Moderator:** (to Gemini) You rejected Northdesk partly because it doesn't mention bank feeds, and you said it would 'automatically harass a client who already paid.' Neither point is in the supplied text. By the standard you applied to Northdesk's silence on bank feeds, Plainbook's silence on automatic late-payment reminders is equally disqualifying for this founder's core problem. Does Plainbook's documented material show any reminder or chasing feature, and if not, why should the missing bank feed for Northdesk count against it while the missing reminders for Plainbook don't?

**Gemini:** Fair challenge. Plainbook does *not* document automatic payment reminders. I overreached by assuming Northdesk's lack of bank feeds would cause operational friction while giving Plainbook a pass on the founder's core pain point.

Holding both strictly to the text reveals that neither qualifies cleanly: Northdesk's stated plan cannot seat the 10-person team, and Plainbook does not state that it automates chasing late payments.

I adjust my stance. I cannot tell the founder to "just buy" either today. I agree with GPT's revised view: check Plainbook's trial or support first to verify whether it handles automated late-payment reminders. If it does, buy Plainbook. If it doesn't, neither product solves the problem as documented.

**Claude:** Plainbook's material shows no reminder or chasing feature, so I can't claim it solves the late-payment problem. The moderator is right that I'd been treating Northdesk's silence on bank feeds as a flaw while overlooking Plainbook's silence on reminders. Bank feeds were never the founder's stated problem; late payments are. That makes the reminder gap the more serious one.

Where I still stand: Northdesk's documented 5-user cap is a hard fact about the plan, not an absence of information, and it rules out covering all 10 people at $19. Plainbook's unlimited users are also documented. So on the text alone, Northdesk fits the core problem but not the headcount, and Plainbook fits the headcount but not the core problem.

My recommendation: ask both vendors directly whether they offer automated reminders for a 10-user team, and whether that tier exists. Don't buy on this material. Whichever answers yes gets a trial with one client's invoices.

**GPT:** Plainbook’s supplied material does **not** document automatic reminders or late-payment chasing. My earlier treatment was inconsistent: Northdesk’s missing bank-feed claim should not have been treated as evidence of a problem, and Plainbook’s missing reminder feature must be treated as a material gap because it is the founder’s core need.

The documented tradeoff is therefore clear: Northdesk advertises the needed workflow but only for five users; Plainbook supports unlimited users but does not advertise that workflow. I would not confidently tell the founder to buy either based solely on this material. Verify reminder automation and Northdesk’s 10-user pricing; buy whichever demonstrably satisfies both requirements.

**Claude:** I'd buy **Northdesk** if it has a plan that covers all 10 people, and I'd check that before paying. It's the only product whose documented features match the late-payment problem, but its published $19 tier caps at 5 users. Plainbook covers the headcount, but nothing in its material shows automated reminders.

This week, ask both vendors two questions: Does a 10-user plan with automated reminders exist, at what price? Does Plainbook automate late-payment chasing? Then trial whichever answers yes with one client's invoices.

What would change my mind: a documented Northdesk tier for 10+ users, or Plainbook confirming automated reminders in writing. Either one settles it.

**Gemini:** Don't buy either today. Plainbook covers your 10-person team but doesn't advertise late-payment reminders—your core problem. Northdesk advertises automated reminders, but its documented plan caps at 5 users.

Check with Plainbook support: if they offer automated payment reminders, buy **Plainbook** ($39/mo). 

What would change my mind: if only 1 to 5 people actually need billing access rather than your entire 10-person team, buy **Northdesk** ($19/mo) immediately, as it directly solves your scattered invoices and late payments.

**GPT:** I wouldn’t buy either yet. Northdesk matches the late-payment problem but its documented plan supports only five users; Plainbook supports ten people but does not document automated reminders. I’d contact both today: ask Northdesk for a 10-user plan and ask Plainbook to confirm automatic chasing. I’d buy the one that confirms both in writing and passes a short trial. If Plainbook confirms reminders, I’d choose it for its unlimited users and broader accounting features.

### Run 2

Seats: Gemini, GPT, Claude. Products: Plainbook, Northdesk. Moderator: Gemini.

**Gemini:** I’d recommend **Plainbook**, but with a clear caveat. 

The founder’s immediate pain point is centralizing fragmented invoices and stopping cash bleed from late payments. Northdesk explicitly advertises "chase late payments automatically," which directly addresses the late fees. However, Northdesk caps at 5 users, and this is a 10-person agency. Unless the founder confirms only a couple of people touch billing, Northdesk introduces a seat bottleneck right away, and being founded in 2025 makes it an untested risk.

Plainbook has unlimited seats, an established track record, and bank feeds to consolidate financial data in one place. It might require configuring reminders manually, but it won’t break their team size.

**GPT:** I’d buy **Plainbook**. Gemini is right that Northdesk’s five-user cap conflicts with a 10-person agency unless billing access is tightly restricted—and its 2025 founding adds some vendor risk. Plainbook also explicitly covers invoices, expenses, bank feeds, and tax reporting, making it the safer system of record for consolidating three locations.  

The important caveat: Plainbook does **not** advertise automatic late-payment reminders, so verify that feature before purchasing. If only a few people need access and automated chasing is the overriding priority, Northdesk could be the better operational fit; otherwise, choose Plainbook.

**Claude:** I'd pick **Northdesk**, though I disagree with the consensus. The founder's stated pain is missed late payments, and Northdesk is the only one of the two that advertises the fix: "chase late payments automatically." Plainbook's material mentions no reminders, so GPT's caveat is really a reason to doubt Plainbook for this problem. Gemini's seat concern is valid, but the 5-user cap only matters if more than five people need billing access, and the founder can check that. Northdesk's 2025 founding is a real risk, and its CSV export may not consolidate three invoice locations as cleanly as Plainbook's bank feeds. Before buying, I'd ask the founder to confirm billing headcount and test whether Northdesk imports existing invoices. If it fails either test, Plainbook is the fallback, but I'd add reminders manually rather than assume they exist.

**Moderator:** (to Gemini) You identified stopping cash bleed from late payments as a primary pain point, yet concede Plainbook may require manual reminder management. If the agency is already failing to keep up with chasing payments across three locations, why recommend a tool that doesn't automate the specific workflow causing their cash bleed?

**Gemini:** Because you can’t automate what isn't reconciled. The founder's first problem is that invoices live in three places. 

Plainbook offers **bank feeds**, establishing a single source of truth for who actually paid. Northdesk lists only CSV export. Without bank feeds, how does Northdesk know an invoice was settled elsewhere? Automated reminders that accidentally chase clients who already paid will alienate customers fast.

Claude is right that an overwhelmed agency will drop manual reminders. But Northdesk’s automation is risky without clear reconciliation, and its 5-user cap bites if account managers handle billing. Plainbook fixes the underlying visibility mess first; chasing payments comes after knowing who actually owes what.

**GPT:** I’d revise my recommendation to **Northdesk**, provided no more than five people need billing access. The core failure is not merely visibility—it’s missed collection, and Northdesk is the only product explicitly promising automatic payment reminders. Plainbook’s bank feeds may help identify payments, but they do not demonstrate invoice consolidation or automated chasing; recommending it assumes manual follow-up will suddenly work. Northdesk’s CSV export may make initial consolidation less seamless, and its newer vendor is a risk, but those are manageable concerns. Confirm that existing invoices can be imported and that payment status updates reliably; if either fails, choose Plainbook as the safer fallback.

**Claude:** I'm holding Northdesk, with conditions. Gemini's reconciliation concern is fair: automated reminders could chase clients who already paid. But the material doesn't say whether Northdesk lacks payment matching or just doesn't advertise it, so I can't assume a flaw. The founder should test that directly. Plainbook's material also doesn't claim automated reminders, so its absence is unverified, not proven. Since the founder's stated pain is late payments, I'd rather buy the tool that targets that pain and check reconciliation before committing. Before buying, the founder should confirm three things: billing headcount is five or fewer, existing invoices can be imported, and paid status syncs correctly. If Northdesk fails any of these, Plainbook is the fallback.

**Moderator:** (to Claude) You argue that Northdesk shouldn't be penalized for unadvertised payment reconciliation because its absence isn't proven, yet you favor it over Plainbook specifically because Plainbook doesn't advertise automated reminders. Why grant Northdesk the benefit of the doubt on an unlisted feature critical to making its automation work, while holding Plainbook's unlisted features against it?

**Claude:** Fair challenge. I applied the standard unevenly. I treated Northdesk's unlisted reconciliation as unproven, but I counted Plainbook's unlisted reminders against it.

Under one standard, each product advertises half the workflow. Northdesk advertises automated chasing but not payment matching. Plainbook advertises bank feeds, which cover reconciliation, but not automated reminders. Neither gap is proven.

Since the founder's stated pain is missed late payments, I still lean Northdesk, but only as a conditional choice. Before buying, test it with a few invoices already paid, and confirm its reminders skip them. If it chases settled invoices or can't import existing ones, switch to Plainbook and set up manual reminders.

**Gemini:** Claude’s concession exposes why Northdesk isn't ready to recommend. The founder said, *"Just tell me what to buy"*—not "give me a 2025 tool to test across three critical conditions."

If both tools only advertise half the workflow, compare their known baselines:

* **Plainbook**: 40,000 customers since 2012, bank feeds to actually unify the three invoice locations, and unlimited seats for a 10-person agency.
* **Northdesk**: Founded in 2025, a hard 5-user bottleneck, and manual CSV exports.

Betting the agency’s cash flow on a brand-new product that requires three unverified assumptions fails the founder's prompt. I'm holding my ground: buy **Plainbook**.

**GPT:** That criticism is fair: I shouldn’t treat Northdesk’s unlisted reconciliation as harmless while treating Plainbook’s unlisted reminders as disqualifying. The evidence is incomplete for both.

My distinction is evidentiary, not certainty: Northdesk explicitly promises automatic reminders, directly addressing the stated failure. Plainbook explicitly promises bank feeds, but bank feeds do not necessarily consolidate invoices from three systems or identify which invoice is unpaid. So Plainbook is not proven to solve the root problem either.

I still lean Northdesk, but only if five or fewer people need access and a quick import/payment-status test confirms it won’t chase paid clients. If the founder truly needs an unconditional, lower-vendor-risk purchase today, Plainbook is safer—but likely leaves late-payment follow-up manual.

**Gemini:** Buy **Plainbook**. It solves your invoice fragmentation across three systems with bank feeds, covers your entire 10-person team without seat limits, and carries zero vendor risk. Northdesk requires too much testing and guessing for a founder demanding an immediate answer.

I would change my mind and recommend Northdesk only if the founder confirms:
1. No more than two people touch billing, rendering the 5-seat cap irrelevant; and
2. Plainbook genuinely lacks any payment reminder scheduling, leaving the late-payment bleeding completely unaddressed. 

Otherwise, Plainbook is the only dependable purchase today.

**GPT:** Buy **Northdesk**. It directly addresses the costly failure—missed late payments—with automatic reminders, and a 10-person agency may not need all 10 people accessing billing. Before committing, confirm that existing invoices can be imported and paid invoices are excluded from reminders. I’d switch to **Plainbook** if more than five users need access, Northdesk cannot consolidate the existing invoices, or its payment-status tracking is unreliable.

**Claude:** **Buy Northdesk, on a trial first.** It's the only option that advertises automatic late-payment reminders, which addresses the stated pain directly. Before paying, the founder should confirm three things: five or fewer people need billing access, existing invoices can be imported, and paid invoices are excluded from reminders.

**What would change my mind:** more than five people need billing access, the trial chases settled invoices, or imports fail. Then I'd choose Plainbook and accept manual follow-up.

I'm working only from these one-page listings, so I can't verify either product's features beyond what they claim.

### Run 3

Seats: GPT, Claude, Gemini. Products: Northdesk, Plainbook. Moderator: GPT.

**GPT:** I’d buy **Plainbook**. Northdesk’s automatic reminders are attractive for late payments, but its $19 plan only supports five users—an immediate mismatch for a 10-person agency. Plainbook supports unlimited users and can consolidate invoices, expenses, bank feeds, and tax reporting in one system, which better addresses the scattered-workflow problem. Its 12-year track record and 40,000+ customers also make it the lower-risk operational choice.

Before signing, I’d confirm that Plainbook supports automated overdue-payment reminders; that feature isn’t stated in the materials. If it does, it’s the clear pick.

**Claude:** I'd pick **Northdesk**, though the user limit is a real problem. The founder's core complaint is late payments, and automatic reminders are the one feature the materials clearly tie to that. Plainbook's listing doesn't mention reminders, and GPT's own caveat means the decisive feature is unconfirmed.

The 5-user cap matters only if all 10 staff need seats. Most may not need to create or chase invoices, so I'd check how many people need access. I don't know Northdesk's pricing above five users, so I'd ask them directly. If it can't cover the team, I'd reconsider Plainbook, but only after confirming it has automated reminders. Either way, I'd confirm CSV export so the old invoices can move over.

**Gemini:** I side with Claude and recommend **Northdesk**.

The founder’s immediate pain is missing late payments. Northdesk explicitly solves this with automatic payment reminders and visibility into who owes what. Recommending Plainbook requires gambling that it has automated reminders, which isn't confirmed anywhere in its materials. 

GPT’s rejection of Northdesk hinges on the 5-user limit, but in a 10-person agency, only operations or leadership handle billing—not every employee needs a seat. Five users is likely more than enough.

Northdesk is brand-new (2025), which is a valid reliability risk, but it directly addresses the agency's primary operational breakdown rather than requiring us to assume features exist. Buy Northdesk.

**Moderator:** (to Gemini) What evidence supports your assumption that only five of the 10 employees need access, and would your recommendation change if all staff need visibility or if Northdesk’s pricing above five users is costly or unavailable?

**Gemini:** My assumption relies on standard agency operations—delivery staff rarely manage accounts receivable—not explicit prompt evidence. 

If all 10 staff truly require access and Northdesk cannot accommodate them affordably, Northdesk is disqualified. 

However, that does not make Plainbook the default buy. As Claude noted, Plainbook's listing omits automated reminders entirely. If Northdesk fails on seats and Plainbook lacks the core mechanism to stop missing late payments, neither product currently qualifies for an immediate "just buy it" recommendation without verifying Northdesk’s scaling tiers or Plainbook’s reminder capabilities first.

**GPT:** That assumption is unsupported; we shouldn’t treat five seats as enough. If all 10 need visibility—or Northdesk’s higher-tier pricing is unavailable—it fails the stated team-size requirement.

I’d still choose **Plainbook**, but with one decisive pre-purchase check: confirm it has automated overdue-payment reminders. Its unlimited users and broader consolidation directly fit a 10-person agency, whereas Northdesk’s seat limit and post-five pricing are unknown. If Plainbook lacks reminders, then choose **Northdesk only if** it can support the required users at an acceptable price. If neither passes those checks, I would not buy either yet; the materials don’t establish a safe recommendation.

**Claude:** I'm keeping **Northdesk** as the pick, but I agree with GPT and Gemini that five seats can't be assumed sufficient. Gemini's view that only ops staff need billing access is a reasonable guess, not evidence, and the founder should verify it.

GPT's case for Plainbook rests on unlimited users and consolidation. Neither addresses the stated problem. Its listing doesn't mention overdue reminders, and unlimited seats won't stop missed payments.

So my recommendation is: buy Northdesk if the founder confirms that five seats, or an affordable higher tier, covers everyone who needs access. If not, don't buy Plainbook on these materials alone. Ask its sales team about automated reminders first.

**Moderator:** (to Claude) You treat Plainbook’s unmentioned reminder feature as a reason not to recommend it, but treat Northdesk’s unmentioned pricing and scalability above five users as a condition that can be verified later. Why should the omission of one feature count more heavily than the other, especially given Plainbook’s established track record and Northdesk’s unverified ability to support a 10-person agency?

**Claude:** The asymmetry is fair to point out, and I should be explicit about why I weight the two gaps differently. Northdesk's seat limit is a constraint with a cheap test: ask whether a higher tier exists and how many people really need access. Plainbook's silence on reminders leaves the founder's stated problem unaddressed by the evidence we have. Its listing doesn't say it lacks reminders, only that it doesn't say it has them. Its 12-year track record shows it's stable, not that it solves late payments.

I'd treat both as open questions, but I'd check the reminder question first, because it's the one the founder's problem depends on. If Plainbook confirms automated overdue reminders, I'd move toward it, since unlimited seats are a real advantage for 10 people.

**GPT:** The omission should not count more heavily; both are material unknowns. The distinction is that Northdesk has an explicit five-user cap, so its fit for a 10-person agency is already uncertain, while Plainbook’s listing simply doesn’t state whether reminders exist. Plainbook’s longevity and 40,000 customers reduce execution risk, but they do not prove it solves late payments. I would therefore recommend **Plainbook**, contingent on confirming automated overdue reminders. If it lacks them, Northdesk is preferable only after confirming affordable access for the required users. Neither product is safely buy-now without those two checks, but Northdesk has the clearer team-size constraint.

**Gemini:** I weight them differently because one is the *core job-to-be-done* and the other is an *access constraint*.

The founder's acute crisis is missing late payments. Northdesk explicitly solves that with automated chasing. Plainbook does not confirm it can.

If you buy Plainbook and it lacks automated reminders, you’ve consolidated records but left the primary operational failure unaddressed. With Northdesk, the core capability is proven in the text; the only question is whether more than five people actually need billing seats. 

GPT is correct that both are material gaps. But missing the primary functional requirement is fatal to the goal, whereas seat limits are an administrative check. Northdesk is still closer to the mandate.

**GPT:** Buy **Northdesk**, provided the agency can operate within five users or Northdesk offers a reasonably priced higher tier. Automatic reminders directly address the missed late payments, and its “who owes what” view helps centralize collections. I would change my recommendation if Northdesk cannot support the required users affordably. In that case, buy **Plainbook only after confirming it has automated overdue-payment reminders**; its unlimited users and broader accounting features otherwise make it the safer operational platform.

**Claude:** **Buy Northdesk, but only after two checks.** First, confirm that five seats, or an affordable higher tier, covers everyone who needs billing access. Second, confirm CSV export can move the existing invoices. Its automatic reminders are the only feature in either listing tied directly to late payments.

**What would change my mind:** If Northdesk can't cover the team affordably, I'd consider Plainbook, but only if its sales team confirms automated overdue reminders in writing. If neither product passes, I'd hold off on buying and first agree on one owner and one process for invoicing.

**Gemini:** Buy **Northdesk**. Your urgent operational crisis is missing late payments; Northdesk explicitly automates chasing them and centralizes who owes what. You only need billing seats for ops or leadership, easily fitting its 5-user tier.

I would change my mind and switch to **Plainbook** only if:
1. All 10 team members genuinely require billing access and Northdesk cannot scale affordably, **and**
2. You confirm with Plainbook that it actually supports automated payment reminders. 

Without confirmed automated reminders, Plainbook simply cannot be recommended to solve your stated problem.

Usage: 133637 input tokens, 52432 output tokens.