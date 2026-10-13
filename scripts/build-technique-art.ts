import { writeFileSync } from 'node:fs';
import { TECHNIQUES } from '../src/domain/techniques.ts';

// Original line symbols depict combat identities. People, scenes and physical
// relics use raster art; these small UI glyphs remain readable at 40 px.
const gestures: Record<string, string> = {
    pierce: 'M16 44L43 17 38 31 31 38ZM20 36L28 44M32 20L42 30',
    multi_hit: 'M16 40L34 18M25 44L43 22M34 47L49 29M15 30L22 23',
    execute: 'M20 18L44 42M44 18L20 42M26 42L32 48 38 42M32 13V20',
    risk_burst: 'M19 45L41 19 37 32 29 40ZM15 18L23 24M44 40L49 46M36 14L39 10',
    sword_domain: 'M32 16V46M24 23L32 16 40 23M24 39H40M16 32A16 16 0 0 1 48 32M16 38H21M43 38H48',
    guard_stack: 'M32 15L46 22V32Q46 43 32 49Q18 43 18 32V22ZM24 29H40M24 35H40',
    persistent_shield: 'M32 16L46 23V32Q46 43 32 48Q18 43 18 32V23ZM32 23V40M24 32H40',
    reflect: 'M16 23H32Q43 23 43 34Q43 44 28 44M29 38L23 44 29 50M19 18L14 23 19 28',
    consume_guard: 'M15 35H29L32 18 37 35H49M21 43L32 48 43 43M32 37V43',
    guard_conversion: 'M19 18V32Q19 43 32 48Q45 43 45 32V18M23 30H40M35 24L41 30 35 36M27 20H37',
    life_steal: 'M32 14Q14 34 22 44Q32 52 42 44Q50 34 32 14ZM26 37H38M32 31V43',
    blood_cost: 'M26 16Q13 32 23 41Q32 45 35 34M34 24L45 13M40 13H45V18M34 42L43 47',
    bleed: 'M22 15Q12 29 20 36Q28 40 31 31M38 29Q28 43 36 49Q44 53 47 44M25 41L29 47',
    low_hp_burst: 'M19 34L27 28 31 40 38 17 44 34M15 34H19M44 34H49M26 47L32 43 38 47',
    max_hp_trade: 'M17 22Q24 18 32 22Q40 26 47 22M17 32Q24 28 32 32Q40 36 47 32M17 42Q24 38 32 42Q40 46 47 42M32 12V18',
    illusion_guard: 'M32 17Q23 17 23 27Q23 36 32 36Q41 36 41 27Q41 17 32 17ZM17 48Q17 38 32 38Q47 38 47 48M15 22L19 18M45 18L49 22',
    illusion_heal: 'M29 15Q16 21 20 34Q24 46 38 45Q27 38 26 30Q25 22 29 15M39 21V33M33 27H45',
    illusion_strike: 'M22 16Q13 31 22 44M42 16Q51 31 42 44M20 45L42 19M28 41L34 47',
    illusion_dodge: 'M19 23Q28 15 36 21M45 41Q36 49 28 43M30 17L36 21 31 26M34 38L28 43 34 47M20 39L44 25',
    dispel: 'M25 16A17 17 0 0 0 25 48M39 16A17 17 0 0 1 39 48M27 27L37 37M37 27L27 37',
    foresight: 'M13 32Q32 12 51 32Q32 52 13 32ZM32 24A8 8 0 1 1 31.9 24M32 13V18M32 46V51',
    delayed_mark: 'M32 16L48 32 32 48 16 32ZM32 24V33L38 37M20 20L16 16',
    intent_conversion: 'M16 20H37L32 15M37 20L32 25M48 44H27L32 39M27 44L32 49M22 25L42 39',
    mark_combo: 'M17 37L22 23 36 18 47 28 42 43 28 47ZM22 23L42 43M17 37L47 28M28 47L36 18',
    intent_swap: 'M16 23H45M39 17L45 23 39 29M48 41H19M25 35L19 41 25 47M32 29V35',
    rank_rescue: 'M32 16L41 22 37 30 45 37 32 49 19 37 27 30 23 22ZM26 37H38M32 31V43',
    bounded_hp_steal: 'M23 16Q12 30 20 38Q26 44 32 37M41 48Q52 34 44 26Q38 20 32 27M26 31H39M34 26L39 31 34 36',
    near_death_burst: 'M32 16A13 13 0 1 1 31.9 16M32 13V8M18 19L14 15M46 19L50 15M17 48H47M32 38V48',
    actual_hp_reflect: 'M16 26Q23 17 32 29Q41 17 48 26Q51 35 32 48Q13 35 16 26M21 32H43M38 27L43 32 38 37',
    bounded_copy: 'M18 17H35V38H18ZM29 26H46V47H29M23 22H30M34 41H41',
    seal: 'M20 19H44V45H20ZM20 26H44M26 19V45M38 19V45M27 31L37 39M37 31L27 39',
    death_mark: 'M32 17L46 26V40L32 48 18 40V26ZM24 31H40M24 36H40M24 41H40',
    reverse_buff: 'M43 20A18 18 0 1 0 45 41M43 13V22H34M27 28L35 36M35 28L27 36',
    loadout_exchange: 'M17 19H30V32H17ZM34 32H47V45H34M36 20H46L41 15M46 20L41 25M28 44H18L23 39',
    virtual_armor: 'M18 18L32 13 46 18V32Q46 44 32 49Q18 44 18 32ZM24 23L32 20 40 23V31Q40 38 32 43Q24 38 24 31Z',
    bounded_max_hp: 'M19 44L43 18M21 36L28 43M15 23Q24 19 32 23Q40 27 49 23M15 32Q24 28 32 32',
    announced_damage: 'M19 44L42 19M20 36L27 43M13 21H27M21 15L27 21 21 27M43 35L49 41 43 47',
    bounded_echo: 'M20 43L35 20M17 36L24 41M34 29Q42 32 34 37M40 24Q53 32 40 42M17 19L21 15',
    four_seals: 'M21 18L27 24 21 30 15 24ZM43 18L49 24 43 30 37 24ZM21 36L27 42 21 48 15 42ZM43 36L49 42 43 48 37 42ZM32 25V40M27 32H37',
};

