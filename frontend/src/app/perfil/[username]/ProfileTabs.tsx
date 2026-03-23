'use client'

import { useState } from 'react'

type Tab = 'perguntar' | 'respostas'

export default function ProfileTabs({
  askContent,
  answersContent,
  answersCount,
}: {
  askContent: React.ReactNode
  answersContent: React.ReactNode
  answersCount: number
}) {
  const [activeTab, setActiveTab] = useState<Tab>('perguntar')

  return (
    <>
      {/* Tab bar */}
      <div className="flex border-b border-white/10 relative z-10">
        <button
          onClick={() => setActiveTab('perguntar')}
          className={`flex-1 py-3.5 text-sm font-bold transition-colors relative ${
            activeTab === 'perguntar'
              ? 'text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Perguntar
          {activeTab === 'perguntar' && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#DD2A7B]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('respostas')}
          className={`flex-1 py-3.5 text-sm font-bold transition-colors relative ${
            activeTab === 'respostas'
              ? 'text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Respostas{answersCount > 0 && ` (${answersCount})`}
          {activeTab === 'respostas' && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#DD2A7B]" />
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className={activeTab === 'perguntar' ? 'block' : 'hidden'}>
        {askContent}
      </div>
      <div className={activeTab === 'respostas' ? 'block' : 'hidden'}>
        {answersContent}
      </div>
    </>
  )
}
