// fetch-rolepack-data.cjs — pulls full curator-published content for the 3
// target rolepacks (AML, Front Desk, Video Editor) from prod D1 and writes a
// single rolepack-data.json next to this script. Read-only.
//
// Usage from C:\AI\RoleMaster:
//   node decks\fetch-rolepack-data.cjs
//
// Requires: wrangler authenticated locally (you've been deploying with it,
// so you should already be logged in).

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const DB = 'rolemaster-db';
const RP_IDS = ['RP-DA2PFM51', 'RP-REOAL8S0', 'RP-IRBHUNVH'];
const inList = RP_IDS.map(id => `'${id}'`).join(',');

function d1(sql) {
  const cmd = `npx wrangler d1 execute ${DB} --remote --json --command="${sql.replace(/"/g, '\\"')}"`;
  console.log('>', sql.slice(0, 80) + (sql.length > 80 ? '…' : ''));
  const out = execSync(cmd, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  // wrangler emits a JSON array with one element { results: [...] }.
  const parsed = JSON.parse(out);
  return parsed[0]?.results || [];
}

const rolepacks = d1(
  `SELECT rp.id, rp.rp_label, rp.name_zh, rp.name_en,
          rp.industry_json, rp.company_size_json, rp.department_json,
          rp.questionnaire_json, rp.generated_json, rp.materials_draft_json,
          rp.intake_id, rp.updated_at
   FROM rolepacks_v2 rp
   WHERE rp.id IN (${inList})`
);

const capLinks = d1(
  `SELECT rc.rolepack_id, rc.position, c.id AS cap_id, c.rc_label,
          c.name_zh, c.name_en, c.description_zh, c.description_en
   FROM rolepack_capabilities rc
   JOIN capabilities c ON c.id = rc.capability_id
   WHERE rc.rolepack_id IN (${inList})
   ORDER BY rc.rolepack_id, rc.position`
);

const intakeIds = [...new Set(rolepacks.map(r => r.intake_id).filter(Boolean))];
const intakeInList = intakeIds.map(id => `'${id}'`).join(',');
const pricing = intakeIds.length
  ? d1(`SELECT id AS intake_id, service_pricing_json FROM intakes WHERE id IN (${intakeInList})`)
  : [];

const out = { rolepacks, capLinks, pricing, fetched_at: new Date().toISOString() };
const outPath = path.join(__dirname, 'rolepack-data.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`\nWrote ${outPath}`);
console.log(`  rolepacks: ${rolepacks.length}`);
console.log(`  cap links: ${capLinks.length}`);
console.log(`  pricing rows: ${pricing.length}`);
