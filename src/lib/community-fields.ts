/** Browser feedback only; the separate Functions package validates every request again. No HTML, control or bidi override characters. */
export function firstName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('INVALID_NAME');
  const name = value.normalize('NFC').trim().replace(/ +/g, ' ');
  if (
    [...name].length < 1 ||
    [...name].length > 40 ||
    !/^[\p{L}][\p{L}\p{M} '\u2019-]*$/u.test(name)
  )
    throw new Error('INVALID_NAME');
  return name;
}
export function shortNote(value: unknown): string {
  if (typeof value !== 'string') throw new Error('INVALID_NOTE');
  const note = value.normalize('NFC').trim();
  if ([...note].length > 120 || /[<>\p{Cc}\p{Cf}]/u.test(note))
    throw new Error('INVALID_NOTE');
  return note;
}
