export function inviteSecretFieldName(displayName: string): string {
  return `inviteSecret-${displayName}`;
}

export function readInviteSecret(formData: FormData, displayName: string): string {
  return String(formData.get(inviteSecretFieldName(displayName)) ?? "").trim();
}
