import {
  rollSummonRank,
  randomUnit,
  type BeastForm,
  type BeastPity,
  type BeastRank,
} from './linh-thu.ts';

export type BeastSpecies = Readonly<{
  id: string;
  rank: BeastRank;
  title: string;
  forms: readonly [string, string, string, string];
}>;

function species(
  rank: BeastRank,
  title: string,
  forms: [string, string, string, string],
): BeastSpecies {
  return Object.freeze({ id: forms[0].toLowerCase(), rank, title, forms: Object.freeze(forms) });
}

/** Stable species IDs remain unchanged when names, skills or art are rebalanced. */
export const BEAST_CATALOG: readonly BeastSpecies[] = Object.freeze([
  species('UR', 'Khuyển Tam Diệm', ['Pyropup', 'Pyrohound', 'Hellhound', 'Pyrodaemon']),
  species('UR', 'Tinh Vẫn Cự Thú', ['Rubblet', 'Cobbledon', 'Rockzilla', 'Meteorax']),
  species('SSR', 'Băng Nguyệt Linh Miêu', ['Frostnip', 'Frostpaw', 'Frostique', 'Frostluna']),
  species('SSR', 'Lôi Vương', ['Zappur', 'Electroar', 'Blitzmane', 'Stormlion']),
  species('SSR', 'Huyễn Sắc Nhẫn Giả', ['Skinklet', 'Skinkoon', 'Ninjaguana', 'Hychroma']),
  species('SSR', 'Đấu Chiến Linh Hầu', ['Punchimp', 'Rockfu', 'Rockwu', 'Rockong']),
  species('SR', 'Tinh Thạch Linh Ốc', ['Shardsnail', 'Gemsnail', 'Jewelsnail', 'Crystalsnail']),
  species('SR', 'Hỏa Miêu', ['Flameow', 'Nekoflare', 'Silversear', 'Cinderclaw']),
  species('SR', 'Lan Liêm', ['Manteeny', 'Stalkerix', 'Serrabloom', 'Orchitoria']),
  species('SR', 'Thiên Vân Dương', ['Fluffle', 'Nimbuzzy', 'Galewether', 'Cosmoram']),
  species('SR', 'Vực Hải Giáp Linh', ['Maskfry', 'Ospisces', 'Armorjaw', 'Dagondeep']),
  species('SR', 'Giáp Dực Kỵ Sĩ', ['Goonbug', 'Capobeetle', 'Donscarab', 'Beetleknight']),
  species('R', 'Nghi Lễ Kim Trùng', ['Humbug', 'Humbleetle', 'Zenscarab', 'Hierotyrus']),
  species('R', 'Thời Mộng Linh Cú', ['Hootlet', 'Tikowl', 'Chronerva', 'Hypnostrix']),
  species('R', 'Cổ Thạch Linh Quy', ['Gibber', 'Turtuff', 'Rockshell', 'Terraton']),
  species('R', 'Từ Giác Linh Lộc', ['Voltfawn', 'Sparkdoe', 'Zapantler', 'Magnedart']),
  species('R', 'Tinh Tú Linh Thỏ', ['Cheerling', 'Cheerlet', 'Cheerspring', 'Cheerstella']),
  species('R', 'Mộng Nấm Linh', ['Funglet', 'Trippet', 'Hyphoria', 'Ecstamira']),
]);

export function beastSpecies(id: string): BeastSpecies {
  const found = BEAST_CATALOG.find((entry) => entry.id === id);
  if (!found) throw Error('INVALID_BEAST_SPECIES');
  return found;
}

/** Reference paths are deliberately separate from future production-art paths. */
export function beastReferencePath(id: string, form: BeastForm): string {
  const entry = beastSpecies(id);
  if (![1, 2, 3, 4].includes(form)) throw Error('INVALID_BEAST_FORM');
  return `docs/assets/linh-thu/reference/${entry.rank.toLowerCase()}/${id}/t${form}-${entry.forms[form - 1]!.toLowerCase()}.webp`;
}

export function rollBeast(
  pity: BeastPity,
  random: () => number,
  excluded: readonly string[] = [],
): BeastSpecies {
  const rank = rollSummonRank(pity, random);
  const pool = BEAST_CATALOG.filter((entry) => entry.rank === rank);
  const remaining = pool.filter((entry) => !excluded.includes(entry.id));
  const candidates = remaining.length ? remaining : pool;
  return candidates[Math.floor(randomUnit(random) * candidates.length)]!;
}

/** Pyrodaemon samples one pre-draw table. Only the later choice advances pity. */
export function rollPyroCandidates(pity: BeastPity, random: () => number): readonly BeastSpecies[] {
  const candidates: BeastSpecies[] = [];
  for (let i = 0; i < 3; i++)
    candidates.push(
      rollBeast(
        pity,
        random,
        candidates.map((entry) => entry.id),
      ),
    );
  return candidates;
}
