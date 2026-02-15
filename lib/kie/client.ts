const KIE_API_URL = 'https://api.kie.ai/api/v1/jobs'

export class KieClient {
  private apiKey: string

  constructor() {
    this.apiKey = process.env.KIE_API_KEY || ''
    if (!this.apiKey) {
      throw new Error('KIE_API_KEY is not set')
    }
  }

  // Trimite un task de generare imagine
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

  // Verifica statusul unui task
  async getTaskStatus(taskId: string) {
    const response = await fetch(
      `${KIE_API_URL}/recordInfo?taskId=${taskId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      }
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

  // Asteapta pana se finalizeaza taskul (polling)
  async waitForTask(taskId: string, maxWaitMs: number = 120000): Promise<string[]> {
    const startTime = Date.now()
    const pollInterval = 3000 // 3 secunde

    while (Date.now() - startTime < maxWaitMs) {
      const task = await this.getTaskStatus(taskId)

      console.log(`KIE task ${taskId}: ${task.state}`)

      if (task.state === 'success') {
        // Parseaza rezultatul
        const result = JSON.parse(task.resultJson)
        return result.resultUrls || []
      }

      if (task.state === 'fail') {
        throw new Error(`KIE generation failed: ${task.failMsg || 'Unknown reason'}`)
      }

      // Asteapta inainte de urmatorul poll
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    throw new Error('KIE task timeout - imaginea nu a fost generată în timpul alocat')
  }
}