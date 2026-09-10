export function memberLabel(
  member: { displayName: string } | null | undefined,
  memberId?: string | null,
): string {
  if (member?.displayName) {
    return member.displayName;
  }
  if (memberId) {
    return "已退出";
  }
  return "未認領";
}
