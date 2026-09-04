// Copies a production build into Sean's live vault. The ONLY path by which
// the live vault receives Taskflow builds — dev watch builds go to the dev
// vault (see esbuild.config.mjs). Run via `npm run deploy:prod`.
//
// Guards (bypass with `npm run deploy:prod -- --force`):
//   - must be on the production branch (default `main`, env TASKFLOW_PROD_BRANCH)
//   - working tree must be clean
// Then: npm test → npm run lint → npm run build → back up the current vault
// files as *.prev → copy → write .build-info → print the reload command.
// Undo with `npm run rollback:prod`.
import fs from 'fs'
import path from 'path'
import process from 'process'
import {execSync} from 'child_process'

const DEPLOYED_FILES = ['main.js', 'manifest.json', 'styles.css']
const BUILD_INFO = '.build-info'
const dir =
  process.env.TASKFLOW_PROD_PLUGIN_DIR ??
  path.join(
    process.env.HOME,
    'Library/Mobile Documents/iCloud~md~obsidian/Documents/obsidian-vault/.obsidian/plugins/taskflow',
  )

const git = (args) => execSync(`git ${args}`, {encoding: 'utf8'}).trim()
const run = (cmd) => {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, {stdio: 'inherit'})
}

const force = process.argv.includes('--force')
const prodBranch = process.env.TASKFLOW_PROD_BRANCH ?? 'main'
const branch = git('rev-parse --abbrev-ref HEAD')
const dirty = git('status --porcelain') !== ''

const problems = []
if (branch !== prodBranch) problems.push(`on branch "${branch}", production deploys come from "${prodBranch}"`)
if (dirty) problems.push('working tree has uncommitted changes')
if (problems.length) {
  for (const p of problems) console.error(`${force ? 'warning' : 'refusing to deploy'}: ${p}`)
  if (!force) {
    console.error('pass --force to deploy anyway: npm run deploy:prod -- --force')
    process.exit(1)
  }
}

run('npm test')
run('npm run lint')
run('npm run build')

if (!fs.existsSync('main.js')) {
  console.error('main.js not found after build')
  process.exit(1)
}

fs.mkdirSync(dir, {recursive: true})

// Keep the previous deploy so `npm run rollback:prod` is one command.
for (const file of [...DEPLOYED_FILES, BUILD_INFO]) {
  const current = path.join(dir, file)
  if (fs.existsSync(current)) fs.copyFileSync(current, `${current}.prev`)
}

for (const file of DEPLOYED_FILES) {
  fs.copyFileSync(file, path.join(dir, file))
}

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'))
const info = {
  version: manifest.version,
  commit: git('rev-parse --short HEAD'),
  branch,
  dirty,
  deployedAt: new Date().toISOString(),
}
fs.writeFileSync(path.join(dir, BUILD_INFO), JSON.stringify(info, null, 2) + '\n')

console.log(`\ndeployed ${info.version} (${info.commit}${dirty ? ', dirty' : ''}) → ${dir}`)
console.log('reload Obsidian to pick it up. `obsidian plugin:reload` can keep the old module running;')
console.log('the reliable hard cycle is:')
console.log(`  obsidian eval code="app.plugins.disablePlugin('taskflow').then(()=>app.plugins.enablePlugin('taskflow'))"`)