const records = TECHNIQUES.map(technique => {
    const gesture = gestures[technique.identity];
    if (!gesture) throw Error('Missing technique symbol: ' + technique.id);
    const path = 'web/assets/than-lo/technique-' + technique.id + '.svg';
    const palette: Record<string, [string, string]> = {
        'thien-kiem': ['#315d61', '#e7efec'], 'bat-diet': ['#81623c', '#f1e9da'],
        'u-minh': ['#824b53', '#f2e6e5'], 'thai-hu': ['#5a6080', '#ebeaf2'],
        'thien-co': ['#436c61', '#e6eee5'], forbidden: ['#79424b', '#eee0df'], outside: ['#675779', '#ebe5ed'],
    };
    const [ink, paper] = palette[technique.school ?? technique.kind]!;
    const border = technique.kind === 'heritage' ? '<circle cx="32" cy="32" r="28.5" stroke-width="1.2"/><path d="m32 2 3 4-3 4-3-4Z" fill="' + ink + '"/>'
        : technique.kind === 'forbidden' ? '<path d="M12 10H6V16M52 10H58V16M12 54H6V48M52 54H58V48" stroke-width="1.5"/>'
        : technique.kind === 'outside' ? '<path d="M9 12H15M49 12H55M9 52H15M49 52H55" stroke-width="1.5"/>' : '';
    writeFileSync(path, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="' + ink + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="58" height="58" rx="17" fill="' + paper + '" stroke="none"/><circle cx="32" cy="32" r="25.5" opacity=".22" stroke-width="1"/>' + border + '<path d="' + gesture + '"/></svg>\n');
    return { id: technique.id, identity: technique.identity, kind: technique.kind, school: technique.school,
        path, format: 'svg', creator: 'project-original', direction: 'cultivation-illustrated-v2', ink, paper, workflow: 'scripts/build-technique-art.ts' };
});
if (new Set(records.map(record => gestures[record.identity])).size !== TECHNIQUES.length) throw Error('Duplicate technique gestures');
writeFileSync('docs/art/technique-symbols.json', JSON.stringify(records, null, 2) + '\n');
process.stdout.write('Built ' + records.length + ' original technique symbols.\n');
