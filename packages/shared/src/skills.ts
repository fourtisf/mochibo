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
  { name: "Bahasa bridge", text: "Translate naturally between English and Indonesian. Keep slang and crypto terms the way people actually say them.", skills: ["translate", "writer"] },
];
