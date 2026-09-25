import { XMLParser, XMLValidator } from 'fast-xml-parser';
import jsonValidator from 'json-dup-key-validator';
import type { ParcelInput, RowError } from '../shared/types.js';
import { object, validateParcel, ValidationError } from './domain.js';
export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_ROWS = 5000;
export function parseBatch(
  raw: Buffer,
  format: string,
  fallback = '',
  retainRecipient = false,
): { items: ParcelInput[]; errors: RowError[] } {
  if (raw.length > MAX_BYTES)
    throw new ValidationError('File exceeds 2 MiB. Split it into smaller batches.');
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  } catch {
    throw new ValidationError('The file must be UTF-8 encoded.');
  }
  let rows: unknown;
  if (format === 'json') {
    try {
      rows = JSON.parse(text);
      jsonValidator.parse(text, false);
    } catch {
      throw new ValidationError('Invalid JSON or duplicate JSON fields.');
    }
  } else if (format === 'xml') {
    if (/<!\s*(DOCTYPE|ENTITY)/i.test(text) || XMLValidator.validate(text) !== true)
      throw new ValidationError('Malformed XML or prohibited DTD/entity declaration.');
    try {
      const parsed = new XMLParser({
        ignoreAttributes: true,
        parseTagValue: false,
        processEntities: false,
        trimValues: true,
        isArray: (name) => name === 'Parcel',
      }).parse(text);
      const container = object(parsed.Container);
      const parcels = object(container.parcels);
      if (Object.keys(parcels).some((k) => k !== 'Parcel') || !Array.isArray(parcels.Parcel))
        throw new Error('schema');
      rows = parcels.Parcel.map((raw: unknown, i: number) => {
        const p = object(raw);
        if (['Weight', 'Value', 'Country'].some((k) => Array.isArray(p[k])))
          throw new Error('duplicate fields');
        const recipient =
          retainRecipient && p.Receipient && typeof p.Receipient === 'object'
            ? object(p.Receipient)
            : {};
        const address =
          recipient.Address && typeof recipient.Address === 'object'
            ? object(recipient.Address)
            : {};
        const attributes: Record<string, string> = {};
        if (typeof recipient.Name === 'string') attributes.recipient_name = recipient.Name;
        if (typeof address.City === 'string') attributes.recipient_city = address.City;
        return {
          attributes,
          reference: `${String(container.Id ?? 'XML').slice(0, 50)}-${i + 1}`,
          weight: p.Weight,
          value: p.Value,
          country: p.Country || fallback,
        };
      });
    } catch {
      throw new ValidationError(
        'XML must contain Container/parcels/Parcel with unambiguous Weight, Value and Country fields.',
      );
    }
  } else throw new ValidationError('Choose a .json or .xml file.');
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > MAX_ROWS)
    throw new ValidationError('Batch must contain an array of 1–5,000 parcels.');
  const items: ParcelInput[] = [],
    errors: RowError[] = [];
  rows.forEach((row, i) => {
    try {
      items.push(validateParcel(row));
    } catch (error) {
      errors.push({ row: i + 1, message: error instanceof Error ? error.message : 'Invalid row.' });
    }
  });
  return { items, errors };
}
