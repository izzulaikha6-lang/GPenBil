declare const Netlify: {
  env: { get(name: string): string | undefined }
}

const SYSTEM_PROMPT = `Kamu ialah Kenyalang, seekor burung enggang yang comel, pintar dan mesra. Kamu ialah pembantu pendidikan untuk murid sekolah rendah berumur 7 hingga 12 tahun di Malaysia.

Jawab dalam Bahasa Melayu baku Malaysia yang mudah dan ceria. Gunakan ayat pendek dan ringkas. Jika soalan berkaitan penjodoh bilangan, berikan jawapan, penerangan ringkas dan satu contoh ayat. Kamu juga boleh menjawab soalan umum seperti sains, sejarah dan matematik dengan tepat dan sesuai untuk kanak-kanak.

Untuk kuiz penjodoh bilangan, berikan satu soalan aneka pilihan A, B dan C tanpa jawapan. Selepas murid menjawab, puji jawapan yang betul atau berikan galakan dan petunjuk ringkas jika jawapan salah. Elakkan bahasa pasar Indonesia dan gunakan sebutan serta kosa kata Bahasa Melayu Malaysia.`

type ChatMessage = {
  role: 'user' | 'model'
  text: string
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Kaedah tidak dibenarkan.' }, { status: 405 })
  }

  try {
    const body = (await req.json()) as { messages?: ChatMessage[] }
    const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : []

    if (!messages.length || messages.some((message) =>
      !message || !['user', 'model'].includes(message.role) || typeof message.text !== 'string'
    )) {
      return Response.json({ error: 'Mesej tidak sah.' }, { status: 400 })
    }

    const apiKey = Netlify.env.get('GEMINI_API_KEY')
    const baseUrl = Netlify.env.get('GOOGLE_GEMINI_BASE_URL')?.replace(/\/$/, '')

    if (!apiKey || !baseUrl) {
      return Response.json({ error: 'Perkhidmatan AI belum tersedia.' }, { status: 503 })
    }

    const response = await fetch(
      `${baseUrl}/v1beta/models/gemini-2.5-flash:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: messages.map((message) => ({
            role: message.role,
            parts: [{ text: message.text.slice(0, 2000) }],
          })),
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 350,
          },
        }),
      },
    )

    if (!response.ok) {
      return Response.json({ error: 'Kenyalang tidak dapat menjawab sekarang.' }, { status: 502 })
    }

    const result = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const answer = result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim()

    if (!answer) {
      return Response.json({ error: 'Jawapan kosong diterima.' }, { status: 502 })
    }

    return Response.json({ answer })
  } catch {
    return Response.json({ error: 'Permintaan tidak dapat diproses.' }, { status: 500 })
  }
}

export const config = {
  path: '/api/chat',
  method: 'POST',
}
