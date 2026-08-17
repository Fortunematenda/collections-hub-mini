export function defaultTeams(companyId) {
  return [
    'Collections',
    'Payment Verification',
    'Billing Review',
    'Retention',
    'Recovery',
    'Technical Support',
  ].map((name, index) => ({
    id: `team-${companyId}-${index + 1}`,
    companyId,
    name,
    memberNames: [],
    memberUserIds: [],
    active: true,
    createdAt: new Date().toISOString(),
  }));
}

export function teamMemberPool(rule, teams = []) {
  const team = (teams || []).find(
    (item) => item && item.id === rule?.assigneeTeamId && item.active !== false && (!rule?.companyId || item.companyId === rule.companyId),
  );
  const fromTeam = (team?.memberNames || []).map((name) => String(name || '').trim()).filter(Boolean);
  if (fromTeam.length) return fromTeam;
  return (rule?.assigneeNames || []).map((name) => String(name || '').trim()).filter(Boolean);
}
