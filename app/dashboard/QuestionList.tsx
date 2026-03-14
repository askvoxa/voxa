'use client'

import { useState, useRef } from 'react'
import html2canvas from 'html2canvas'
import { createClient } from '@/lib/supabase/client'

type Question = {
  id: string
  sender_name: string
  content: string
  price_paid: number
  service_type: string
  is_shareable: boolean
  is_anonymous: boolean
  created_at: string
  status: string
}

type Props = {
  questions: Question[]
  creatorUsername: string
  creatorId: string
}

type ResponseMode = 'text' | 'audio' | null

export default function QuestionList({ questions: initial, creatorUsername, creatorId }: Props) {
  const [questions, setQuestions] = useState<Question[]>(initial)
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [responseMode, setResponseMode] = useState<ResponseMode>(null)
  const [responseText, setResponseText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Áudio
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])

  // Story modal
  const [selectedStory, setSelectedStory] = useState<Question | null>(null)
  const storyRef = useRef<HTMLDivElement>(null)

  const openRespond = (id: string, mode: ResponseMode) => {
    setRespondingTo(id)
    setResponseMode(mode)
    setResponseText('')
    setAudioBlob(null)
    setAudioUrl(null)
    setSubmitError('')
  }

  const closeRespond = () => {
    setRespondingTo(null)
    setResponseMode(null)
    stopRecording()
  }

  // ── Gravação de áudio ──────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = (e) => chunksRef.current.push(e.data)
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(t => t.stop())
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
    } catch {
      setSubmitError('Permissão de microfone negada. Verifique as configurações do navegador.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
  }

  // ── Envio da resposta ──────────────────────────────────────────
  const submitResponse = async (questionId: string) => {
    setIsSubmitting(true)
    setSubmitError('')

    try {
      let response_audio_url: string | null = null

      if (responseMode === 'audio' && audioBlob) {
        // Upload para Supabase Storage
        const supabase = createClient()
        const fileName = `${creatorId}/${questionId}-${Date.now()}.webm`
        const { error: uploadError } = await supabase.storage
          .from('responses')
          .upload(fileName, audioBlob, { contentType: 'audio/webm', upsert: true })

        if (uploadError) throw new Error('Erro ao enviar áudio: ' + uploadError.message)

        const { data: urlData } = supabase.storage.from('responses').getPublicUrl(fileName)
        response_audio_url = urlData.publicUrl
      }

      const body = responseMode === 'text'
        ? { response_text: responseText.trim() }
        : { response_audio_url }

      const res = await fetch(`/api/questions/${questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erro ao salvar resposta')
      }

      // Remover da lista otimisticamente
      setQuestions(prev => prev.filter(q => q.id !== questionId))
      closeRespond()
    } catch (err: any) {
      setSubmitError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Story ──────────────────────────────────────────────────────
  const downloadStory = async () => {
    if (!storyRef.current) return
    try {
      const canvas = await html2canvas(storyRef.current, { 
        useCORS: true, 
        scale: 3, // Aumenta a resolução
        backgroundColor: null // Evita fundos pretos/cinzas inesperados
      } as any)
      canvas.toBlob((blob) => {
        if (!blob) {
          alert('Erro ao gerar imagem.')
          return
        }
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'voxa-story.jpg'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }, 'image/jpeg', 0.95)
    } catch {
      alert('Não foi possível gerar a imagem.')
    }
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const h = Math.floor(diff / 3_600_000)
    if (h < 1) return 'Agora há pouco'
    if (h < 24) return `Há ${h}h`
    return `Há ${Math.floor(h / 24)}d`
  }

  if (questions.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-12 shadow-sm border border-gray-100 text-center">
        <p className="text-4xl mb-4">🎉</p>
        <p className="text-xl font-bold text-gray-700">Tudo em dia!</p>
        <p className="text-gray-400 mt-2">Nenhuma pergunta pendente no momento.</p>
        <a
          href={`/perfil/${creatorUsername}`}
          className="inline-block mt-6 px-6 py-3 bg-gradient-instagram text-white font-bold rounded-xl text-sm"
        >
          Ver meu perfil público
        </a>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
        <h3 className="text-xl font-bold mb-6">Perguntas Pendentes</h3>

        <div className="space-y-4">
          {questions.map(q => {
            const level = Number(q.price_paid) >= 50 ? 'high' : Number(q.price_paid) >= 30 ? 'medium' : 'low'
            const isExpiring = (Date.now() - new Date(q.created_at).getTime()) > 24 * 3_600_000

            return (
              <div
                key={q.id}
                className={`rounded-2xl p-4 md:p-6 transition-all border ${
                  level === 'high' ? 'border-[#DD2A7B]/50 bg-pink-50/30 shadow-md' :
                  level === 'medium' ? 'border-orange-200 bg-orange-50/30' :
                  'border-gray-100 bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-lg flex items-center gap-2 flex-wrap">
                      {q.is_anonymous ? 'Anônimo' : q.sender_name}
                      {isExpiring && (
                        <span className="text-red-600 bg-red-100 px-2 py-0.5 rounded text-xs font-bold animate-pulse">URGENTE</span>
                      )}
                      {q.service_type === 'premium' && (
                        <span className="text-[#DD2A7B] bg-pink-100 px-2 py-0.5 rounded text-xs font-bold">PREMIUM</span>
                      )}
                      <span className="text-green-600 text-sm font-semibold">
                        R$ {Number(q.price_paid).toFixed(2).replace('.', ',')}
                      </span>
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {timeAgo(q.created_at)} • {q.service_type === 'premium' ? '🎥 Vídeo Premium' : '💬 Resposta Base'}
                    </p>
                  </div>
                </div>

                <p className="text-gray-800 text-lg mb-6 leading-relaxed">&ldquo;{q.content}&rdquo;</p>

                {/* Botões de resposta */}
                {respondingTo === q.id ? (
                  <div className="space-y-3">
                    {responseMode === 'text' && (
                      <textarea
                        value={responseText}
                        onChange={e => setResponseText(e.target.value)}
                        placeholder="Digite sua resposta..."
                        rows={4}
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#DD2A7B] resize-none"
                      />
                    )}

                    {responseMode === 'audio' && (
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                        {audioUrl ? (
                          <>
                            <audio controls src={audioUrl} className="w-full" />
                            <button
                              onClick={() => { setAudioBlob(null); setAudioUrl(null) }}
                              className="text-xs text-gray-500 underline"
                            >
                              Regravar
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={recording ? stopRecording : startRecording}
                            className={`w-full py-3 rounded-xl font-bold text-white transition-all ${recording ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-r from-purple-500 to-[#DD2A7B]'}`}
                          >
                            {recording ? '⏹ Parar gravação' : '🎙️ Iniciar gravação'}
                          </button>
                        )}
                      </div>
                    )}

                    {submitError && <p className="text-xs text-red-500">{submitError}</p>}

                    <div className="flex gap-2">
                      <button
                        onClick={() => submitResponse(q.id)}
                        disabled={
                          isSubmitting ||
                          (responseMode === 'text' && !responseText.trim()) ||
                          (responseMode === 'audio' && !audioBlob)
                        }
                        className="flex-1 bg-gradient-instagram text-white font-bold py-3 rounded-xl disabled:opacity-50 text-sm"
                      >
                        {isSubmitting ? 'Enviando...' : 'Enviar resposta'}
                      </button>
                      <button
                        onClick={closeRespond}
                        className="px-4 py-3 border border-gray-200 rounded-xl text-gray-500 text-sm font-medium hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => openRespond(q.id, 'audio')}
                      className="flex-1 font-bold py-3 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-[#DD2A7B] text-white hover:opacity-90 transition-all flex justify-center items-center gap-2"
                    >
                      🎙️ Responder por Áudio
                    </button>
                    <button
                      onClick={() => openRespond(q.id, 'text')}
                      className="flex-1 font-bold py-3 px-4 rounded-xl border-2 border-gray-200 text-gray-600 hover:bg-gray-50 transition-all flex justify-center items-center gap-2"
                    >
                      💬 Responder por Texto
                    </button>
                  </div>
                )}

                {q.is_shareable && !respondingTo && (
                  <div className="mt-4 pt-4 border-t border-gray-100/80 flex justify-end">
                    <button
                      onClick={() => setSelectedStory(q)}
                      className="text-sm font-semibold text-gray-500 hover:text-[#DD2A7B] flex items-center gap-2 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Preparar p/ Story
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal de Story */}
      {selectedStory && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-[400px] flex flex-col items-center">
            <div className="w-full flex justify-between items-center mb-4 px-2">
              <button onClick={() => setSelectedStory(null)} className="text-white font-bold text-sm bg-black/40 px-4 py-2 rounded-full hover:bg-black/60">
                Cancelar
              </button>
              <button onClick={downloadStory} className="bg-white text-black font-bold text-sm px-4 py-2 rounded-full flex items-center gap-2 hover:bg-gray-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Salvar Imagem
              </button>
            </div>

            <div
              ref={storyRef}
              className="w-[360px] h-[640px] bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F56040] rounded-[32px] p-8 flex flex-col justify-center relative overflow-hidden shadow-2xl"
            >
              <div data-html2canvas-ignore className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -mr-20 -mt-20"></div>
              <div data-html2canvas-ignore className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-400 opacity-20 rounded-full blur-3xl -ml-20 -mb-20"></div>

              <div className="bg-white rounded-3xl p-6 shadow-xl relative z-10 w-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg">
                    {selectedStory.is_anonymous ? '👻' : '👤'}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">
                      {selectedStory.is_anonymous ? 'Anônimo' : selectedStory.sender_name}
                    </p>
                    <p className="text-xs text-gray-500">enviou uma pergunta</p>
                  </div>
                </div>
                <p className="text-gray-800 text-xl font-medium leading-relaxed mb-6">
                  &ldquo;{selectedStory.content}&rdquo;
                </p>
                <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-4"></div>
                <p className="text-center font-bold text-transparent bg-clip-text bg-gradient-instagram text-sm">
                  voxa.com/perfil/{creatorUsername}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
