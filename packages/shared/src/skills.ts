export const SKILL_CATEGORIES = ["Research", "Writing", "Knowledge", "Language", "Creative", "Code", "Planning"] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export const CATEGORY_COLOR: Record<SkillCategory, string> = {
  Research: "#7CC8FF",
  Writing: "#FF8FB8",
  Knowledge: "#8B7CFF",
  Language: "#6EF0D2",
  Creative: "#FFB38A",
  Code: "#FFE27A",
  Planning: "#CFC6FF",
};

export const SKILL_IDS = ["research", "writer", "docqa", "summary", "translate", "ideas", "code", "planner"] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export interface Skill {
  id: SkillId;
  name: string;
  cat: SkillCategory;
  desc: string;
  /** Appended to the system prompt on the server. */
  prompt: string;
}

export const SKILLS: readonly Skill[] = [
  { id: "research", name: "Web research", cat: "Research", desc: "A short brief with sources to check and open questions.", prompt: "Write a research brief: key facts, what is uncertain, and what to verify." },
  { id: "writer", name: "Content writer", cat: "Writing", desc: "Posts, threads, announcements and landing copy.", prompt: "Write the requested content, ready to publish." },
  { id: "docqa", name: "Document Q&A", cat: "Knowledge", desc: "Answers questions about text you paste in.", prompt: "Answer using only the text provided. Say when the text does not cover it." },
  { id: "summary", name: "Summarizer", cat: "Knowledge", desc: "Turns long text into the points that matter.", prompt: "Summarize into a one-line takeaway and 3 to 5 key points." },
  { id: "translate", name: "Translator", cat: "Language", desc: "Natural translation that keeps slang and terms.", prompt: "Translate naturally, keeping crypto terms and slang as people actually say them." },
  { id: "ideas", name: "Idea generator", cat: "Creative", desc: "Names, angles, hooks and campaign ideas.", prompt: "Give 6 distinct ideas, each with a one-line reason." },
  { id: "code", name: "Code explainer", cat: "Code", desc: "Explains code in plain words and flags risky lines.", prompt: "Explain the code in plain language first, then technical notes and risks." },
  { id: "planner", name: "Task planner", cat: "Planning", desc: "Breaks a goal into ordered steps with owners.", prompt: "Turn the goal into an ordered plan with steps, owners and a first action for today." },
];

export const SKILL_BY_ID: Readonly<Record<SkillId, Skill>> = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<SkillId, Skill>;

export function isSkillId(v: string): v is SkillId {
  return (SKILL_IDS as readonly string[]).includes(v);
}

export interface Template {
  name: string;
  text: string;
  skills: SkillId[];
}

export const TEMPLATES: readonly Template[] = [
  { name: "Research companion", text: "Research carefully. Separate facts from opinions, say how sure you are, and end with what to verify.", skills: ["research", "summary", "docqa"] },
  { name: "Content co-pilot", text: "Write in short, clear sentences. Offer two versions when tone matters. Never invent quotes or numbers.", skills: ["writer", "ideas", "summary"] },
  { name: "Code buddy", text: "Explain code step by step for a non-coder first, then add the technical detail. Flag anything risky.", skills: ["code", "planner", "summary"] },
  { name: "Translator", text: "Translate naturally into the language the user asks for. Keep slang and crypto terms the way people actually say them.", skills: ["translate", "writer"] },
];

/** Ready-made tasks shown under the task box, so new users see what each skill can do. */
export const SKILL_EXAMPLES: Readonly<Record<SkillId, readonly string[]>> = {
  research: [
    "What is Robinhood Chain, and what should I check before using it?",
    "Brief me on tokenized stocks: how they work and the main risks.",
    "Compare three popular ways to build an AI agent today.",
  ],
  writer: [
    "Write a launch tweet for my AI agent, under 280 characters.",
    "Write a 4-post X thread announcing a new feature.",
    "Rewrite this bio so it sounds friendly: I build tools for creators.",
  ],
  docqa: [
    "Text: Refunds are possible within 14 days if the item is unused. Question: Can I return a used item?",
    "Text: 10% of tokens unlock at launch, the rest monthly over 12 months. Question: How much unlocks at launch?",
    "Text: The event starts at 6 PM UTC and lasts two hours. Question: When does it end?",
  ],
  summary: [
    "Summarize: Mochibo lets anyone build an AI agent with a 3D body, give it skills, run tasks and earn when others use it.",
    "Summarize the key steps of a good product launch.",
    "Summarize the pros and cons of working remotely.",
  ],
  translate: [
    "Translate to Spanish: Welcome to Mochibo, build your first agent today!",
    "Translate to Japanese: Thank you for joining our community.",
    "Translate to French: The preview is live, try the studio now.",
  ],
  ideas: [
    "Give me names for a cute AI pet app.",
    "Ideas for a weekly community event on X.",
    "Hooks for a short video about AI agents.",
  ],
  code: [
    "Explain this JavaScript: const total = items.reduce((sum, x) => sum + x.price, 0);",
    "Explain this Solidity line: require(msg.sender == owner, \"Not owner\");",
    "Explain what this does: SELECT name FROM users WHERE created_at > NOW() - INTERVAL '7 days';",
  ],
  planner: [
    "Plan a 7-day launch for a new app.",
    "Plan my week to learn basic coding in 30 minutes a day.",
    "Plan a community giveaway on X, from idea to winner announcement.",
  ],
};
