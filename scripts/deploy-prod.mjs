// Copies a production build into Sean's live vault. The ONLY path by which
// the live vault receives Taskflow builds — dev watch builds go to the dev
// vault (see esbuild.config.mjs). Run via `npm run deploy:prod`.
import fs from 'fs'
import path from 'path'
import process from 'process'

const prodPluginDir =
  process.env.TASKFLOW_PROD_PLUGIN_DIR ??
  path.join(
    process.env.HOME,
    'Library/Mobile Documents/iCloud~md~obsidian/Documents/obsidian-vault/.obsidian/plugins/taskflow',
  )

if (!fs.existsSync('main.js')) {
  console.error('main.js not found — run `npm run build` first (deploy:prod does this for you)')
  process.exit(1)
}

fs.mkdirSync(prodPluginDir, {recursive: true})
for (const file of ['main.js', 'manifest.json', 'styles.css']) {
  fs.copyFileSync(file, path.join(prodPluginDir, file))
}
console.log(`deployed → ${prodPluginDir}`)
console.log('reload Obsidian (or toggle the plugin) to pick it up')
