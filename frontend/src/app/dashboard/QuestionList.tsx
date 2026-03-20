'use client'

import { useState, useRef, useEffect } from 'react'
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

const MAX_AUDIO_SIZE = 10 * 1024 * 1024 // 10MB

export default function QuestionList({ questions: initial, creatorUsername, creatorId }: Props) {
  const [questions, setQuestions] = useState<Question[]>(initial)
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [responseMode, setResponseMode] = useState<ResponseMode>(null)
  const [responseText, setResponseText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectError, setRejectError] = useState('')

  // Áudio
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])

  // Revogar URL de áudio anterior sempre que uma nova é criada (evita memory leak)
  const audioUrlRef = useRef<string | null>(null)
  useEffect(() => {
    // Se a URL mudou e havia uma anterior, revogar a antiga
    if (audioUrlRef.current && audioUrlRef.current !== audioUrl) {
      URL.revokeObjectURL(audioUrlRef.current)
    }
    audioUrlRef.current = audioUrl
  }, [audioUrl])
  useEffect(() => {
    return () => { if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current) }
  }, [])

  // Detecta suporte a MediaRecorder (iOS Safari não suporta)
  const [supportsRecording, setSupportsRecording] = useState(false)
  useEffect(() => {
    setSupportsRecording(typeof window !== 'undefined' && !!window.MediaRecorder)
  }, [])

  // Timer de gravação
  useEffect(() => {
    if (!recording) { setRecordingSeconds(0); return }
    const interval = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
    return () => clearInterval(interval)
  }, [recording])

  // Story modal
  const [selectedStory, setSelectedStory] = useState<Question | null>(null)
  const storyRef = useRef<HTMLDivElement>(null)

  // Fechar modal com ESC
  useEffect(() => {
    if (!selectedStory) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedStory(null) }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [selectedStory])

  const handleReject = async (questionId: string) => {
    setRejectingId(questionId)
    try {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erro ao recusar pergunta')
      }
      setQuestions(prev => prev.filter(q => q.id !== questionId))
      setConfirmRejectId(null)
      showSuccess('Pergunta recusada e reembolso iniciado.')
    } catch (err: any) {
      setRejectError(err.message ?? 'Erro ao recusar pergunta. Tente novamente.')
    } finally {
      setRejectingId(null)
      setConfirmRejectId(null)
    }
  }

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(''), 3500)
  }

  const openRespond = (id: string, mode: ResponseMode) => {
    setRespondingTo(id)
    setResponseMode(mode)
    setResponseText('')
    setAudioBlob(null)
    setAudioUrl(null) // useEffect no audioUrl cuida da revogação
    setSubmitError('')
  }

  const closeRespond = () => {
    setRespondingTo(null)
    setResponseMode(null)
    stopRecording()
    setAudioUrl(null) // useEffect no audioUrl cuida da revogação
    setAudioBlob(null)
  }

  // ── Gravação de áudio (desktop/Android) ────────────────────────
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
    mediaRecorderRef.current = null
    setRecording(false)
  }

  // ── Upload de arquivo de áudio (fallback iOS Safari) ───────────
  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_AUDIO_SIZE) {
      setSubmitError('Arquivo muito grande. Máximo 10MB.')
      return
    }
    setAudioBlob(file)
    setAudioUrl(URL.createObjectURL(file)) // useEffect cuida de revogar a URL anterior
    setSubmitError('')
  }

  // ── Envio da resposta ──────────────────────────────────────────
  const submitResponse = async (questionId: string) => {
    setIsSubmitting(true)
    setSubmitError('')

    try {
      let response_audio_url: string | null = null

      if (responseMode === 'audio' && audioBlob) {
        if (audioBlob.size > MAX_AUDIO_SIZE) {
          throw new Error('Arquivo de áudio muito grande. Máximo 10MB.')
        }

        const supabase = createClient()
        const ext = audioBlob.type.includes('webm') ? 'webm' : 'mp3'
        const fileName = `${creatorId}/${questionId}-${Date.now()}.${ext}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('responses')
          .upload(fileName, audioBlob, { contentType: audioBlob.type || 'audio/webm', upsert: true })

        // Verificar explicitamente se upload foi bem-sucedido antes de prosseguir
        if (uploadError || !uploadData) {
          throw new Error('Erro ao enviar áudio. Tente novamente.')
        }

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

      // Remover da lista somente após confirmação da API (sem remoção otimista prematura)
      setQuestions(prev => prev.filter(q => q.id !== questionId))
      closeRespond()
      showSuccess('Resposta enviada com sucesso!')
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
        scale: 3,
        backgroundColor: null,
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
        <p className="text-4xl mb-4" role="img" aria-label="Celebração">🎉</p>
        <p className="text-xl font-bold text-gray-700">Tudo em dia!</p>
        <p className="text-gray-500 mt-2">Nenhuma pergunta pendente no momento.</p>
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
      {/* Toast de sucesso */}
      {successMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white font-semibold px-6 py-3 rounded-2xl shadow-lg text-sm">
          ✓ {successMessage}
        </div>
      )}

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
                      {timeAgo(q.created_at)} • {q.service_type === 'premium' ? <><span role="img" aria-label="Vídeo">🎥</span> Vídeo Premium</> : <><span role="img" aria-label="Mensagem">💬</span> Resposta Base</>}
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
                        maxLength={5000}
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#DD2A7B] resize-none"
                      />
                    )}

                    {responseMode === 'audio' && (
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                        {audioUrl ? (
                          <>
                            <audio controls src={audioUrl} className="w-full" preload="metadata" />
                            <button
                              onClick={() => {
                                if (audioUrl) URL.revokeObjectURL(audioUrl)
                                setAudioBlob(null)
                                setAudioUrl(null)
                              }}
                              className="text-sm text-gray-500 underline cursor-pointer py-1"
                            >
                              Regravar
                            </button>
                          </>
                        ) : supportsRecording ? (
                          <button
                            onClick={recording ? stopRecording : startRecording}
                            className={`w-full py-3 rounded-xl font-bold text-white transition-all ${recording ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-r from-purple-500 to-[#DD2A7B]'}`}
                          >
                            {recording
                              ? `⏹ Parar gravação — ${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2, '0')}`
                              : <><span role="img" aria-label="Microfone">🎙️</span> Iniciar gravação</>}
                          </button>
                        ) : (
                          <div>
                            <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-3">
                              Gravação não disponível neste navegador. Envie um arquivo de áudio:
                            </p>
                            <input
                              type="file"
                              accept="audio/*"
                              onChange={handleAudioFileUpload}
                              className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#DD2A7B] file:text-white hover:file:opacity-90"
                            />
                            <p className="text-xs text-gray-500 mt-1">Máximo 10MB (MP3, M4A, WAV)</p>
                          </div>
                        )}
                      </div>
                    )}

                    {submitError && <p className="text-sm text-red-500" role="alert">{submitError}</p>}

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
                        disabled={isSubmitting}
                        className="px-4 py-3 border border-gray-200 rounded-xl text-gray-500 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => openRespond(q.id, 'audio')}
                        className="flex-1 font-bold py-3 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-[#DD2A7B] text-white hover:opacity-90 transition-all flex justify-center items-center gap-2"
                      >
                        <span role="img" aria-label="Microfone">🎙️</span> Responder por Áudio
                      </button>
                      <button
                        onClick={() => openRespond(q.id, 'text')}
                        className="flex-1 font-bold py-3 px-4 rounded-xl border-2 border-gray-200 text-gray-600 hover:bg-gray-50 transition-all flex justify-center items-center gap-2"
                      >
                        <span role="img" aria-label="Mensagem">💬</span> Responder por Texto
                      </button>
                    </div>
                    <div className="mt-3 text-center">
                      <button
                        onClick={() => setConfirmRejectId(q.id)}
                        className="text-xs text-red-400 hover:text-red-600 underline"
                      >
                        Recusar pergunta
                      </button>
                    </div>
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

      {/* Modal de confirmação de recusa */}
      {confirmRejectId && (
        <div className="fixed inset-0 bg-black/50 flex justify-center z-50 p-0 md:p-4 items-end md:items-center">
          <div className="bg-white w-full max-w-sm shadow-2xl rounded-t-[32px] md:rounded-2xl p-6 pb-12 md:pb-6 mx-0 md:mx-4">
            <h3 className="font-semibold text-gray-900 mb-2">Recusar esta pergunta?</h3>
            <p className="text-sm text-gray-500 mb-4">
              O fã receberá reembolso automático. Esta ação não pode ser desfeita.
            </p>
            {rejectError && (
            <p className="text-sm text-red-500 mb-3" role="alert">{rejectError}</p>
          )}
          <div className="flex gap-3">
              <button
                onClick={() => { setConfirmRejectId(null); setRejectError('') }}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleReject(confirmRejectId)}
                disabled={!!rejectingId}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {rejectingId ? 'Recusando...' : 'Recusar e reembolsar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Story */}
      {selectedStory && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Pré-visualização de Story">
          <div className="relative w-full max-w-[400px] max-h-full overflow-auto flex flex-col items-center">
            <div className="w-full flex justify-between items-center mb-4 px-2">
              <button onClick={() => setSelectedStory(null)} className="text-white font-bold text-sm bg-black/40 px-4 py-3 rounded-full hover:bg-black/60 cursor-pointer">
                Cancelar
              </button>
              <button onClick={downloadStory} className="bg-white text-black font-bold text-sm px-4 py-3 rounded-full flex items-center gap-2 hover:bg-gray-100 cursor-pointer">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Salvar Imagem
              </button>
            </div>

            <div
              ref={storyRef}
              className="w-[360px] max-w-full aspect-[9/16] bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F56040] rounded-[32px] p-8 flex flex-col justify-center relative overflow-hidden shadow-2xl"
            >
              <div data-html2canvas-ignore className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -mr-20 -mt-20"></div>
              <div data-html2canvas-ignore className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-400 opacity-20 rounded-full blur-3xl -ml-20 -mb-20"></div>

              <div className="bg-white rounded-3xl p-6 shadow-xl relative z-10 w-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg">
                    <span role="img" aria-label={selectedStory.is_anonymous ? 'Anônimo' : 'Usuário'}>{selectedStory.is_anonymous ? '👻' : '👤'}</span>
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
