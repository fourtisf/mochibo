/**
 * PREVIEW ONLY (phase 1 and 2). Clearly labelled sample answers so the whole run flow can be
 * tried without an AI provider. Phase 3 replaces this with the streaming POST /runs endpoint.
 * The browser never calls an AI provider directly.
 */
import type { Language, SkillId } from "@orbis/shared";

export function sampleAnswer(skillId: SkillId, task: string, lang: Language): string {
  const T = (task || "").trim() || "your topic";
  const id = lang === "Indonesian";
  const s = T.length > 70 ? T.slice(0, 70) + "…" : T;
  const S: Record<SkillId, string> = {
    research: id
      ? `Ringkasan riset: ${s}\n\nYang sudah jelas\n- Gambaran umum topik dan pemain utamanya\n- Angka yang paling sering dikutip, dengan sumbernya\n\nYang belum pasti\n- Klaim yang hanya muncul di satu sumber\n- Data yang lebih tua dari 6 bulan\n\nPerlu dicek\n- Dokumen resmi atau explorer on-chain\n- Tanggal pengumuman terbaru`
      : `Research brief: ${s}\n\nWhat's clear\n- The overall picture and the main players\n- The most quoted numbers, with where they come from\n\nWhat's uncertain\n- Claims that only appear in one source\n- Data older than six months\n\nWhat to verify\n- Official docs or the on-chain explorer\n- The date of the latest announcement`,
    writer: id
      ? `Draf untuk: ${s}\n\nVersi 1 (santai)\nKami baru saja membuka sesuatu yang sudah lama kami kerjakan. Coba sekarang, kasih masukan, dan ikut bentuk versi berikutnya.\n\nVersi 2 (tegas)\nHari ini rilis. Tanpa daftar tunggu, tanpa biaya awal. Ini yang bisa kamu lakukan mulai sekarang.`
      : `Draft for: ${s}\n\nVersion 1 (warm)\nWe just opened something we've been building for a long time. Try it today, tell us what's missing, and help shape what comes next.\n\nVersion 2 (direct)\nIt's live. No waitlist, no upfront cost. Here's what you can do with it starting now.`,
    docqa: id
      ? `Jawaban berdasarkan teks yang kamu berikan:\n\n${s}\n\nTeks menyebutkan poin utama di bagian awal. Yang tidak dibahas: biaya, jadwal, dan siapa yang bertanggung jawab.`
      : `Answer based on the text you gave:\n\n${s}\n\nThe text states the main point near the start. What it does not cover: cost, timeline and who is responsible.`,
    summary: id
      ? `Intinya: ${s}\n\n- Poin paling penting ada di bagian awal\n- Ada satu risiko yang perlu diperhatikan\n- Langkah berikutnya sudah jelas\n- Satu angka kunci perlu dicek ulang`
      : `Takeaway: ${s}\n\n- The most important point comes first\n- There is one risk worth watching\n- The next step is clear\n- One key number needs double-checking`,
    translate: id
      ? `Terjemahan:\n\n"${s}"\n\nCatatan: istilah seperti "airdrop", "listing" dan "holder" dibiarkan dalam bahasa Inggris karena begitu dipakai sehari-hari.`
      : `Translation:\n\n"${s}"\n\nNote: terms like "airdrop", "listing" and "holder" stay in English because that's how people actually use them.`,
    ideas: id
      ? `Ide untuk: ${s}\n\n1. Tantangan 7 hari dengan hadiah kecil tiap hari\n2. Seri "di balik layar" dari tim\n3. Kolaborasi dengan satu komunitas yang mirip\n4. Leaderboard mingguan yang bisa dibagikan\n5. Thread edukasi dengan satu visual per poin\n6. Live session tanya jawab 20 menit`
      : `Ideas for: ${s}\n\n1. A 7-day challenge with a small daily reward\n2. A behind-the-scenes series from the team\n3. A collab with one similar community\n4. A shareable weekly leaderboard\n5. An explainer thread, one visual per point\n6. A 20-minute live Q&A`,
    code: id
      ? `Penjelasan sederhana:\n\nKode ini menerima input, mengecek apakah valid, lalu menyimpan hasilnya.\n\nCatatan teknis\n- Tidak ada pengecekan saat input kosong\n- Error ditangkap tapi tidak dicatat\n\nRisiko\n- Baris yang mengubah saldo perlu dicek ulang sebelum deploy`
      : `In plain words:\n\nThis code takes an input, checks that it's valid, then saves the result.\n\nTechnical notes\n- No check for empty input\n- Errors are caught but not logged\n\nRisk\n- The line that changes balances should be reviewed before deploy`,
    planner: id
      ? `Rencana untuk: ${s}\n\n1. Tentukan target yang bisa diukur (hari ini)\n2. Bagi tugas: konten, teknis, komunitas\n3. Siapkan aset dan cek ulang (hari 2 sampai 4)\n4. Soft launch ke grup kecil (hari 5)\n5. Rilis penuh dan pantau 48 jam\n\nLangkah pertama hari ini: tulis satu kalimat target.`
      : `Plan for: ${s}\n\n1. Set one measurable goal (today)\n2. Split work: content, tech, community\n3. Prepare assets and review (days 2 to 4)\n4. Soft launch to a small group (day 5)\n5. Full launch, then watch for 48 hours\n\nFirst step today: write the goal in one sentence.`,
  };
  return S[skillId];
}
