/* Turns one checklist template (the owner's JSON) into SQL for Supabase's
   SQL Editor.

   Run with:
     npm run checklist-sql -- content/checklists/bw-medico_drittstaat.json

   It writes supabase/content/<same name>.sql, e.g.
   supabase/content/bw-medico_drittstaat.sql, or stops with a list of the
   problems it found (and writes nothing). The rules are explained in
   scripts/checklistTemplate.ts. Node.js 22 runs this TypeScript file
   directly. */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { checkTemplate, toSql } from './checklistTemplate.ts'

const input = process.argv[2]
if (!input) {
  console.error('Which template? Example:\n  npm run checklist-sql -- content/checklists/bw-medico_drittstaat.json')
  process.exit(1)
}

let data: unknown
try {
  data = JSON.parse(readFileSync(input, 'utf8'))
} catch (e) {
  console.error(`Could not read ${input} as JSON: ${(e as Error).message}`)
  process.exit(1)
}

const fileName = basename(input)
const { plan, problems } = checkTemplate(data, fileName)
if (!plan) {
  console.error(`${fileName}: ${problems.length} problem(s), nothing was written:`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}

const outDir = join('supabase', 'content')
mkdirSync(outDir, { recursive: true })
const outFile = join(outDir, fileName.replace(/\.json$/, '.sql'))
writeFileSync(outFile, toSql(plan))

const inEnvelope = plan.items.filter((i) => i.sobreOrder !== null).length
const naDefault = plan.items.filter((i) => i.naDefault).length
console.log(`Wrote ${outFile}`)
console.log(`  ${plan.target.state} + ${plan.target.route}: ${plan.items.length} steps, ${inEnvelope} in the envelope, ${naDefault} "no aplica" by default`)
