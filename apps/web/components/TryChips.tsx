import { SKILL_EXAMPLES, isSkillId } from "@orbis/shared";

/** Example tasks for the selected skill. Clicking one fills the task box. */
export function TryChips({ skillId, onPick }: { skillId: string; onPick: (task: string) => void }) {
  if (!isSkillId(skillId)) return null;
  return (
    <div className="try-row">
      <span>Try</span>
      {SKILL_EXAMPLES[skillId].map((t) => (
        <button key={t} type="button" className="chip try-chip" title={t} onClick={() => onPick(t)}>
          {t}
        </button>
      ))}
    </div>
  );
}
