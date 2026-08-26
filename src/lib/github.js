import { decodeBase64Utf8, encodeBase64Utf8, emptyStore, normalizeStore } from './utils'

const API = 'https://api.github.com'

export class GitHubDataClient {
  /**
   * @param {{ token: string, owner: string, repo: string, path: string }} config
   */
  constructor(config) {
    this.config = config
    this.sha = null
  }

  headers() {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.config.token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  }

  contentUrl() {
    const { owner, repo, path } = this.config
    return `${API}/repos/${owner}/${repo}/contents/${path}`
  }

  async validate() {
    const { owner, repo } = this.config
    const res = await fetch(`${API}/repos/${owner}/${repo}`, {
      headers: this.headers()
    })
    if (res.status === 401) {
      throw new Error('驗證失敗，請確認 Token 是否正確。')
    }
    if (res.status === 404) {
      throw new Error('找不到儲存庫，請確認名稱與權限。')
    }
    if (!res.ok) {
      throw new Error(`驗證失敗（HTTP ${res.status}）`)
    }
    return res.json()
  }

  async load() {
    const res = await fetch(this.contentUrl(), { headers: this.headers() })

    if (res.status === 404) {
      // 檔案尚不存在：建立空白資料庫
      const created = await this.save(emptyStore(), 'Initialize tasks.json for Karen Calendar')
      return created
    }

    if (res.status === 401) {
      throw new Error('驗證失敗，請確認 Token 是否正確。')
    }
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`讀取資料失敗（HTTP ${res.status}）：${body}`)
    }

    const file = await res.json()
    this.sha = file.sha
    const jsonText = decodeBase64Utf8(file.content)
    const parsed = JSON.parse(jsonText || '[]')
    return normalizeStore(parsed)
  }

  /**
   * @param {object} store
   * @param {string} message
   */
  async save(store, message = 'Update calendar data') {
    const content = encodeBase64Utf8(JSON.stringify(store, null, 2))
    const body = {
      message,
      content,
      branch: undefined
    }
    if (this.sha) body.sha = this.sha

    const res = await fetch(this.contentUrl(), {
      method: 'PUT',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (res.status === 409 || res.status === 422) {
      // sha 衝突：重新讀取最新 sha 再重試一次
      await this.refreshSha()
      body.sha = this.sha
      const retry = await fetch(this.contentUrl(), {
        method: 'PUT',
        headers: {
          ...this.headers(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })
      if (!retry.ok) {
        const text = await retry.text()
        throw new Error(`寫入失敗（重試後 HTTP ${retry.status}）：${text}`)
      }
      const data = await retry.json()
      this.sha = data.content?.sha || this.sha
      return store
    }

    if (res.status === 401) {
      throw new Error('驗證失敗，無法儲存。')
    }
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`寫入失敗（HTTP ${res.status}）：${text}`)
    }

    const data = await res.json()
    this.sha = data.content?.sha || this.sha
    return store
  }

  async refreshSha() {
    const res = await fetch(this.contentUrl(), { headers: this.headers() })
    if (res.status === 404) {
      this.sha = null
      return
    }
    if (!res.ok) return
    const file = await res.json()
    this.sha = file.sha
  }
}
