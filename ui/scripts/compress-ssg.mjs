/**
 * Re-compress all dist HTML files after SSG injection.
 * Vite's compression plugin runs before prerender.mjs fills in content,
 * so the .br/.gz files end up stale. This script fixes them.
 */
import { writeFile, readFile, readdir, stat } from 'node:fs/promises'
import { createBrotliCompress, createGzip, constants } from 'node:zlib'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

async function findHtml(dir, results = []) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) await findHtml(full, results)
    else if (e.name.endsWith('.html')) results.push(full)
  }
  return results
}

async function compress(filePath) {
  const src = await readFile(filePath)

  await new Promise((res, rej) => {
    const chunks = []
    const br = createBrotliCompress({ params: { [constants.BROTLI_PARAM_QUALITY]: 11 } })
    br.on('data', c => chunks.push(c))
    br.on('end', () => writeFile(filePath + '.br', Buffer.concat(chunks)).then(res, rej))
    br.on('error', rej)
    br.end(src)
  })

  await new Promise((res, rej) => {
    const chunks = []
    const gz = createGzip({ level: 9 })
    gz.on('data', c => chunks.push(c))
    gz.on('end', () => writeFile(filePath + '.gz', Buffer.concat(chunks)).then(res, rej))
    gz.on('error', rej)
    gz.end(src)
  })

  const brSize = (await readFile(filePath + '.br')).length
  console.log(`  ${filePath.replace(dist + '/', '')} → ${brSize} B br`)
}

const htmlFiles = await findHtml(dist)
console.log(`Recompressing ${htmlFiles.length} HTML file(s) in dist/…`)
for (const f of htmlFiles) await compress(f)
console.log('Done.')
