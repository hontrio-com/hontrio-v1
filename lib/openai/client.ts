import OpenAI from 'openai'

let _openai: OpenAI | null = null

export const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    if (!_openai) {
      _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })
    }
    return (_openai as any)[prop]
  },
})