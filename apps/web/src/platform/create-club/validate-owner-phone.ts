export function validateOwnerPhoneClient(phone: string): string | null {
  const value = phone.trim();
  if (value.length < 8) {
    return "Owner phone is required";
  }
  return null;
}
