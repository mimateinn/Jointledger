export type ClaimableMember = {
  id: string;
  displayName: string;
  email: string | null;
  userId: string | null;
};

export function matchClaimableMember(
  members: ClaimableMember[],
  identifier: string,
): ClaimableMember | null {
  const raw = identifier.trim();
  if (!raw) {
    return null;
  }
  const lowered = raw.toLowerCase();
  return (
    members.find(
      (row) =>
        !row.userId &&
        (row.displayName === raw || (row.email != null && row.email.toLowerCase() === lowered)),
    ) ?? null
  );
}
