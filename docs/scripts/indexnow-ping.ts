import manifestData from '../src/lib/sitemap-manifest.json' with { type: 'json' }

const KEY = '3ffcb05f-e81d-415c-b5d3-446fa6ec612d'
const HOST = 'virtualchat.svelte.page'
const SITE_URL = `https://${HOST}`

const urls = Object.keys(manifestData)
    .filter((p) => !p.startsWith('/social-cards'))
    .map((p) => `${SITE_URL}${p}`)

console.log(`Submitting ${urls.length} URLs to IndexNow...`)

const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
        host: HOST,
        key: KEY,
        keyLocation: `${SITE_URL}/${KEY}.txt`,
        urlList: urls
    })
})

if (response.ok || response.status === 202) {
    console.log(`IndexNow accepted (${response.status}): ${urls.length} URLs submitted`)
} else {
    console.error(`IndexNow rejected (${response.status}): ${await response.text()}`)
    process.exit(1)
}
