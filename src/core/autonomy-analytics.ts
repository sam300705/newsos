export interface AutonomyDecisionRow {
  systemDecision: string;
  editorDecision: string | null | undefined;
}

export function summarizeAutonomyDecisions(rows: AutonomyDecisionRow[]) {
  const reviewedRows = rows.filter((row) => Boolean(row.editorDecision));
  let disagreements = 0;
  for (const row of reviewedRows) {
    const systemWouldPublish = row.systemDecision === "WOULD_AUTO_PUBLISH" || row.systemDecision === "AUTO_PUBLISH";
    const editorApproved = row.editorDecision === "APPROVED";
    if (systemWouldPublish !== editorApproved) disagreements++;
  }
  return {
    total: rows.length,
    reviewed: reviewedRows.length,
    disagreements,
    disagreementRate: reviewedRows.length ? disagreements / reviewedRows.length : 0,
  };
}
