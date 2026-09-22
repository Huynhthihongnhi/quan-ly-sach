export function hasPermission(permissionCodes: readonly string[], required: string): boolean {
  return permissionCodes.includes(required);
}

export function hasAnyPermission(
  permissionCodes: readonly string[],
  required: readonly string[],
): boolean {
  return required.some((code) => permissionCodes.includes(code));
}
