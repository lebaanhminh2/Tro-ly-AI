// Deliberately narrow format: DD/MM/YYYY HH:mm, UTC+7. Never use Date.parse on natural language.
export function deadlineValue(raw: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const [day, month, year, hour, minute] = m.slice(1).map(Number) as [number, number, number, number, number];
  if (year < 2000 || year > 2100 || hour > 23 || minute > 59) return null;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00+07:00`;
}

/** Resolve every task deadline through one Vietnam-time rule. Date-only means 23:59. */
export function deadlineAt(value:string|null|undefined):number|null{
 if(!value)return null;
 const parsed=Date.parse(value.length===10?value+'T23:59:00+07:00':value);
 return Number.isFinite(parsed)?parsed:null;
}

export function ceilToMinutes(value:number,step=5):number{
 if(!Number.isFinite(value)||!Number.isInteger(step)||step<1)throw Error('INVALID_TIME');
 const unit=step*60000;
 return Math.ceil(value/unit)*unit;
}
