/** Normalize to a Twilio WhatsApp address (whatsapp:+E164). */
export function toWhatsAppAddress(raw, fallbackCountry = '27') {
  const value = String(raw || '').trim();
  if (!value) return null;

  if (value.toLowerCase().startsWith('whatsapp:')) {
    return toWhatsAppAddress(value.slice('whatsapp:'.length).trim(), fallbackCountry);
  }

  let digits = value.replace(/[^\d+]/g, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  if (!digits.startsWith('+')) {
    const only = digits.replace(/\D/g, '');
    if (only.startsWith(fallbackCountry)) digits = `+${only}`;
    else if (only.startsWith('0') && only.length >= 9) digits = `+${fallbackCountry}${only.slice(1)}`;
    else if (only.length >= 9) digits = `+${fallbackCountry}${only}`;
    else return null;
  }

  const e164 = `+${digits.replace(/\D/g, '')}`;
  if (e164.length < 11) return null;
  return `whatsapp:${e164}`;
}
