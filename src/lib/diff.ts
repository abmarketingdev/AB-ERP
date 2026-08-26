export type DiffPart = { text: string; kind: "same" | "added" | "removed" };

/**
 * The same diff, split into the two lines a reader actually compares.
 *
 * Inline diffs work for code, where insertions and deletions rarely interleave
 * mid-token. For a one-sentence rule they do interleave — "i perioden" → "ved
 * periodeslutt" produced `~~i~~ ~~perioden~~ved periodeslutt`, with the removed
 * and added words colliding. Two labelled rows say the same thing without
 * asking the reader to mentally un-weave them.
 */
export function splitDiff(before: string, after: string): { before: DiffPart[]; after: DiffPart[] } {
  const parts = wordDiff(before, after);
  return {
    before: parts.filter((p) => p.kind !== "added"),
    after: parts.filter((p) => p.kind !== "removed"),
  };
}

/**
 * Word-level diff between two rule texts — FR-K-03.
 *
 * A version list that shows only version numbers and dates is a changelog
 * nobody can check: the question an auditor actually asks is "what words
 * changed, and does the new wording still mean what the old figures assumed".
 * So the diff is on words, not characters — character diffs on prose produce
 * unreadable confetti — and it renders inline rather than as two columns,
 * because these rules are one sentence long and side-by-side would make the
 * reader do the comparison themselves.
 *
 * Plain longest-common-subsequence. The texts here are a sentence; anything
 * cleverer would be weight for no gain.
 */
export function wordDiff(before: string, after: string): DiffPart[] {
  const a = before.split(/(\s+)/).filter(Boolean);
  const b = after.split(/(\s+)/).filter(Boolean);

  // lcs[i][j] = length of the longest common subsequence of a[i:] and b[j:]
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const parts: DiffPart[] = [];
  const push = (text: string, kind: DiffPart["kind"]) => {
    // Whitespace is never "changed". Marking a space as removed strikes it
    // through, which renders as nothing, and the words either side collide —
    // "i perioden" → "ved periodeslutt" came out as "ived periodenperiodeslutt".
    const k = text.trim() === "" ? "same" : kind;
    const last = parts[parts.length - 1];
    if (last && last.kind === k) last.text += text;
    else parts.push({ text, kind: k });
  };

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push(a[i], "same");
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push(a[i], "removed");
      i++;
    } else {
      push(b[j], "added");
      j++;
    }
  }
  while (i < a.length) push(a[i++], "removed");
  while (j < b.length) push(b[j++], "added");

  return parts;
}
