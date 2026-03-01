const KIE_API_URL = 'https://api.kie.ai/api/v1/jobs'

export class KieClient {
  private apiKey: string

  constructor() {
    this.apiKey = process.env.KIE_API_KEY || ''
    if (!this.apiKey) {
      throw new Error('KIE_API_KEY is not set')
    }
  }

  async createImageTask(prompt: string, imageUrls: string[] = [], options: {
    aspect_ratio?: string
    resolution?: string
    output_format?: string
  } = {}) {
    const response = await fetch(`${KIE_API_URL}/createTask`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'nano-banana-pro',
        input: {
          prompt,
          image_input: imageUrls,
          aspect_ratio: options.aspect_ratio || '1:1',
          resolution: options.resolution || '1K',
          output_format: options.output_format || 'png',
        },
      }),
    })

    const data = await response.json()
    if (data.code !== 200) {
      throw new Error(`KIE API error: ${data.msg || 'Unknown error'}`)
    }
    return data.data.taskId as string
  }

  async getTaskStatus(taskId: string) {
    const response = await fetch(
      `${KIE_API_URL}/recordInfo?taskId=${taskId}`,
      { headers: { 'Authorization': `Bearer ${this.apiKey}` } }
    )
    const data = await response.json()
    if (data.code !== 200) {
      throw new Error(`KIE API error: ${data.msg || data.message || 'Unknown error'}`)
    }
    return data.data as {
      taskId: string
      model: string
      state: 'waiting' | 'queuing' | 'generating' | 'success' | 'fail'
      resultJson: string
      failCode: string
      failMsg: string
    }
  }

  // Limita 20 minute
  async waitForTask(taskId: string, maxWaitMs: number = 1200000): Promise<string[]> {
    const startTime = Date.now()

    const getPollInterval = (elapsed: number) => {
      if (elapsed < 30000) return 3000   // primele 30s: la 3s
      if (elapsed < 120000) return 5000  // 30s-2min: la 5s
      if (elapsed < 300000) return 8000  // 2min-5min: la 8s
      return 15000                        // peste 5min: la 15s
    }

    while (true) {
      const elapsed = Date.now() - startTime

      if (elapsed >= maxWaitMs) {
        throw new Error('Generarea a durat prea mult (peste 20 minute). Încearcă din nou.')
      }

      const task = await this.getTaskStatus(taskId)
      console.log(`KIE task ${taskId}: ${task.state} (${Math.round(elapsed / 1000)}s)`)

      if (task.state === 'success') {
        const result = JSON.parse(task.resultJson)
        return result.resultUrls || []
      }

      if (task.state === 'fail') {
        throw new Error(`KIE generation failed: ${task.failMsg || 'Unknown reason'}`)
      }

      await new Promise(resolve => setTimeout(resolve, getPollInterval(elapsed)))
    }
  }
}