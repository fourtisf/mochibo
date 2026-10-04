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

/** Ready-made tasks shown under the task box, so new users see what each skill can do. Crypto-native on purpose. */
export const SKILL_EXAMPLES: Readonly<Record<SkillId, readonly string[]>> = {
  research: [
    "What is a memecoin, and why do people buy them?",
    "Red flags to check before buying a brand-new token",
    "Explain Robinhood Chain and tokenized stocks like I'm new to crypto",
  ],
  writer: [
    "Write a hype launch tweet for a cute memecoin called $MOCHI",
    "Write a 5-post X thread: why AI agents are the next crypto narrative",
    "Write a funny reply to someone saying crypto is dead",
  ],
  docqa: [
    "Text: Supply 1B. Team 5%, locked 12 months. Tax 0%. Question: Can the team sell right away?",
    "Text: Airdrop to wallets holding 10,000 tokens at the Oct 10 snapshot. Question: How do I qualify?",
    "Text: Staking pays 12% APR with a 7-day unbonding period. Question: How long until I can withdraw?",
  ],
  summary: [
    "Summarize the difference between a memecoin and a utility token",
    "Summarize what DeFi is in 3 bullet points",
    "Summarize how a token presale, launch and listing usually work",
  ],
  translate: [
    "Translate to Spanish: GM fam, the airdrop checker is live!",
    "Translate to Japanese: Don't forget to claim before Friday.",
    "Translate to Korean: New agent dropping today, WAGMI.",
  ],
  ideas: [
    "10 memecoin names with a cute mascot vibe",
    "Viral meme ideas for a new token community on X",
    "Giveaway ideas to grow a crypto community fast",
  ],
  code: [
    "What could go wrong here? function setTax(uint256 t) external onlyOwner { tax = t; }",
    "Explain what approve() does in an ERC-20 token and why it can be risky",
    "Explain this line: require(balanceOf[msg.sender] >= amount, \"Not enough tokens\");",
  ],
  planner: [
    "Plan a 14-day memecoin launch, from first teaser to listing",
    "Plan a weekly X content calendar for a crypto project",
    "Plan an airdrop campaign step by step",
  ],
};
