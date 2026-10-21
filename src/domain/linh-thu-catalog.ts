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

type BeastForms = readonly [string, string, string, string];
// Source names identify existing assets only; they are never part of the app catalog.
const referenceFormsById = new Map<string, BeastForms>();

function species(
  rank: BeastRank,
  title: string,
  referenceForms: BeastForms,
  forms: BeastForms,
): BeastSpecies {
  const id = referenceForms[0].toLowerCase();
  referenceFormsById.set(id, Object.freeze(referenceForms));
  return Object.freeze({ id, rank, title, forms: Object.freeze(forms) });
}

/** Stable species IDs remain unchanged when names, skills or art are rebalanced. */
export const BEAST_CATALOG: readonly BeastSpecies[] = Object.freeze([
  species(
    'UR',
    'Khuyển Tam Diệm',
    ['Pyropup', 'Pyrohound', 'Hellhound', 'Pyrodaemon'],
    ['Hỏa Khuyển Con', 'Liệp Hỏa Khuyển', 'Ngục Hỏa Khuyển', 'Tam Diệm Ma Khuyển'],
  ),
  species(
    'UR',
    'Tinh Vẫn Cự Thú',
    ['Rubblet', 'Cobbledon', 'Rockzilla', 'Meteorax'],
    ['Tiểu Thạch Thú', 'Nham Giáp Thú', 'Cự Nham Thú', 'Tinh Vẫn Cự Thú'],
  ),
  species(
    'SSR',
    'Băng Nguyệt Linh Miêu',
    ['Frostnip', 'Frostpaw', 'Frostique', 'Frostluna'],
    ['Tiểu Tuyết Miêu', 'Băng Trảo Miêu', 'Hàn Sương Linh Miêu', 'Băng Nguyệt Linh Miêu'],
  ),
  species(
    'SSR',
    'Lôi Vương',
    ['Zappur', 'Electroar', 'Blitzmane', 'Stormlion'],
    ['Tiểu Lôi Sư', 'Điện Nha Sư', 'Lôi Đình Hùng Sư', 'Lôi Vương'],
  ),
  species(
    'SSR',
    'Huyễn Sắc Nhẫn Giả',
    ['Skinklet', 'Skinkoon', 'Ninjaguana', 'Hychroma'],
    ['Tiểu Tích Linh', 'Huyễn Sắc Tích', 'Ảnh Nhẫn Tích', 'Huyễn Sắc Nhẫn Giả'],
  ),
  species(
    'SSR',
    'Đấu Chiến Linh Hầu',
    ['Punchimp', 'Rockfu', 'Rockwu', 'Rockong'],
    ['Tiểu Quyền Hầu', 'Thạch Quyền Hầu', 'Võ Đạo Linh Hầu', 'Đấu Chiến Linh Hầu'],
  ),
  species(
    'SR',
    'Tinh Thạch Linh Ốc',
    ['Shardsnail', 'Gemsnail', 'Jewelsnail', 'Crystalsnail'],
    ['Tiểu Thạch Ốc', 'Bảo Thạch Ốc', 'Ngọc Giáp Linh Ốc', 'Tinh Thạch Linh Ốc'],
  ),
  species(
    'SR',
    'Hỏa Miêu',
    ['Flameow', 'Nekoflare', 'Silversear', 'Cinderclaw'],
    ['Tiểu Hỏa Miêu', 'Diễm Vĩ Miêu', 'Ngân Diễm Miêu', 'Tẫn Hỏa Linh Miêu'],
  ),
  species(
    'SR',
    'Lan Liêm',
    ['Manteeny', 'Stalkerix', 'Serrabloom', 'Orchitoria'],
    ['Tiểu Lan Đường', 'Tiềm Ảnh Đường', 'Hoa Nhận Đường', 'Lan Liêm Nữ Vương'],
  ),
  species(
    'SR',
    'Thiên Vân Dương',
    ['Fluffle', 'Nimbuzzy', 'Galewether', 'Cosmoram'],
    ['Tiểu Miên Dương', 'Vân Nhung Dương', 'Phong Vân Linh Dương', 'Thiên Vân Dương'],
  ),
  species(
    'SR',
    'Vực Hải Giáp Linh',
    ['Maskfry', 'Ospisces', 'Armorjaw', 'Dagondeep'],
    ['Tiểu Diện Ngư', 'Cốt Giáp Ngư', 'Thiết Hàm Ngư', 'Vực Hải Giáp Linh'],
  ),
  species(
    'SR',
    'Giáp Dực Kỵ Sĩ',
    ['Goonbug', 'Capobeetle', 'Donscarab', 'Beetleknight'],
    ['Tiểu Giáp Trùng', 'Thiết Giáp Trùng', 'Huyền Giáp Trùng', 'Giáp Dực Kỵ Sĩ'],
  ),
  species(
    'R',
    'Nghi Lễ Kim Trùng',
    ['Humbug', 'Humbleetle', 'Zenscarab', 'Hierotyrus'],
    ['Tiểu Kim Trùng', 'Khiêm Tâm Giáp', 'Thiền Tâm Kim Trùng', 'Nghi Lễ Kim Trùng'],
  ),
  species(
    'R',
    'Thời Mộng Linh Cú',
    ['Hootlet', 'Tikowl', 'Chronerva', 'Hypnostrix'],
    ['Tiểu Dạ Cú', 'Thời Khắc Cú', 'Thời Luân Linh Cú', 'Thời Mộng Linh Cú'],
  ),
  species(
    'R',
    'Cổ Thạch Linh Quy',
    ['Gibber', 'Turtuff', 'Rockshell', 'Terraton'],
    ['Tiểu Thạch Quy', 'Kiên Giáp Quy', 'Nham Giáp Linh Quy', 'Cổ Thạch Linh Quy'],
  ),
  species(
    'R',
    'Từ Giác Linh Lộc',
    ['Voltfawn', 'Sparkdoe', 'Zapantler', 'Magnedart'],
    ['Tiểu Điện Lộc', 'Tia Điện Lộc', 'Lôi Giác Linh Lộc', 'Từ Giác Linh Lộc'],
  ),
  species(
    'R',
    'Tinh Tú Linh Thỏ',
    ['Cheerling', 'Cheerlet', 'Cheerspring', 'Cheerstella'],
    ['Tiểu Hỷ Thỏ', 'Hoan Hỷ Thỏ', 'Xuân Hỷ Linh Thỏ', 'Tinh Tú Linh Thỏ'],
  ),
  species(
    'R',
    'Mộng Nấm Linh',
    ['Funglet', 'Trippet', 'Hyphoria', 'Ecstamira'],
    ['Tiểu Nấm Linh', 'Mê Mộng Nấm', 'Huyễn Mộng Nấm', 'Mộng Nấm Tiên Linh'],
  ),
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
  const referenceForms = referenceFormsById.get(id)!;
  return `docs/assets/linh-thu/reference/${entry.rank.toLowerCase()}/${id}/t${form}-${referenceForms[form - 1]!.toLowerCase()}.webp`;
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
