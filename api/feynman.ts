import { supabaseAdmin, getUserIdFromToken } from './lib/supabaseEdge'
import { callLLM } from './lib/llmClient'

export const config = {
  runtime: 'edge',
}

const FEYNMAN_SYSTEM_PROMPT = `Sen STEMA (Sokratik STEM Öğrenme Platformu) bünyesinde çalışan yapay zeka tabanlı bir Feynman Tekniği Hakem Ajanısın.
Görevin, öğrencinin belirli bir STEM konusu hakkında kendi kelimeleriyle yaptığı açıklamayı değerlendirmektir.

Öğrencinin anlatımını şu 4 kritere göre değerlendir:
1. Konunun anahtar kavramlarını, ilişkilerini ve temel terminolojisini doğru ve yeterli düzeyde kapsayıp kapsamadığı (Gizli kavram anahtarlarıyla karşılaştır).
2. Yanlış veya eksik kavramsal tanımlar içerip içermediği.
3. Eksikleri doğrudan "hatalı/kötü" demek yerine destekleyici, yönlendirici sorularla tamamlatacak açıklayıcı geribildirim.
4. Akılda kalıcılığı artıracak pratik analojiler, kısaltmalar veya hikayeler (mnemoteknik ipuçları) sunulması.

Yanıtını KESİNLİKLE JSON formatında vermelisin. Başka hiçbir açıklama metni ekleme. JSON yapısı şu şekilde olmalıdır:
{
  "score": <1-100 arasında tamsayı bir puan>,
  "feedback": "<Öğrenciye yönelik, onu cesaretlendiren ve eksiklerini yönlendirici sorularla soran detaylı Türkçe geribildirim>",
  "gaps": ["<Eksik bırakılan veya daha iyi açıklanması gereken 1. kavram>", "<2. kavram>", ...],
  "mnemonic": "<Kavramların akılda kalması için mnemoteknik benzetme, analoji veya pratik hikaye ipucu>",
  "whiteboardCommands": [
    {"type": "line", "x1": 50, "y1": 50, "x2": 250, "y2": 50, "color": "#2563eb", "label": "F"},
    {"type": "rect", "x": 100, "y": 150, "w": 80, "h": 50, "color": "#2563eb", "label": "m"},
    {"type": "circle", "x": 200, "y": 200, "r": 30, "color": "#16a34a", "label": "R"},
    {"type": "text", "x": 50, "y": 100, "text": "Hız = 5 m/s", "color": "#111111"},
    {"type": "plot", "formula": "sin(x)", "color": "#dc2626"}
  ]
}
`

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { conceptName, conceptDescription, userExplanation, conceptId } = await req.json() as {
      conceptName: string
      conceptDescription: string
      userExplanation: string
      conceptId?: string
    }

    if (!userExplanation || !conceptName) {
      return new Response(JSON.stringify({ error: 'Concept name and user explanation are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Initialize User ID
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    const userId = await getUserIdFromToken(authHeader)

    let evaluatedJSON: any = null

    try {
      const result = await callLLM({
        taskType: 'feynman',
        systemPrompt: FEYNMAN_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Değerlendirilecek Konu: ${conceptName}\nKonu Detayı/Açıklaması: ${conceptDescription}\nÖğrencinin Feynman Anlatımı: ${userExplanation}`,
          },
        ],
      })

      if (result.content) {
        evaluatedJSON = parseJSON(result.content)
      }
    } catch (err) {
      console.error('Feynman LLM call failed, using mock:', err)
    }

    if (!evaluatedJSON) {
      evaluatedJSON = getMockFeynmanEvaluation(conceptName, userExplanation)
    }

    // Store in tutor_events
    if (userId) {
      void supabaseAdmin.from('tutor_events').insert({
        user_id: userId,
        event_type: 'feynman_evaluation',
        payload: {
          concept_id: conceptId || null,
          concept_name: conceptName,
          score: evaluatedJSON.score,
          gaps: evaluatedJSON.gaps,
          mnemonic: evaluatedJSON.mnemonic,
          timestamp: new Date().toISOString()
        },
      }).then(({ error }) => {
        if (error) console.error('Error logging feynman_evaluation event:', error)
      })
    }

    return new Response(JSON.stringify(evaluatedJSON), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error: any) {
    console.error('Feynman Endpoint global error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

function parseJSON(rawText: string): any {
  try {
    let text = rawText.trim()
    if (text.startsWith('```json')) {
      text = text.substring(7)
    }
    if (text.endsWith('```')) {
      text = text.substring(0, text.length - 3)
    }
    return JSON.parse(text.trim())
  } catch (e) {
    console.error('Error parsing raw JSON text from model:', rawText, e)
    return null
  }
}

function getMockFeynmanEvaluation(conceptName: string, userExplanation: string): any {
  const explanationLength = userExplanation.trim().length
  let score = 50
  let feedback = 'Konuyu anlatma çabanız güzel, ancak açıklamanız biraz yüzeysel kalmış görünüyor.'
  let gaps = ['Konunun temel mekanizmaları', 'İlişkili formüller ve kanunlar']
  let mnemonic = 'Newton Yasalarını unutmamak için eylemsizlik (durma), ivme (koşma) ve etki-tepki (çarpışma) aşamalarını gözünde canlandırabilirsin.'

  if (explanationLength > 200) {
    score = 82
    feedback = `"${conceptName}" konusundaki anlatımınız gayet başarılı. Kavramların çoğunu kendi kelimelerinizle açıklamışsınız. Ancak yine de ufak tefek eksiklerimiz var.`
    gaps = ['Matematiksel kanıtlar', 'Özel sınır değerleri']
    mnemonic = 'Bu konudaki formülleri aklında tutmak için sembolleri birer karaktere benzetebilirsin. Örneğin: F (Kuvvet) = m (kütle) * a (ivme), yani "Fırıncı Mustafa Amca".'
  } else if (explanationLength > 80) {
    score = 68
    feedback = `Konu hakkındaki temel mantığı yakalamışsınız. Konsepti daha derinlemesine açıklamak için formüllerin neden o şekilde kurgulandığını da belirtebilirsiniz.`
    gaps = ['Değişkenlerin birbirleriyle ilişkisi']
  }

  let whiteboardCommands = []
  if (conceptName.toLowerCase().includes('limit') || conceptName.toLowerCase().includes('türev') || conceptName.toLowerCase().includes('integral')) {
    whiteboardCommands = [
      { type: 'plot', formula: 'sin(x)', color: '#dc2626' }
    ]
  } else if (conceptName.toLowerCase().includes('newton') || conceptName.toLowerCase().includes('mekanik')) {
    whiteboardCommands = [
      { type: 'rect', x: 100, y: 150, w: 80, h: 50, color: '#2563eb', label: 'm=2kg' },
      { type: 'line', x1: 180, y1: 175, x2: 260, y2: 175, color: '#dc2626', label: 'F=10N' }
    ]
  } else {
    whiteboardCommands = [
      { type: 'circle', x: 150, y: 150, r: 40, color: '#16a34a', label: 'r=5' }
    ]
  }

  return {
    score,
    feedback,
    gaps,
    mnemonic,
    whiteboardCommands
  }
}
