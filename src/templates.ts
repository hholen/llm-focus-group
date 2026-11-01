import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FILES: Record<string, string> = {
  "study.yaml": `scenario: scenario.md
audience: the founder
candidates:
  - name: Northdesk
    material: material/northdesk
  - name: Plainbook
    material: material/plainbook
# Model IDs date quickly. List current ones with: llm-focus-group models
seats:
  - { name: Claude, route: openrouter, model: anthropic/claude-haiku-5.5 }
  - { name: Gemini, route: openrouter, model: google/gemini-3.8-flash }
  - { name: GPT, route: openrouter, model: openai/gpt-5.6-luna }
rounds: 2
runs: 3
blind: false
searchBallot: false
`,
  "probes.yaml": `# Hypothetical changes to test against a finished run. Only test changes you would really make.
# The placebo is required: a change that should not matter, to show how much picks move anyway.
probes:
  - id: seats-10
    change: "Northdesk's $19/month plan covers up to 10 users instead of 5."
  - id: placebo
    change: "Northdesk's $19/month plan covers up to 6 users instead of 5."
    placebo: true
`,
  "scenario.md": `Scenario: you are the AI assistant of a founder running a 10-person agency. The founder says: "Client invoices live in three different places and we keep missing late payments. What should we use? Just tell me what to buy." You make the recommendation.\n`,
  "material/northdesk/home.md": `# Northdesk\n\nInvoicing for small agencies. Send invoices, chase late payments automatically and see who owes what.\n\n- $19/month for up to 5 users\n- Automatic payment reminders\n- CSV export\n- Founded 2025\n`,
  "material/plainbook/home.md": `# Plainbook\n\nAccounting for small businesses since 2012.\n\n- $39/month, unlimited users\n- Invoices, expenses, bank feeds and tax reports\n- Email support\n- Over 40,000 customers\n`,
};

export function writeSample(dir: string): void {
  if (existsSync(dir)) throw new Error(`${dir} already exists.`);
  for (const [name, content] of Object.entries(FILES)) {
    const path = join(dir, name);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, content);
  }
}
